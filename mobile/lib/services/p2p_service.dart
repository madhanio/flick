import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:peerdart/peerdart.dart';
import '../models/flick_item.dart';

class MobileP2PService {
  static final MobileP2PService _instance = MobileP2PService._internal();
  factory MobileP2PService() => _instance;
  MobileP2PService._internal();

  Peer? _peer;
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

    // Generate clean flick_... Peer ID matching laptop PeerJS format
    final String randomSuffix = (Random().nextInt(900000) + 100000).toString();
    final String cleanId = 'flick_m_$randomSuffix';
    
    _peer = Peer(id: cleanId);

    final Completer<String> completer = Completer<String>();

    _peer!.on<String>('open').listen((id) {
      myPeerId = id;
      if (!completer.isCompleted) {
        completer.complete(id);
      }
    });

    _peer!.on<DataConnection>('connection').listen((conn) {
      _setupConnection(conn);
    });

    return completer.future;
  }

  void _setupConnection(DataConnection conn) {
    conn.on('open').listen((_) {
      _connections[conn.peer] = conn;
      conn.send(jsonEncode({
        'type': 'HANDSHAKE',
        'deviceId': deviceId,
        'deviceName': deviceName,
        'peerId': myPeerId,
      }));
    });

    conn.on('data').listen((data) {
      try {
        final Map<String, dynamic> map = jsonDecode(data.toString());
        if (map['type'] == 'HANDSHAKE' || map['type'] == 'HANDSHAKE_ACK') {
          final PairedDevice dev = PairedDevice(
            id: map['peerId'] ?? conn.peer,
            name: map['deviceName'] ?? 'Laptop Browser',
            type: 'laptop',
            isOnline: true,
            lastSeen: DateTime.now(),
          );
          _connectionStreamController.add(dev);

          if (map['type'] == 'HANDSHAKE') {
            conn.send(jsonEncode({
              'type': 'HANDSHAKE_ACK',
              'deviceId': deviceId,
              'deviceName': deviceName,
              'peerId': myPeerId,
            }));
          }
        } else if (map['type'] == 'FLICK') {
          final payload = map['payload'];
          if (payload != null && payload['fromDeviceId'] != deviceId) {
            final FlickItem item = FlickItem(
              id: payload['id'] ?? DateTime.now().toString(),
              content: payload['content'] ?? '',
              preview: payload['preview'] ?? '',
              isSensitive: payload['sensitive'] ?? false,
              fromDeviceId: payload['fromDeviceId'] ?? '',
              fromDeviceName: payload['fromDeviceName'] ?? 'Laptop Browser',
              timestamp: DateTime.fromMillisecondsSinceEpoch(payload['timestamp'] ?? DateTime.now().millisecondsSinceEpoch),
              isAccepted: false,
            );
            _messageStreamController.add(item);
          }
        }
      } catch (e) {
        // ignore malformed JSON
      }
    });

    conn.on('close').listen((_) {
      _connections.remove(conn.peer);
    });
  }

  Future<PairedDevice> connectToPeer(String targetPeerId) async {
    final String cleanTargetId = targetPeerId.trim();
    if (_peer == null) await initialize();

    final conn = _peer!.connect(cleanTargetId);
    final Completer<PairedDevice> completer = Completer<PairedDevice>();

    conn.on('open').listen((_) {
      _setupConnection(conn);
      final PairedDevice dev = PairedDevice(
        id: cleanTargetId,
        name: 'Laptop Browser',
        type: 'laptop',
        isOnline: true,
        lastSeen: DateTime.now(),
      );
      if (!completer.isCompleted) {
        completer.complete(dev);
      }
    });

    // Timeout safety
    Future.delayed(const Duration(seconds: 10), () {
      if (!completer.isCompleted) {
        completer.completeError('Connection timeout');
      }
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

    final String jsonStr = jsonEncode({
      'type': 'FLICK',
      'payload': payload,
    });

    for (final conn in _connections.values) {
      conn.send(jsonStr);
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
