import 'dart:convert';
import 'package:flutter/material.dart';
import '../models/flick_item.dart';
import '../services/bridge_service.dart';
import '../theme/flick_theme.dart';
import 'home_screen.dart';
import 'incoming_screen.dart';
import 'pair_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;

  String myPeerId = BridgeService.nodeId ?? 'Initializing...';
  final String myDeviceName = BridgeService.deviceName;

  final List<PairedDevice> _pairedDevices = [
    PairedDevice(
      id: 'dev_macbook_pro',
      name: 'MacBook Pro 16"',
      type: 'laptop',
      isOnline: true,
      lastSeen: DateTime.now(),
    ),
    PairedDevice(
      id: 'dev_linux_workstation',
      name: 'Ubuntu Workstation',
      type: 'laptop',
      isOnline: false,
      lastSeen: DateTime.now().subtract(const Duration(minutes: 42)),
    ),
  ];

  final List<FlickItem> _recentFlicks = [
    FlickItem.create(
      content: 'https://github.com/madhanio/flick',
      fromDeviceId: 'dev_macbook_pro',
      fromDeviceName: 'MacBook Pro 16"',
    ),
    FlickItem.create(
      content: 'cargo build --release --target x86_64-pc-windows-msvc',
      fromDeviceId: 'dev_linux_workstation',
      fromDeviceName: 'Ubuntu Workstation',
    ),
  ];

  final List<FlickItem> _incomingQueue = [
    FlickItem.create(
      content: 'ghp_K91A78z902B1c456209LkpQx719Mno981AaZ',
      fromDeviceId: 'dev_macbook_pro',
      fromDeviceName: 'MacBook Pro 16"',
      isSensitive: true,
    ),
  ];

  @override
  void initState() {
    super.initState();

    BridgeService.initialize().then((_) {
      if (mounted) {
        setState(() {
          myPeerId = BridgeService.nodeId ?? BridgeService.deviceId ?? 'Ready';
        });
      }
    });

    BridgeService.incomingStream().listen((jsonStr) {
      if (mounted) {
        try {
          final Map<String, dynamic> json = jsonDecode(jsonStr);
          final item = FlickItem.fromJson(json);
          setState(() {
            _incomingQueue.insert(0, item);
          });
        } catch (_) {}
      }
    });
  }

  void _handleSendFlick(String content) {
    BridgeService.send(content);
    final newItem = FlickItem.create(
      content: content,
      fromDeviceId: BridgeService.deviceId ?? 'mobile',
      fromDeviceName: myDeviceName,
    );
    setState(() {
      _recentFlicks.insert(0, newItem);
    });
  }

  void _handleAcceptFlick(FlickItem item) {
    setState(() {
      item.isAccepted = true;
      _incomingQueue.removeWhere((i) => i.id == item.id);
      _recentFlicks.insert(0, item);
    });
  }

  void _handleDismissFlick(FlickItem item) {
    setState(() {
      _incomingQueue.removeWhere((i) => i.id == item.id);
    });
  }

  void _handleAddPair(String name, String id) {
    setState(() {
      if (!_pairedDevices.any((d) => d.id == id)) {
        _pairedDevices.add(
          PairedDevice(
            id: id,
            name: name,
            type: 'laptop',
            isOnline: true,
            lastSeen: DateTime.now(),
          ),
        );
      }
    });
  }

  void _handleUnpair(String id) {
    setState(() {
      _pairedDevices.removeWhere((d) => d.id == id);
    });
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> pages = [
      HomeScreen(
        recentFlicks: _recentFlicks,
        pairedDevices: _pairedDevices,
        onSendFlick: _handleSendFlick,
      ),
      IncomingScreen(
        incomingQueue: _incomingQueue,
        onAcceptFlick: _handleAcceptFlick,
        onDismissFlick: _handleDismissFlick,
      ),
      PairScreen(
        myDeviceId: myPeerId,
        myDeviceName: myDeviceName,
        pairedDevices: _pairedDevices,
        onAddPair: _handleAddPair,
        onUnpair: _handleUnpair,
      ),
    ];

    return Scaffold(
      backgroundColor: FlickColors.bgBase,
      body: IndexedStack(
        index: _currentIndex,
        children: pages,
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: FlickColors.bgSurface,
          border: Border(top: BorderSide(color: FlickColors.borderSubtle, width: 1)),
        ),
        child: NavigationBar(
          selectedIndex: _currentIndex,
          onDestinationSelected: (index) {
            setState(() {
              _currentIndex = index;
            });
          },
          backgroundColor: FlickColors.bgSurface,
          indicatorColor: FlickColors.bgSurface3,
          elevation: 0,
          destinations: [
            const NavigationDestination(
              icon: Icon(Icons.home_outlined, color: FlickColors.textMuted),
              selectedIcon: Icon(Icons.home_filled, color: FlickColors.accentPrimary),
              label: 'Home',
            ),
            NavigationDestination(
              icon: Badge(
                isLabelVisible: _incomingQueue.isNotEmpty,
                label: Text(_incomingQueue.length.toString()),
                child: const Icon(Icons.notifications_outlined, color: FlickColors.textMuted),
              ),
              selectedIcon: const Icon(Icons.notifications, color: FlickColors.accentFlick),
              label: 'Incoming',
            ),
            const NavigationDestination(
              icon: Icon(Icons.qr_code_2_outlined, color: FlickColors.textMuted),
              selectedIcon: Icon(Icons.qr_code_2, color: FlickColors.accentPrimary),
              label: 'Pair',
            ),
          ],
        ),
      ),
    );
  }
}
