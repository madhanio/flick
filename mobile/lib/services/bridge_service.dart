import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../src/rust/bridge.dart' as bridge;

class BridgeService {
  static String? _nodeId;
  static String? _deviceId;
  static const String _deviceName = 'Pixel 8 Pro';
  static const _storage = FlutterSecureStorage();
  static const _keyKey = 'flick_secret_key_base64';

  static Stream<String>? _incomingStream;
  static Completer<void>? _initCompleter;

  static Future<void> initialize({String deviceName = _deviceName}) async {
    if (_initCompleter != null) {
      return _initCompleter!.future;
    }
    _initCompleter = Completer<void>();

    try {
      Uint8List? keyBytes;
      final storedBase64 = await _storage.read(key: _keyKey);
      if (storedBase64 != null && storedBase64.isNotEmpty) {
        try {
          final decoded = base64Decode(storedBase64);
          if (decoded.length == 32) {
            keyBytes = decoded;
          }
        } catch (_) {}
      }

      if (keyBytes == null) {
        final rnd = Random.secure();
        keyBytes = Uint8List.fromList(List<int>.generate(32, (_) => rnd.nextInt(256)));
        await _storage.write(key: _keyKey, value: base64Encode(keyBytes));
      }

      // Synchronously set _nodeId and _deviceId immediately from the keypair bytes in Dart
      final cleanId = base64UrlEncode(keyBytes).replaceAll('=', '');
      _nodeId = cleanId;
      _deviceId = 'dev_${cleanId.substring(0, min(8, cleanId.length))}';
      print('⚡ Instantly derived local Node ID: $_nodeId');

      final rustNodeId = await bridge.startNode(deviceName: deviceName);
      if (rustNodeId.isNotEmpty) {
        _nodeId = rustNodeId.trim();
        final shortId = _nodeId!.length > 8 ? _nodeId!.substring(0, 8) : _nodeId!;
        _deviceId = 'dev_$shortId';
      }

      print('⚡ Flick node initialized — Node ID: $_nodeId, Device ID: $_deviceId');

      try {
        _incomingStream = bridge.incomingFlicksStream().asBroadcastStream();
      } catch (e) {
        print('⚠️ Error binding incomingFlicksStream: $e');
      }

      _initCompleter!.complete();
      return;
    } catch (e) {
      print('⚠️ Bridge init error: $e');
      _initCompleter!.completeError(e);
      _initCompleter = null; // allow retry on failure
      rethrow;
    }
  }

  static String? get nodeId => _nodeId;
  static String? get deviceId => _deviceId;
  static String get deviceName => _deviceName;
  static bool get isReady => _initCompleter?.isCompleted == true;

  static Future<bool> send(String content) async {
    if (_deviceId == null) return false;
    try {
      return await bridge.sendFlick(
        content: content,
        deviceId: _deviceId!,
        deviceName: _deviceName,
      );
    } catch (_) {
      return false;
    }
  }

  static Future<bool> addPeer(String code) async {
    try {
      return await bridge.addPeer(peerIdStr: code);
    } catch (_) {
      return false;
    }
  }

  static Stream<String> incomingStream() {
    if (_incomingStream == null) {
      throw StateError('BridgeService not initialized — await initialize() first');
    }
    return _incomingStream!;
  }
}
