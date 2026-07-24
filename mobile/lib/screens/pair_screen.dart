import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../models/flick_item.dart';
import '../theme/flick_theme.dart';

class PairScreen extends StatefulWidget {
  final String myDeviceId;
  final String myDeviceName;
  final List<PairedDevice> pairedDevices;
  final Function(String name, String id) onAddPair;
  final Function(String id) onUnpair;

  const PairScreen({
    super.key,
    required this.myDeviceId,
    required this.myDeviceName,
    required this.pairedDevices,
    required this.onAddPair,
    required this.onUnpair,
  });

  @override
  State<PairScreen> createState() => _PairScreenState();
}

class _PairScreenState extends State<PairScreen> {
  final TextEditingController _codeController = TextEditingController();

  void _manualPair() {
    final code = _codeController.text.trim();
    if (code.isNotEmpty) {
      widget.onAddPair('Remote Device', code);
      _codeController.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Paired successfully!'),
          backgroundColor: FlickColors.accentPrimary,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final qrData = 'flick://${widget.myDeviceId}?name=${Uri.encodeComponent(widget.myDeviceName)}';

    return Scaffold(
      backgroundColor: FlickColors.bgBase,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'ENCRYPTED CHANNEL PAIRING',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: FlickColors.textMuted,
                  letterSpacing: 1.0,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Pair Device',
                style: FlickTheme.lightTheme.textTheme.displayLarge?.copyWith(fontSize: 26),
              ),
              const SizedBox(height: 6),
              Text(
                'Scan QR from secondary device or enter manual pairing code. No servers involved.',
                style: FlickTheme.lightTheme.textTheme.bodyMedium,
              ),
              const SizedBox(height: 24),

              // QR Display Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: FlickColors.bgSurface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: FlickColors.border),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.02),
                      blurRadius: 8,
                      offset: const Offset(0, 4),
                    )
                  ],
                ),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: FlickColors.borderSubtle),
                      ),
                      child: QrImageView(
                        data: qrData,
                        version: QrVersions.auto,
                        size: 180.0,
                        eyeStyle: const QrEyeStyle(
                          eyeShape: QrEyeShape.square,
                          color: FlickColors.accentPrimary,
                        ),
                        dataModuleStyle: const QrDataModuleStyle(
                          dataModuleShape: QrDataModuleShape.square,
                          color: FlickColors.textPrimary,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      widget.myDeviceName,
                      style: GoogleFonts.plusJakartaSans(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                        color: FlickColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    SelectableText(
                      'ID: ${widget.myDeviceId}',
                      style: FlickTheme.monoTextStyle.copyWith(
                        fontSize: 12,
                        color: FlickColors.textMuted,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Manual Code Input
              Text(
                'MANUAL PAIRING CODE',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: FlickColors.textMuted,
                  letterSpacing: 1.0,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _codeController,
                      style: FlickTheme.monoTextStyle,
                      decoration: InputDecoration(
                        hintText: 'Enter topic code or node ID...',
                        hintStyle: GoogleFonts.plusJakartaSans(
                          color: FlickColors.textMuted,
                          fontSize: 13,
                        ),
                        filled: true,
                        fillColor: FlickColors.bgSurface,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: FlickColors.border),
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  ElevatedButton(
                    onPressed: _manualPair,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: FlickColors.accentPrimary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text('Pair'),
                  )
                ],
              ),

              const SizedBox(height: 28),

              // Existing Paired Devices List
              Text(
                'MANAGED PAIRED DEVICES',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: FlickColors.textMuted,
                  letterSpacing: 1.0,
                ),
              ),
              const SizedBox(height: 10),
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: widget.pairedDevices.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final dev = widget.pairedDevices[index];
                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: FlickColors.bgSurface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: FlickColors.borderSubtle),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          dev.type == 'laptop' ? Icons.laptop : Icons.phone_android,
                          color: FlickColors.accentPrimary,
                          size: 20,
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              dev.name,
                              style: GoogleFonts.plusJakartaSans(
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                                color: FlickColors.textPrimary,
                              ),
                            ),
                            Text(
                              dev.id,
                              style: FlickTheme.monoTextStyle.copyWith(
                                fontSize: 11,
                                color: FlickColors.textMuted,
                              ),
                            ),
                          ],
                        ),
                        const Spacer(),
                        IconButton(
                          icon: const Icon(Icons.delete_outline, size: 20, color: Colors.redAccent),
                          onPressed: () => widget.onUnpair(dev.id),
                          tooltip: 'Unpair device',
                        )
                      ],
                    ),
                  );
                },
              )
            ],
          ),
        ),
      ),
    );
  }
}
