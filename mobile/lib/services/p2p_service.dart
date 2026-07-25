import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:peerdart/peerdart.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../models/flick_item.dart';

class MobileP2PService {
  static final MobileP2PService _instance = MobileP2PService._internal();
  factory MobileP2PService() => _instance;
  MobileP2PService._internal();

  Peer? _peer;
  WebSocketChannel? _wsChannel;
  String myPeerId = '';
  final String deviceId = 'dev_mobile_${Random().nextInt(900000) + 100000}';
  final String deviceName = 'Android Mobile';

  final Map<String, DataConnection> _connections = {};
  final StreamController<FlickItem> _messageStreamController = StreamController<FlickItem>.broadcast();
  final StreamController<PairedDevice> _connectionStreamController = StreamController<PairedDevice>.broadcast();

  Stream<FlickItem> get onMessage => _messageStreamController.stream;
  Stream<PairedDevice> get onPeerConnect => _connectionStreamController.stream;

  Future<String> initialize() async {
    if (myPeerId.isNotEmpty && _peer != null) return myPeerId;

    final String randomSuffix = (Random().nextInt(900000) + 100000).toString();
    final String cleanId = 'flick_m_$randomSuffix';
    myPeerId = cleanId;

    _peer = Peer(
      id: cleanId,
      options: PeerOptions(
        host: '0.peerjs.com',
        port: 443,
        secure: true,
        path: '/',
      ),
    );

    final Completer<String> completer = Completer<String>();

    _peer!.on<String>('open').listen((id) {
      myPeerId = id;
      if (!completer.isCompleted) completer.complete(id);
    });

    _peer!.on('error').listen((err) {
      if (!completer.isCompleted) completer.complete(cleanId);
    });

    _peer!.on<DataConnection>('connection').listen((conn) {
      _setupConnection(conn);
    });

    Future.delayed(const Duration(seconds: 2), () {
      if (!completer.isCompleted) completer.complete(cleanId);
    });

    return completer.future;
  }

  void connectToLocalWifiRelay(String hostIp) {
    try {
      final wsUrl = Uri.parse('ws://$hostIp:8080');
      _wsChannel = WebSocketChannel.connect(wsUrl);

      _wsChannel!.sink.add(jsonEncode({
        'type': 'HANDSHAKE',
        'deviceId': deviceId,
        'deviceName': deviceName,
        'peerId': myPeerId,
      }));

      final dev = PairedDevice(
        id: 'flick_laptop_wifi',
        name: 'Laptop Browser (Local Wi-Fi)',
        type: 'laptop',
        isOnline: true,
        lastSeen: DateTime.now(),
      );
      _connectionStreamController.add(dev);

      _wsChannel!.stream.listen((event) {
        try {
          final map = jsonDecode(event.toString());
          if (map['type'] == 'FLICK') {
            final payload = map['payload'];
            if (payload != null && payload['fromDeviceId'] != deviceId) {
              final FlickItem item = FlickItem(
                id: payload['id']?.toString() ?? DateTime.now().toString(),
                content: payload['content']?.toString() ?? '',
                preview: payload['preview']?.toString() ?? '',
                isSensitive: payload['sensitive'] == true,
                fromDeviceId: payload['fromDeviceId']?.toString() ?? '',
                fromDeviceName: payload['fromDeviceName']?.toString() ?? 'Laptop Browser',
                timestamp: DateTime.fromMillisecondsSinceEpoch(
                  payload['timestamp'] is int ? payload['timestamp'] : DateTime.now().millisecondsSinceEpoch,
                ),
                isAccepted: false,
              );
              _messageStreamController.add(item);
            }
          }
        } catch (_) {}
      });
    } catch (_) {}
  }

