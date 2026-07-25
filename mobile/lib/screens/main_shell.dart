import 'package:flutter/material.dart';
import '../models/flick_item.dart';
import '../services/p2p_service.dart';
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

  String myDeviceId = 'dev_mobile';
  final String myDeviceName = 'Android Mobile';

  final List<PairedDevice> _pairedDevices = [];
  final List<FlickItem> _recentFlicks = [];
  final List<FlickItem> _incomingQueue = [];

  @override
  void initState() {
    super.initState();

    MobileP2PService().initialize().then((id) {
      if (mounted) {
        setState(() {
          myDeviceId = id;
        });
      }
    });

    MobileP2PService().onMessage.listen((item) {
      if (mounted) {
        setState(() {
          _incomingQueue.insert(0, item);
        });
      }
    });

    MobileP2PService().onPeerConnect.listen((device) {
      if (mounted) {
        setState(() {
          if (!_pairedDevices.any((d) => d.id == device.id)) {
            _pairedDevices.add(device);
          }
        });
      }
    });
  }

  void _handleSendFlick(String content) {
    MobileP2PService().broadcastFlick(content);
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
