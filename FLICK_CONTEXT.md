# ⚡ FLICK — Full Project Handoff Document
> Paste this entire file at the start of any new AI session to resume instantly.
> Last updated: July 2026

---

## 1. What is Flick

A **cross-device clipboard sync app** — copy on phone, paste on laptop. No accounts, no cloud storage, no server costs. P2P encrypted, QR paired, open source (MIT).

**The one-liner:** "AirDrop but for your clipboard, and it works on everything."

**Inspired by:** DashBeam (github.com/tonyantony300/dashbeam) — same philosophy, one job, zero friction.

---

## 2. The Core UX Decision — Mode B

When clipboard is copied on Device A:
1. Device A encrypts + sends payload via Iroh gossip
2. Device B shows a **toast notification** with preview
3. User **taps to accept** → lands in clipboard → ready to paste
4. If dismissed → nothing happens to clipboard

**Why Mode B (not silent auto-sync):**
- Passwords don't silently appear on all devices
- User stays in control
- "Knocking on the door" mental model — intentional, trustworthy
- KDE Connect does silent sync and users turn it off within a week

**Sensitive content detection:**
- If content matches password patterns (long random strings, comes from password manager)
- Toast shows blurred preview: "🔒 Sensitive content — tap to reveal"
- Hover/tap shows preview, separate confirm to copy

**Offline queue:**
- Last 5 missed flicks stored locally (never on server)
- Delivered when device comes back online
- Visible in tray icon dropdown (desktop) and Incoming tab (mobile)

---

## 3. Full Tech Stack

### Mobile (Android + iOS)
- **Flutter / Dart** — UI + app shell
- **flutter_rust_bridge** — auto-generated bindings between Dart and Rust core
- **flutter_background_service** — clipboard listener runs when app is backgrounded
- **clipboard_watcher** — detects clipboard change events
- **local_notifications** — Mode B toast on receive
- **qr_flutter** — generate QR for pairing
- **mobile_scanner** — scan QR to pair
- **shared_preferences** — store device ID, paired devices list
- **flutter_secure_storage** — store keypair securely

### Desktop (Windows / Mac / Linux)
- **Tauri v2** — shell, system tray, notifications (Rust-based, lightweight)
- **React + TypeScript** — UI
- **Vite** — bundler
- Shares the same Rust core crate — no duplication

### Core (Rust)
- **iroh** — endpoint creation, NAT traversal, relay fallback
- **iroh-gossip** — topic-based message broadcast (the clipboard channel)
- **flutter_rust_bridge** — generates Dart bindings from Rust
- **serde / serde_json** — serialize clipboard payloads
- **tokio** — async runtime

### Transport
- **Iroh public relay network** — free, maintained by number0 (iroh.computer)
- Same relay infrastructure DashBeam uses
- **Zero cost to you** — no Railway, no Fly.io, no Vercel, nothing

### Transport fallback chain (automatic, Iroh handles it):
```
Priority 1: QUIC hole punching (direct P2P, no relay)
Priority 2: Iroh public relay (free)
Priority 3: Self-hosted relay (power users, one Docker command)
```

### Server / Infra
- **None.** $0/month forever.
- Iroh's public relay = free infrastructure
- No Supabase, no Railway, no database, nothing to deploy

---

## 4. Pairing Flow

```
Device A (laptop):
→ generates Ed25519 keypair on first launch
→ saves keypair locally (flutter_secure_storage)
→ creates TopicId = hash(public_key)
→ shows QR = { topic_id, endpoint_id, relay_hint }

Device B (phone):
→ scans QR
→ gets topic_id + endpoint_id
→ joins same Iroh gossip topic
```

---

## 5. Security Architecture

- **Keys:** Ed25519 keypair generated on device, private key never leaves device
- **Topic:** Derived deterministically from public key hash — random to outside world
- **Payload Encryption:** AES-256-GCM encrypted payload using shared secret derived from Ed25519 keypair + TopicId
- **Signatures:** Every payload signed by sender, receiver verifies before displaying toast
- **Relay untrusted:** Relay nodes only see encrypted blobs + topic ID. Cannot read clipboard content.

---

## 6. Directory Structure

```
flick/
├── core/                   # Shared Rust crate (the brain)
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs          # Public API exposed to Tauri + Flutter
│       ├── bridge.rs       # flutter_rust_bridge entry points
│       ├── gossip.rs       # Iroh gossip node implementation
│       ├── payload.rs      # ClipboardPayload struct + encryption
│       ├── pairing.rs      # Keypair generation + QR ticket creation
│       └── bin/
│           └── smoke_test.rs # 2-node P2P smoke test binary
├── desktop/                # Desktop app (Tauri v2 + React)
│   ├── package.json
│   ├── src/                # React UI
│   └── src-tauri/          # Tauri Rust wrapper -> calls flick/core
├── mobile/                 # Mobile app (Flutter)
│   ├── pubspec.yaml
│   └── lib/
│       ├── main.dart
│       ├── models/
│       ├── screens/
│       │   ├── home.dart
│       │   ├── incoming.dart
│       │   └── pair.dart
│       └── services/
│           └── bridge_service.dart
├── .gitignore
├── FLICK_CONTEXT.md
└── README.md
```

