class FlickItem {
  final String id;
  final String content;
  final String preview;
  final bool isSensitive;
  final String fromDeviceId;
  final String fromDeviceName;
  final DateTime timestamp;
  bool isAccepted;
  bool isRevealed;

  FlickItem({
    required this.id,
    required this.content,
    required this.preview,
    required this.isSensitive,
    required this.fromDeviceId,
    required this.fromDeviceName,
    required this.timestamp,
    this.isAccepted = false,
    this.isRevealed = false,
  });

  factory FlickItem.create({
    required String content,
    required String fromDeviceId,
    required String fromDeviceName,
    bool? isSensitive,
  }) {
    final sensitive = isSensitive ?? detectSensitive(content);
    final String previewText;
    if (sensitive) {
      previewText = "🔒 Sensitive content — tap to reveal";
    } else if (content.length > 50) {
      previewText = "${content.substring(0, 50)}...";
    } else {
      previewText = content;
    }

    return FlickItem(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      content: content,
      preview: previewText,
      isSensitive: sensitive,
      fromDeviceId: fromDeviceId,
      fromDeviceName: fromDeviceName,
      timestamp: DateTime.now(),
    );
  }

  factory FlickItem.fromJson(Map<String, dynamic> json) {
    final String contentStr = json['content'] as String? ?? '';
    final int timestampSec = json['ts'] as int? ?? json['timestamp'] as int? ?? 0;
    return FlickItem(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      content: contentStr,
      preview: json['preview'] as String? ?? contentStr,
      isSensitive: json['sensitive'] as bool? ?? false,
      fromDeviceId: json['from_device_id'] as String? ?? '',
      fromDeviceName: json['from_device_name'] as String? ?? '',
      timestamp: DateTime.fromMillisecondsSinceEpoch(
        timestampSec * 1000,
      ),
    );
  }

  static bool detectSensitive(String text) {
    final trimmed = text.trim();
    if (trimmed.length >= 16 &&
        !trimmed.contains(' ') &&
        trimmed.contains(RegExp(r'[0-9]')) &&
        trimmed.contains(RegExp(r'[A-Z]'))) {
      return true;
    }
    if (trimmed.startsWith('ghp_') ||
        trimmed.startsWith('eyJ') ||
        trimmed.startsWith('sk-') ||
        trimmed.toLowerCase().startsWith('bearer ')) {
      return true;
    }
    return false;
  }
}

class PairedDevice {
  final String id;
  final String name;
  final String type; // 'phone' | 'laptop' | 'desktop'
  final bool isOnline;
  final DateTime lastSeen;

  PairedDevice({
    required this.id,
    required this.name,
    required this.type,
    required this.isOnline,
    required this.lastSeen,
  });
}
