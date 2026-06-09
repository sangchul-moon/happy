# Happy App — Build Guide

The Happy client is one Expo / React Native codebase that ships to **web, iOS,
Android, and desktop (macOS + Windows)**. Desktop builds wrap the web bundle in
a [Tauri](https://tauri.app) shell.

| Target            | Built with        | Host OS you must build on        |
| ----------------- | ----------------- | -------------------------------- |
| Web               | Expo (Metro)      | any (macOS / Windows / Linux)    |
| macOS desktop     | Tauri 2 + web     | **macOS**                        |
| Windows desktop   | Tauri 2 + web     | **Windows**                      |
| iOS               | Expo prebuild     | **macOS** (Xcode)                |
| Android           | Expo prebuild     | macOS / Windows / Linux          |

> Tauri does **not** cross-compile — build the Windows app on Windows and the
> macOS app on macOS. Native mobile follows the usual rule: iOS needs macOS.

---

## 1. Prerequisites (all platforms)

- **Git**
- **Node.js 20 LTS or 22 LTS**
- **pnpm 10.11** — enable via Corepack: `corepack enable`
  (the version is pinned in the repo's `packageManager` field)

Per-target extras are listed in each section below.

---

## 2. Common setup

Clone the repo and install from the **monorepo root**:

```bash
git clone https://github.com/sangchul-moon/happy.git
cd happy
git checkout migration/upstream-sync
corepack enable

# Full install (needed for iOS/Android/desktop):
pnpm install

# OR — web-only / faster, skips native CLI & server packages:
pnpm install --filter "happy-app..."
```

### Point the app at a server

The app talks to a Happy server (sync backend). Set the URL **once** via an
env file — Expo auto-loads it, and Tauri's web export picks it up too.

Create `packages/happy-app/.env`:

```
EXPO_PUBLIC_HAPPY_SERVER_URL=https://your-happy-server.example.com
```

- Omit it to use the built-in default (the public cloud server).
- You can also change the server **inside the app** (Settings → Server) without
  rebuilding.

All app commands below run from `packages/happy-app`:

```bash
cd packages/happy-app
```

---

## 3. Web

No native toolchain required.

```bash
# Dev server (hot reload) — open the printed http://localhost:8081
pnpm web

# Static production bundle → ./dist (host with any static server)
npx expo export --platform web
npx serve dist          # example static host
```

`dist/` is a single-page app; serve it behind nginx / Vercel / any static host.
Serve it over **HTTPS** if your server URL is HTTPS (avoids mixed-content).

---

## 4. macOS desktop (Tauri)

**Extra prerequisites**

- **Rust** (1.77.2+): install via <https://rustup.rs>
- **Xcode Command Line Tools**: `xcode-select --install`

**Build**

```bash
# Dev (hot reload window)
pnpm tauri:dev

# Production .app + .dmg
pnpm tauri:build:production
```

Output: `src-tauri/target/release/bundle/` (`.app` and `.dmg`).
`tauri build` runs `expo export` first automatically (see `beforeBuildCommand`).

> Unsigned builds will be Gatekeeper-blocked on other Macs. To distribute,
> sign/notarize with an Apple Developer ID (configure in `src-tauri`).

---

## 5. Windows desktop (Tauri)

**Extra prerequisites**

- **Rust** (1.77.2+): <https://rustup.rs> (use the MSVC toolchain)
- **Microsoft C++ Build Tools** — Visual Studio Build Tools with the
  "Desktop development with C++" workload
- **WebView2 runtime** — preinstalled on Windows 10/11 (else install from
  Microsoft)

**Build** (PowerShell, from `packages\happy-app`)

```powershell
# Dev
pnpm tauri:dev

# Production installers (.msi + .exe/NSIS)
pnpm tauri:build:production
```

Output: `src-tauri\target\release\bundle\` (`msi\` and `nsis\`).

> If `pnpm install` failed on native modules, install only the app:
> `pnpm install --filter "happy-app..."` from the repo root.

---

## 6. iOS (macOS only)

**Extra prerequisites**

- **Xcode** (+ a simulator) and **CocoaPods**: `sudo gem install cocoapods`
  or `brew install cocoapods`

**Build / run**

```bash
# Generate native ios/ project (first time, or after native config changes)
pnpm prebuild

# Run on a booted simulator
pnpm ios

# Run on a USB-connected device
pnpm ios:connected-device
```

Variants: `pnpm ios:dev` / `ios:preview` / `ios:production` (set `APP_ENV`).

**Signing** — the default bundle id is `com.slopus.happy.dev` under the upstream
team. To run on your own device you must use **your** Apple team:

1. Change the dev bundle id in `app.config.js` (`bundleId.development`) to
   something unique, e.g. `com.yourname.happy.dev`.
2. Open `ios/Happydev.xcworkspace` in Xcode → Signing & Capabilities → select
   your Team (or enable Automatic signing).

A free Apple ID works for local device installs (apps expire after 7 days);
over-the-air distribution (TestFlight / ad-hoc) needs a paid Apple Developer
Program membership — see EAS below.

---

## 7. Android

**Extra prerequisites**

- **JDK 17**
- **Android Studio** + SDK (set `ANDROID_HOME`, accept SDK licenses)
- `google-services.json` is already committed in this folder.

**Build / run**

```bash
# Generate native android/ project
pnpm prebuild

# Run on emulator / connected device
pnpm android

# Release APK/AAB
pnpm android:production
```

Variants: `pnpm android:dev` / `android:preview` / `android:production`.
Release builds need a signing keystore (configure in `android/` after prebuild,
or use EAS below).

---

## 8. Cloud builds for mobile (EAS) — no local toolchain

If you can't set up Xcode/Android locally, build in Expo's cloud:

```bash
npm i -g eas-cli
eas login
eas build --platform ios --profile preview        # or android
```

Profiles live in `eas.json` (`development`, `preview`, `production`, plus
`-store` variants). iOS cloud builds still require a paid Apple Developer
account; Android does not.

---

## 9. Troubleshooting

- **`require is not defined` while loading `app.config.js` on Node 22** — fixed
  in this repo (the config is ESM). Make sure you're on this branch.
- **`balanced is not a function` during iOS `pod install`** — fixed via a
  `balanced-match@1.0.2` pnpm override in the root `package.json`. Re-run
  `pnpm install` if you see it.
- **Windows `pnpm install` fails building native modules** — scope to the app:
  `pnpm install --filter "happy-app..."` (skips `happy-cli`/`happy-server`).
- **Desktop build can't find the web bundle** — `tauri build` exports it
  automatically; if you run pieces manually, `npx expo export --platform web`
  first so `dist/` exists.
- **Wrong server** — check `packages/happy-app/.env`
  (`EXPO_PUBLIC_HAPPY_SERVER_URL`) or switch it in-app under Settings → Server.
