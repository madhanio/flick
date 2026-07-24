import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/flick_item.dart';
import '../theme/flick_theme.dart';

class IncomingScreen extends StatefulWidget {
  final List<FlickItem> incomingQueue;
  final Function(FlickItem) onAcceptFlick;
  final Function(FlickItem) onDismissFlick;

  const IncomingScreen({
    super.key,
    required this.incomingQueue,
    required this.onAcceptFlick,
    required this.onDismissFlick,
  });

  @override
  State<IncomingScreen> createState() => _IncomingScreenState();
}

class _IncomingScreenState extends State<IncomingScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: FlickColors.bgBase,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'INCOMING FLICKS',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: FlickColors.textMuted,
                  letterSpacing: 1.0,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Mode B Approval Doorway',
                style: FlickTheme.lightTheme.textTheme.displayLarge?.copyWith(fontSize: 24),
              ),
              const SizedBox(height: 6),
              Text(
                'Flicks require your explicit tap to copy into system clipboard. Passwords are password-manager safe.',
                style: FlickTheme.lightTheme.textTheme.bodyMedium,
              ),
              const SizedBox(height: 20),

              Expanded(
                child: widget.incomingQueue.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(20),
                              decoration: BoxDecoration(
                                color: FlickColors.bgSurface,
                                shape: BoxShape.circle,
                                border: Border.all(color: FlickColors.borderSubtle),
                              ),
                              child: const Icon(
                                Icons.notifications_paused_outlined,
                                size: 36,
                                color: FlickColors.textMuted,
                              ),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'Doorway Clean',
                              style: GoogleFonts.plusJakartaSans(
                                fontWeight: FontWeight.w700,
                                fontSize: 16,
                                color: FlickColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'No pending incoming flicks in queue.',
                              style: TextStyle(color: FlickColors.textMuted, fontSize: 13),
                            ),
                          ],
                        ),
                      )
                    : ListView.separated(
                        itemCount: widget.incomingQueue.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final item = widget.incomingQueue[index];
                          return Card(
                            color: FlickColors.bgSurface,
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                              side: BorderSide(
                                color: item.isSensitive ? FlickColors.accentFlick.withOpacity(0.5) : FlickColors.border,
                                width: 1.5,
                              ),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(16.0),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: item.isSensitive
                                              ? FlickColors.accentFlick.withOpacity(0.1)
                                              : FlickColors.accentPrimary.withOpacity(0.1),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Icon(
                                              item.isSensitive ? Icons.security : Icons.phonelink_ring,
                                              size: 14,
                                              color: item.isSensitive ? FlickColors.accentFlick : FlickColors.accentPrimary,
                                            ),
                                            const SizedBox(width: 4),
                                            Text(
                                              item.isSensitive ? 'Sensitive Content' : 'Incoming Flick',
                                              style: GoogleFonts.plusJakartaSans(
                                                fontSize: 11,
                                                fontWeight: FontWeight.w700,
                                                color: item.isSensitive ? FlickColors.accentFlick : FlickColors.accentPrimary,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      const Spacer(),
                                      Text(
                                        'From ${item.fromDeviceName}',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: FlickColors.textMuted,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  
                                  // Content Box with sensitive blur toggle
                                  Container(
                                    width: double.infinity,
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: FlickColors.bgSurface2,
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          item.isSensitive && !item.isRevealed
                                              ? '🔒 Sensitive content — tap button below to reveal'
                                              : item.content,
                                          style: FlickTheme.monoTextStyle,
                                        ),
                                        if (item.isSensitive && !item.isRevealed) ...[
                                          const SizedBox(height: 8),
                                          InkWell(
                                            onTap: () {
                                              setState(() {
                                                item.isRevealed = true;
                                              });
                                            },
                                            child: Text(
                                              'Show Raw String Preview',
                                              style: TextStyle(
                                                fontSize: 12,
                                                fontWeight: FontWeight.w700,
                                                color: FlickColors.accentFlick,
                                                decoration: TextDecoration.underline,
                                              ),
                                            ),
                                          )
                                        ]
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 14),

                                  // Action Buttons: Accept / Dismiss
                                  Row(
                                    children: [
                                      Expanded(
                                        child: OutlinedButton(
                                          onPressed: () => widget.onDismissFlick(item),
                                          style: OutlinedButton.styleFrom(
                                            foregroundColor: FlickColors.textMuted,
                                            side: const BorderSide(color: FlickColors.border),
                                            shape: RoundedRectangleBorder(
                                              borderRadius: BorderRadius.circular(10),
                                            ),
                                          ),
                                          child: const Text('Dismiss'),
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: ElevatedButton.icon(
                                          onPressed: () {
                                            Clipboard.setData(ClipboardData(text: item.content));
                                            widget.onAcceptFlick(item);
                                            ScaffoldMessenger.of(context).showSnackBar(
                                              SnackBar(
                                                content: const Text('Accepted! Copied to clipboard.'),
                                                backgroundColor: FlickColors.greenOnline,
                                                behavior: SnackBarBehavior.floating,
                                              ),
                                            );
                                          },
                                          icon: const Icon(Icons.check, size: 16, color: Colors.white),
                                          label: const Text('Accept & Copy'),
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: FlickColors.accentPrimary,
                                            foregroundColor: Colors.white,
                                            elevation: 0,
                                            shape: RoundedRectangleBorder(
                                              borderRadius: BorderRadius.circular(10),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  )
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              )
            ],
          ),
        ),
      ),
    );
  }
}
