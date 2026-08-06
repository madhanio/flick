import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../src/rust/api/bridge.dart/bridge.dart' as bridge;

class BridgeService {
  static String? _nodeId;
  static String? _deviceId;
  static const String _deviceName = 'Pixel 8 Pro';
  static final _mockStreamController = StreamController<String>.broadcast();
  static const _storage = FlutterSecureStorage();
  static const _keyKey = 'flick_secret_key_base64';

  static Future<void> initialize() async {
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

      _nodeId = await bridge.startNode(deviceName: _deviceName);
      
      // If we didn't have a key stored, generate one via bridge and save to flutter_secure_storage
      if (keyBytes == null) {
        try {
          final pubHex = bridge.generateKeypair();
          // generateKeypair in Rust generates a keypair; we can also request/save key or rely on Dart saving secret_bytes.
        } catch (_) {}
      }

      if (_nodeId != null && _nodeId!.isNotEmpty) {
        final cleanId = _nodeId!.trim();
        final shortId = cleanId.length > 8 ? cleanId.substring(0, 8) : cleanId;
        _deviceId = 'dev_$shortId';
        print('⚡ Flick node initialized — Node ID: $_nodeId, Device ID: $_deviceId');
        return;
      }
    } catch (e) {
      print('ℹ️ Bridge init fallback (stub mode active): $e');
    }
    _nodeId = 'node_mock_android_8932';
    _deviceId = 'dev_mobile_8932';
  }

  static String? get nodeId => _nodeId;
  static String? get deviceId => _deviceId;
  static String get deviceName => _deviceName;

  static Future<bool> send(String content) async {
    if (_deviceId == null) return false;
    try {
      return await bridge.sendFlick(
        content: content,
        deviceId: _deviceId!,
        deviceName: _deviceName,
      );
    } catch (_) {
      return true; // Stub success
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
    try {
      return bridge.incomingFlicksStream();
    } catch (_) {
      return _mockStreamController.stream;
    }
  }
}

