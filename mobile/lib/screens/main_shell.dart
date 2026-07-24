import 'package:flutter/material.dart';
import '../models/flick_item.dart';
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

  final String myDeviceId = 'node_macbook_pro_7f8a';
  final String myDeviceName = 'MacBook Pro M3';

  final List<PairedDevice> _pairedDevices = [
    PairedDevice(
      id: 'node_iphone15_2b9c',
      name: 'Madhan\'s iPhone 15',
      type: 'phone',
      isOnline: true,
      lastSeen: DateTime.now(),
    ),
    PairedDevice(
      id: 'node_pixel8_9f1d',
      name: 'Pixel 8 Pro',
      type: 'phone',
      isOnline: false,
      lastSeen: DateTime.now().subtract(const Duration(hours: 3)),
    ),
  ];

  final List<FlickItem> _recentFlicks = [];
  final List<FlickItem> _incomingQueue = [];

  @override
  void initState() {
    super.initState();
    // Seed initial mock flicks for v0.1 UI verification
    _incomingQueue.add(
      FlickItem.create(
        content: 'ghp_xK894Jklm2901aB7QzP0192837465',
        fromDeviceId: 'node_iphone15_2b9c',
        fromDeviceName: 'Madhan\'s iPhone 15',
      ),
    );
    _incomingQueue.add(
      FlickItem.create(
        content: 'https://github.com/madhanio/flick',
        fromDeviceId: 'node_iphone15_2b9c',
        fromDeviceName: 'Madhan\'s iPhone 15',
      ),
    );
  }

  void _handleSendFlick(String content) {
    final newItem = FlickItem.create(
      content: content,
      fromDeviceId: myDeviceId,
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
      _pairedDevices.add(
        PairedDevice(
          id: id,
          name: name,
          type: 'phone',
          isOnline: true,
          lastSeen: DateTime.now(),
        ),
      );
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
        myDeviceId: myDeviceId,
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
