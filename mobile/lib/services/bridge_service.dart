import 'dart:async';
import '../src/rust/api/bridge.dart/bridge.dart' as bridge;

class BridgeService {
  static String? _nodeId;
  static String? _deviceId;
  static const String _deviceName = 'Pixel 8 Pro';
  static final _mockStreamController = StreamController<String>.broadcast();

  static Future<void> initialize() async {
    try {
      _nodeId = await bridge.startNode(deviceName: _deviceName);
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

  static Stream<String> incomingStream() {
    try {
      return bridge.incomingFlicksStream();
    } catch (_) {
      return _mockStreamController.stream;
    }
  }
}

