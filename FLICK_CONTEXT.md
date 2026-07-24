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
→ both devices now on encrypted channel

Result: Paired permanently. Survives restarts, shutdowns, network changes.
Only way to unpair = manually remove in settings.
```

**Multiple devices:** Each device has its own keypair. Pairing adds to a local "trusted devices" JSON list. Copy → broadcast to all online paired devices simultaneously (with per-device encryption).

---

## 5. Payload Format

```json
{
  "type": "clipboard",
  "content": "github.com/madhanio/flick",
  "preview": "github.com/madhanio...",
  "sensitive": false,
  "from_device_id": "device_abc123",
  "from_device_name": "MacBook Pro",
  "ts": 1721234567
}
```

- Signed with sender's Ed25519 key
- Iroh handles transport-layer encryption (E2E)
- Receiver verifies signature before accepting
- Relay sees only encrypted blobs, never content

---

## 6. Repo Structure

```
flick/
├── core/                   ← Rust crate (Iroh engine)
│   ├── src/
│   │   ├── lib.rs          ← main Iroh setup, gossip logic
│   │   ├── pairing.rs      ← QR generation, key exchange
│   │   ├── payload.rs      ← serialization, signing
│   │   └── bridge.rs       ← flutter_rust_bridge API surface
│   └── Cargo.toml
├── mobile/                 ← Flutter app
│   ├── lib/
│   │   ├── main.dart
│   │   ├── screens/
│   │   │   ├── home.dart
│   │   │   ├── incoming.dart
│   │   │   └── pair.dart
│   │   ├── services/
│   │   │   ├── clipboard_service.dart
│   │   │   ├── notification_service.dart
│   │   │   └── bridge_service.dart  ← calls Rust core
│   │   └── widgets/
│   └── pubspec.yaml
├── desktop/                ← Tauri app
│   ├── src-tauri/
│   │   ├── src/main.rs     ← calls same Rust core
│   │   └── tauri.conf.json
│   ├── src/                ← React UI
│   │   ├── App.tsx
│   │   ├── components/
│   │   └── screens/
│   └── package.json
├── .github/
│   └── workflows/
│       ├── build-android.yml
│       ├── build-desktop.yml
│       └── test.yml
└── README.md
```

---

## 7. Build Milestones

### v0.1 — Prove it works (local WiFi only)
- [ ] Rust core: Iroh endpoint + gossip topic setup
- [ ] Two terminal instances exchange messages on same machine
- [ ] Flutter app: basic UI shell (3 screens)
- [ ] flutter_rust_bridge wired up
- [ ] Clipboard listener fires on Android
- [ ] Message appears on other device (no encryption yet)

### v0.2 — Secure it
- [ ] Ed25519 keypair generation + storage
- [ ] QR code generation (laptop side)
- [ ] QR scanning (phone side)
- [ ] Encrypted payloads
- [ ] Signature verification on receive

### v0.3 — Mode B UX
- [ ] Toast notification on incoming
- [ ] Accept → clipboard / Dismiss → nothing
- [ ] Sensitive content detection + blur
- [ ] Local queue for missed flicks (last 5)

### v0.4 — Desktop
- [ ] Tauri app skeleton
- [ ] System tray icon + online/offline state
- [ ] Toast notification on Windows/Mac/Linux
- [ ] Tray menu → last 5 flicks

### v1.0 — Ship
- [ ] Android APK + Play Store
- [ ] Desktop installers (Win/Mac/Linux)
- [ ] MIT LICENSE
- [ ] README with one-command setup
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
**Write the Rust core — iroh-gossip setup for v0.1**
Two devices on same network, exchange a clipboard payload message,
prove the gossip topic subscription works end to end.

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