  void _setupConnection(DataConnection conn) {
    _connections[conn.peer] = conn;

    final Map<String, dynamic> handshakeMap = {
      'type': 'HANDSHAKE',
      'deviceId': deviceId,
      'deviceName': deviceName,
      'peerId': myPeerId,
    };

    if (conn.open) {
      conn.send(handshakeMap);
    } else {
      conn.on('open').listen((_) {
        conn.send(handshakeMap);
      });
    }

    conn.on('data').listen((raw) {
      try {
        Map<String, dynamic>? map;
        if (raw is Map) {
          map = raw.map((k, v) => MapEntry(k.toString(), v));
        } else if (raw is String) {
          try {
            final decoded = jsonDecode(raw);
            if (decoded is Map) {
              map = decoded.map((k, v) => MapEntry(k.toString(), v));
            }
          } catch (_) {}
        }

        if (map == null) return;
        final String? msgType = map['type']?.toString();

        if (msgType == 'HANDSHAKE' || msgType == 'HANDSHAKE_ACK') {
          final PairedDevice dev = PairedDevice(
            id: map['peerId']?.toString() ?? conn.peer,
            name: map['deviceName']?.toString() ?? 'Laptop Browser',
            type: 'laptop',
            isOnline: true,
            lastSeen: DateTime.now(),
          );
          _connectionStreamController.add(dev);

          if (msgType == 'HANDSHAKE') {
            final ackMap = {
              'type': 'HANDSHAKE_ACK',
              'deviceId': deviceId,
              'deviceName': deviceName,
              'peerId': myPeerId,
            };
            conn.send(ackMap);
          }
        } else if (msgType == 'FLICK') {
          final payload = map['payload'];
          if (payload != null) {
            Map<String, dynamic> pMap = {};
            if (payload is Map) {
              pMap = payload.map((k, v) => MapEntry(k.toString(), v));
            } else if (payload is String) {
              try {
                final d = jsonDecode(payload);
                if (d is Map) pMap = d.map((k, v) => MapEntry(k.toString(), v));
              } catch (_) {}
            }

            if (pMap['fromDeviceId'] != deviceId) {
              final FlickItem item = FlickItem(
                id: pMap['id']?.toString() ?? DateTime.now().toString(),
                content: pMap['content']?.toString() ?? '',
                preview: pMap['preview']?.toString() ?? '',
                isSensitive: pMap['sensitive'] == true,
                fromDeviceId: pMap['fromDeviceId']?.toString() ?? '',
                fromDeviceName: pMap['fromDeviceName']?.toString() ?? 'Laptop Browser',
                timestamp: DateTime.fromMillisecondsSinceEpoch(
                  pMap['timestamp'] is int ? pMap['timestamp'] : DateTime.now().millisecondsSinceEpoch,
                ),
                isAccepted: false,
              );
              _messageStreamController.add(item);
            }
          }
        }
      } catch (_) {}
    });

    conn.on('close').listen((_) {
      _connections.remove(conn.peer);
    });
  }

  Future<PairedDevice> connectToPeer(String targetPeerId) async {
    final String cleanTargetId = targetPeerId.trim();

    // If target is IP Address (e.g., 192.168.1.9)
    if (cleanTargetId.contains('.') || cleanTargetId.contains(':')) {
      final String ip = cleanTargetId.split(':')[0].replaceAll('/', '').trim();
      connectToLocalWifiRelay(ip);
      return PairedDevice(
        id: 'flick_laptop_wifi',
        name: 'Laptop Browser (Local Wi-Fi)',
        type: 'laptop',
        isOnline: true,
        lastSeen: DateTime.now(),
      );
    }

    if (_peer == null) await initialize();
    final conn = _peer!.connect(cleanTargetId);
    final Completer<PairedDevice> completer = Completer<PairedDevice>();

    _setupConnection(conn);

    conn.on('open').listen((_) {
      final PairedDevice dev = PairedDevice(
        id: cleanTargetId,
        name: 'Laptop Browser',
        type: 'laptop',
        isOnline: true,
        lastSeen: DateTime.now(),
      );
      if (!completer.isCompleted) completer.complete(dev);
    });

    Future.delayed(const Duration(seconds: 10), () {
      if (!completer.isCompleted) completer.completeError('Connection timeout');
    });

    return completer.future;
  }

  void broadcastFlick(String content) {
    final bool sensitive = _detectSensitive(content);
    final String preview = sensitive
        ? '🔒 Sensitive content — tap to reveal'
        : content.length > 60
            ? '${content.substring(0, 60)}...'
            : content;

    final Map<String, dynamic> payload = {
      'id': 'msg_${DateTime.now().millisecondsSinceEpoch}',
      'content': content,
      'preview': preview,
      'sensitive': sensitive,
      'fromDeviceId': deviceId,
      'fromDeviceName': deviceName,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
      'status': 'sent',
    };

    final Map<String, dynamic> flickMsg = {
      'type': 'FLICK',
      'payload': payload,
    };

    // Broadcast over WebSocket Relay if active, else WebRTC
    if (_wsChannel != null) {
      try {
        _wsChannel!.sink.add(jsonEncode(flickMsg));
      } catch (_) {}
    } else {
      for (final conn in _connections.values) {
        if (conn.open) {
          conn.send(flickMsg);
        }
      }
    }
  }

  bool _detectSensitive(String text) {
    final trimmed = text.trim();
    if (trimmed.length >= 16 && !trimmed.contains(' ') && RegExp(r'[0-9]').hasMatch(trimmed) && RegExp(r'[A-Z]').hasMatch(trimmed)) {
      return true;
    }
    if (trimmed.startsWith('ghp_') || trimmed.startsWith('eyJ') || trimmed.startsWith('sk-') || trimmed.startsWith('bearer ')) {
      return true;
    }
    return false;
  }
}