---

## 7. Build Milestones

### v0.1 — Prove it works (local WiFi & Relay)
- [x] Rust core: Iroh endpoint + gossip topic setup
- [x] Two terminal / node instances exchange messages on same machine (`smoke_test.rs`)
- [x] Flutter app: basic UI shell (3 screens: Home, Incoming, Pair)
- [x] flutter_rust_bridge wired up
- [x] Clipboard listener & bridge service setup
- [x] Message payload transport verified end-to-end

### v0.2 — Secure it
- [x] Ed25519 keypair generation + storage
- [x] QR code generation (laptop side)
- [x] QR scanning (phone side)
- [x] Encrypted payloads
- [x] Signature verification on receive

### v0.3 — Mode B UX
- [x] Toast notification on incoming
- [x] Accept → clipboard / Dismiss → nothing
- [x] Sensitive content detection + blur
- [x] Local queue for missed flicks (last 5)

### v0.4 — Desktop & Resilience
- [x] Tauri app skeleton & event emit setup
- [x] Reconnect Watchdog loop with exponential backoff (500ms → 30s)
- [x] Catch-unwind protection on all Rust bridge functions
- [x] Timestamp & content hash dedup guard
- [x] Verified 2-Node P2P smoke test (`cargo run --bin smoke_test`)

### v1.0 — Ship
- [x] MIT LICENSE
- [x] README with one-command setup
- [ ] Android APK + Play Store release build
- [ ] Desktop installers (Win/Mac/Linux)
- [ ] Demo GIF for GitHub

---

## 8. Design System

### Colors (Light Theme First)
```
bg-base:       #F8F9FA   (porcelain canvas background)
bg-surface:    #FFFFFF   (clean crisp white cards)
bg-surface-2:  #F1F3F5   (nested cards, inputs)
bg-surface-3:  #E9ECEF   (hover states)
border-subtle: #E2E8F0   (subtle light borders)
border:        #CBD5E1   (crisp structural borders)
accent-primary:#0F4C3A   (deep pine emerald — primary, active)
accent-flick:  #C2410C   (burnt terracotta / copper — flick action, send)
green:         #15803D   (online, success)
text-primary:  #0F172A   (deep slate ink)
text-muted:    #64748B   (secondary label text)
text-disabled: #94A3B8
```

### Typography
```
Display font:  Plus Jakarta Sans (800, 700, 600, 500)
Mono font:     JetBrains Mono (clipboard content, IDs, codes)
```

### Key UI Rules
- Light theme first (for v1) — clean porcelain white with tactile borders
- Anti-AI-slop design: No generic neon purples, glowing cyan/violet gradients, or default Tailwind blues
- Zero visible Material widgets — fully custom, editorial feel
- Monospace for all clipboard content previews
- Every action has immediate visual feedback
- Sensitive content always blurred by default
- Status always visible (online/offline per device)

### Screen inventory
1. **Home** — paired devices row + recent flicks list + FAB
2. **Incoming** — toast cards (normal + sensitive) + missed queue
3. **Pair Device** — QR code + manual code + paired devices list
4. (later) **Settings** — manage devices, notifications, theme

---

## 9. Key Decisions Log

| Decision | Choice | Why |
|---|---|---|
| Transport | Iroh (iroh-gossip) | Free relay, NAT traversal, E2E, same as DashBeam |
| Server cost | $0 | Iroh public relay covers it |
| UX mode | Mode B (notify + tap) | User control, no silent password sync |
| Desktop framework | Tauri | Same Rust core, lighter than Electron |
| Mobile | Flutter | Madhan's existing stack |
| Bridge | flutter_rust_bridge | Only mature Dart↔Rust bridge |
| Pairing | QR code (one-time) | No ticket to share, no other app needed |
| Persistence | Local only | No DB, no cloud, nothing to breach |
| Figma | Skip for v1 | Use design spec + HTML demo as reference |
| License | MIT | Open source, maximum adoption |

---

## 10. Reference Links

- DashBeam repo (inspiration): https://github.com/tonyantony300/dashbeam
- Iroh docs: https://iroh.computer
- iroh-gossip: https://docs.rs/iroh-gossip
- flutter_rust_bridge: https://cjycode.com/flutter_rust_bridge
- Tauri v2 docs: https://tauri.app
- Penpot (free Figma alt for design): https://penpot.app

---

## 11. How to Resume in a New AI Session

Paste this prompt at the start:

```
I'm building Flick — a P2P clipboard sync app.
Read the full context below and help me with [SPECIFIC TASK].

[paste this entire file]
```

### Current next task:
**v1.0 Production Binary Build & Media Demo**
Build production release packages (`npm run tauri build` for desktop, `flutter build apk --release` for Android) and generate demo preview visuals.

---

## 12. About the Developer

- **Name:** Madhan (GitHub: madhanio)
- **Stack:** Flutter/Dart, Node.js/TypeScript, Supabase, Python, Rust (learning)
- **Tools:** Antigravity (primary coding agent), Windsurf, Codex
- **Goal:** Ship Flick as a real open source project, use it daily

---

*Generated from Claude conversation — July 2026*
*Full architecture diagram: flick-architecture.html*
*UI demo: flick-demo.html*
