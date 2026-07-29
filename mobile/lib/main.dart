import 'package:flutter/material.dart';
import 'screens/main_shell.dart';
import 'src/rust/api/bridge.dart/frb_generated.dart';
import 'theme/flick_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await RustLib.init();
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
