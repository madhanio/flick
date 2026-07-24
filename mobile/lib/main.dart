import 'package:flutter/material.dart';
import 'screens/main_shell.dart';
import 'theme/flick_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const FlickApp());
}

class FlickApp extends StatelessWidget {
  const FlickApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flick — Cross-Device Clipboard P2P',
      debugShowCheckedModeBanner: false,
      theme: FlickTheme.lightTheme,
      home: const MainShell(),
    );
  }
}
