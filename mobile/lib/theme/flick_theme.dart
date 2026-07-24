import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class FlickColors {
  static const Color bgBase = Color(0xFFF8F9FA);       // Porcelain canvas
  static const Color bgSurface = Color(0xFFFFFFFF);    // Crisp white cards
  static const Color bgSurface2 = Color(0xFFF1F3F5);   // Inputs & nested cards
  static const Color bgSurface3 = Color(0xFFE9ECEF);   // Hover / active pill
  
  static const Color borderSubtle = Color(0xFFE2E8F0);
  static const Color border = Color(0xFFCBD5E1);

  // Distinct Anti-AI-slop Accents
  static const Color accentPrimary = Color(0xFF0F4C3A); // Deep Pine Emerald
  static const Color accentFlick = Color(0xFFC2410C);   // Burnt Terracotta / Copper
  static const Color greenOnline = Color(0xFF15803D);   // Forest Green

  static const Color textPrimary = Color(0xFF0F172A);  // Deep Slate Ink
  static const Color textMuted = Color(0xFF64748B);
  static const Color textDisabled = Color(0xFF94A3B8);
}

class FlickTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: FlickColors.bgBase,
      colorScheme: const ColorScheme.light(
        surface: FlickColors.bgSurface,
        primary: FlickColors.accentPrimary,
        secondary: FlickColors.accentFlick,
        onSurface: FlickColors.textPrimary,
      ),
      textTheme: TextTheme(
        displayLarge: GoogleFonts.plusJakartaSans(
          color: FlickColors.textPrimary,
          fontSize: 32,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.5,
        ),
        titleLarge: GoogleFonts.plusJakartaSans(
          color: FlickColors.textPrimary,
          fontSize: 20,
          fontWeight: FontWeight.w700,
        ),
        titleMedium: GoogleFonts.plusJakartaSans(
          color: FlickColors.textPrimary,
          fontSize: 16,
          fontWeight: FontWeight.w600,
        ),
        bodyLarge: GoogleFonts.plusJakartaSans(
          color: FlickColors.textPrimary,
          fontSize: 15,
          fontWeight: FontWeight.w500,
        ),
        bodyMedium: GoogleFonts.plusJakartaSans(
          color: FlickColors.textMuted,
          fontSize: 14,
        ),
        bodySmall: GoogleFonts.plusJakartaSans(
          color: FlickColors.textMuted,
          fontSize: 12,
        ),
      ),
      cardTheme: CardThemeData(
        color: FlickColors.bgSurface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: FlickColors.borderSubtle, width: 1),
        ),
      ),
    );
  }

  static TextStyle get monoTextStyle => GoogleFonts.jetBrainsMono(
    fontSize: 13,
    color: FlickColors.textPrimary,
    height: 1.4,
  );
}
