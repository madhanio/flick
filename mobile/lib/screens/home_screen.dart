import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/flick_item.dart';
import '../theme/flick_theme.dart';

class HomeScreen extends StatefulWidget {
  final List<FlickItem> recentFlicks;
  final List<PairedDevice> pairedDevices;
  final Function(String) onSendFlick;

  const HomeScreen({
    super.key,
    required this.recentFlicks,
    required this.pairedDevices,
    required this.onSendFlick,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _flickController = TextEditingController();

  void _submitFlick() {
    final text = _flickController.text.trim();
    if (text.isNotEmpty) {
      widget.onSendFlick(text);
      _flickController.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Flick sent to paired devices!'),
          backgroundColor: FlickColors.accentPrimary,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: FlickColors.bgBase,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // Header Bar
            SliverPadding(
              padding: const EdgeInsets.all(20.0),
              sliver: SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: FlickColors.accentPrimary.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: FlickColors.accentPrimary.withOpacity(0.2)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: const BoxDecoration(
                                  color: FlickColors.greenOnline,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                'P2P Active',
                                style: GoogleFonts.plusJakartaSans(
                                  color: FlickColors.accentPrimary,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Spacer(),
                        IconButton(
                          icon: const Icon(Icons.bolt, color: FlickColors.accentFlick),
                          onPressed: () {
                            // Quick copy current clipboard
                            Clipboard.getData(Clipboard.kTextPlain).then((data) {
                              if (data?.text != null && data!.text!.isNotEmpty) {
                                widget.onSendFlick(data.text!);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text('Flicked system clipboard!'),
                                    backgroundColor: FlickColors.accentFlick,
                                    behavior: SnackBarBehavior.floating,
                                  ),
                                );
                              }
                            });
                          },
                          tooltip: 'Flick System Clipboard',
                        )
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text(
                      '⚡ FLICK',
                      style: FlickTheme.lightTheme.textTheme.displayLarge,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Mode B Encrypted Clipboard Sync',
                      style: FlickTheme.lightTheme.textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
            ),

            // Paired Devices Row
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 20.0),
              sliver: SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'PAIRED DEVICES',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: FlickColors.textMuted,
                        letterSpacing: 1.0,
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 84,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: widget.pairedDevices.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 12),
                        itemBuilder: (context, index) {
                          final dev = widget.pairedDevices[index];
                          return Container(
                            width: 172,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            decoration: BoxDecoration(
                              color: FlickColors.bgSurface,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: FlickColors.borderSubtle),
                            ),
                            child: Row(
                              children: [
                                CircleAvatar(
                                  radius: 18,
                                  backgroundColor: FlickColors.bgSurface2,
                                  child: Icon(
                                    dev.type == 'laptop' ? Icons.laptop_mac : Icons.phone_iphone,
                                    color: FlickColors.accentPrimary,
                                    size: 18,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        dev.name,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: GoogleFonts.plusJakartaSans(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 13,
                                          color: FlickColors.textPrimary,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Row(
                                        children: [
                                          Container(
                                            width: 6,
                                            height: 6,
                                            decoration: BoxDecoration(
                                              color: dev.isOnline ? FlickColors.greenOnline : FlickColors.textDisabled,
                                              shape: BoxShape.circle,
                                            ),
                                          ),
                                          const SizedBox(width: 4),
                                          Flexible(
                                            child: Text(
                                              dev.isOnline ? 'Online' : 'Offline',
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: TextStyle(
                                                fontSize: 11,
                                                color: dev.isOnline ? FlickColors.greenOnline : FlickColors.textMuted,
                                                fontWeight: FontWeight.w500,
                                              ),
                                            ),
                                          ),
                                        ],
                                      )
                                    ],
                                  ),
                                )
                              ],
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Quick Flick Input Card
            SliverPadding(
              padding: const EdgeInsets.all(20.0),
              sliver: SliverToBoxAdapter(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: FlickColors.bgSurface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: FlickColors.border),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.03),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      )
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.send_rounded, color: FlickColors.accentFlick, size: 18),
                          const SizedBox(width: 8),
                          Text(
                            'Send Quick Flick',
                            style: GoogleFonts.plusJakartaSans(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                              color: FlickColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _flickController,
                        style: FlickTheme.monoTextStyle,
                        maxLines: 2,
                        decoration: InputDecoration(
                          hintText: 'Type or paste content to flick...',
                          hintStyle: GoogleFonts.plusJakartaSans(
                            color: FlickColors.textMuted,
                            fontSize: 13,
                          ),
                          filled: true,
                          fillColor: FlickColors.bgSurface2,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide.none,
                          ),
                          contentPadding: const EdgeInsets.all(12),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Align(
                        alignment: Alignment.centerRight,
                        child: ElevatedButton.icon(
                          onPressed: _submitFlick,
                          icon: const Icon(Icons.bolt, size: 16, color: Colors.white),
                          label: const Text('Flick Now'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: FlickColors.accentFlick,
                            foregroundColor: Colors.white,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            textStyle: GoogleFonts.plusJakartaSans(
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      )
                    ],
                  ),
                ),
              ),
            ),

            // Recent Flicks Section Header
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 20.0),
              sliver: SliverToBoxAdapter(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'RECENT FLICKS HISTORY',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: FlickColors.textMuted,
                        letterSpacing: 1.0,
                      ),
                    ),
                    Text(
                      '${widget.recentFlicks.length} items',
                      style: TextStyle(color: FlickColors.textMuted, fontSize: 12),
                    )
                  ],
                ),
              ),
            ),

            const SliverToBoxAdapter(child: SizedBox(height: 10)),

            // Flicks Feed
            widget.recentFlicks.isEmpty
                ? SliverToBoxAdapter(
                    child: Container(
                      margin: const EdgeInsets.all(20),
                      padding: const EdgeInsets.all(32),
                      decoration: BoxDecoration(
                        color: FlickColors.bgSurface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: FlickColors.borderSubtle),
                      ),
                      child: Center(
                        child: Column(
                          children: [
                            Icon(Icons.space_dashboard_outlined, size: 40, color: FlickColors.textDisabled),
                            const SizedBox(height: 12),
                            Text(
                              'No Flicks Yet',
                              style: GoogleFonts.plusJakartaSans(
                                fontWeight: FontWeight.w700,
                                color: FlickColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Copied clips will appear here after confirmation',
                              style: TextStyle(color: FlickColors.textMuted, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    ),
                  )
                : SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 20.0),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final item = widget.recentFlicks[index];
                          return Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: FlickColors.bgSurface,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: FlickColors.borderSubtle),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: FlickColors.bgSurface2,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Icon(
                                    item.isSensitive ? Icons.lock : Icons.content_copy,
                                    size: 18,
                                    color: item.isSensitive ? FlickColors.accentFlick : FlickColors.accentPrimary,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        item.isSensitive && !item.isRevealed ? item.preview : item.content,
                                        style: FlickTheme.monoTextStyle.copyWith(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w500,
                                        ),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 4),
                                      Row(
                                        children: [
                                          Text(
                                            'From ${item.fromDeviceName}',
                                            style: TextStyle(
                                              fontSize: 11,
                                              color: FlickColors.textMuted,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Text(
                                            '• ${item.timestamp.hour}:${item.timestamp.minute.toString().padLeft(2, '0')}',
                                            style: TextStyle(
                                              fontSize: 11,
                                              color: FlickColors.textDisabled,
                                            ),
                                          ),
                                        ],
                                      )
                                    ],
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.copy, size: 18, color: FlickColors.accentPrimary),
                                  onPressed: () {
                                    Clipboard.setData(ClipboardData(text: item.content));
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: const Text('Copied to system clipboard!'),
                                        behavior: SnackBarBehavior.floating,
                                        duration: const Duration(seconds: 1),
                                      ),
                                    );
                                  },
                                )
                              ],
                            ),
                          );
                        },
                        childCount: widget.recentFlicks.length,
                      ),
                    ),
                  ),

            const SliverToBoxAdapter(child: SizedBox(height: 40)),
          ],
        ),
      ),
    );
  }
}
