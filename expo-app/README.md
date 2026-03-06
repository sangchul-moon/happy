<div align="center"><img src="/logo.png" width="200" title="Happy Coder" alt="Happy Coder"/></div>

<h1 align="center">
  Mobile and Web Client for Claude Code & Codex
</h1>

<h4 align="center">
Use Claude Code or Codex from anywhere with end-to-end encryption.
</h4>

<div align="center">
  
[📱 **iOS App**](https://apps.apple.com/us/app/happy-claude-code-client/id6748571505) • [🤖 **Android App**](https://play.google.com/store/apps/details?id=com.ex3ndr.happy) • [🌐 **Web App**](https://app.happy.engineering) • [🎥 **See a Demo**](https://youtu.be/GCS0OG9QMSE) • [📚 **Documentation**](https://happy.engineering/docs/) • [💬 **Discord**](https://discord.gg/fX9WBAhyfD)

</div>

<img width="5178" height="2364" alt="github" src="https://github.com/user-attachments/assets/14d517e9-71a8-4fcb-98ae-9ebf9f7c149f" />


<h3 align="center">
Step 1: Download App
</h3>

<div align="center">
<a href="https://apps.apple.com/us/app/happy-claude-code-client/id6748571505"><img width="135" height="39" alt="appstore" src="https://github.com/user-attachments/assets/45e31a11-cf6b-40a2-a083-6dc8d1f01291" /></a>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a href="https://play.google.com/store/apps/details?id=com.ex3ndr.happy"><img width="135" height="39" alt="googleplay" src="https://github.com/user-attachments/assets/acbba639-858f-4c74-85c7-92a4096efbf5" /></a>
</div>

<h3 align="center">
Step 2: Install CLI on your computer
</h3>

```bash
npm install -g happy-coder
```

<h3 align="center">
Step 3: Start using `happy` instead of `claude` or `codex`
</h3>

```bash

# Instead of: claude
# Use: happy

happy

# Instead of: codex
# Use: happy codex

happy codex

```

## How does it work?

On your computer, run `happy` instead of `claude` or `happy codex` instead of `codex` to start your AI through our wrapper. When you want to control your coding agent from your phone, it restarts the session in remote mode. To switch back to your computer, just press any key on your keyboard.

## 🔥 Why Happy Coder?

- 📱 **Mobile access to Claude Code and Codex** - Check what your AI is building while away from your desk
- 🔔 **Push notifications** - Get alerted when Claude Code and Codex needs permission or encounters errors  
- ⚡ **Switch devices instantly** - Take control from phone or desktop with one keypress
- 🔐 **End-to-end encrypted** - Your code never leaves your devices unencrypted
- 🛠️ **Open source** - Audit the code yourself. No telemetry, no tracking

## 📦 Project Components

- **[CLI](../cli)** - Command-line interface for Claude Code and Codex
- **[Server](../server)** - Backend server for encrypted sync
- **App** - This mobile & web client (you are here)

## Build from Source

### Prerequisites

- Node.js >= 20.0.0
- Yarn
- For iOS: Xcode & CocoaPods
- For Android: Android Studio & Android SDK
- For macOS desktop: Rust (via [rustup](https://rustup.rs/))

### Install Dependencies

```bash
cd expo-app
yarn install
```

### Web

```bash
yarn web           # Start web dev server on :8081
```

### iOS

```bash
yarn prebuild      # Generate native iOS project
yarn ios:dev       # Run on iOS simulator (development variant)
```

### Android

```bash
yarn prebuild      # Generate native Android project
yarn android:dev   # Run on Android emulator (development variant)
```

### macOS Desktop (Tauri)

```bash
yarn tauri:dev                  # Dev mode with hot reload
yarn tauri:build:production     # Build production .dmg
yarn tauri:sign                 # Apply ad-hoc code signing to built app
```

### Connect to a Self-Hosted Server

Use the `start:local-server` script to point the app at your local server:

```bash
yarn start:local-server   # Sets EXPO_PUBLIC_HAPPY_SERVER_URL=http://localhost:3005
```

Or set the environment variable manually for any script:

```bash
EXPO_PUBLIC_HAPPY_SERVER_URL=https://your-server.com yarn web
```

You can also change the server URL at runtime from the app's settings screen - it persists across restarts.

### Build Variants

Three variants can coexist on the same device:

| Variant | Bundle ID | Usage |
|---|---|---|
| Development | `com.slopus.happy.dev` | Local dev with hot reload |
| Preview | `com.slopus.happy.preview` | Beta testing with OTA updates |
| Production | `com.ex3ndr.happy` | App Store / Play Store release |

Switch variants via `APP_ENV`:

```bash
cross-env APP_ENV=development expo start   # or use yarn start:dev
cross-env APP_ENV=preview expo start       # or use yarn start:preview
cross-env APP_ENV=production expo start    # or use yarn start:production
```

### Useful Scripts

| Script | Description |
|---|---|
| `yarn start` | Start Expo dev server |
| `yarn web` | Run web version |
| `yarn ios:dev` | Run on iOS simulator |
| `yarn android:dev` | Run on Android emulator |
| `yarn tauri:dev` | macOS desktop with hot reload |
| `yarn tauri:build:production` | Build macOS .dmg |
| `yarn start:local-server` | Dev server pointed at localhost:3005 |
| `yarn typecheck` | TypeScript type checking |
| `yarn test` | Run tests with Vitest |

## 📚 Documentation & Contributing

- **[Documentation Website](https://happy.engineering/docs/)** - Learn how to use Happy Coder effectively
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Development setup including iOS, Android, and macOS desktop variant builds
- **[Edit docs at github.com/slopus/slopus.github.io](https://github.com/slopus/slopus.github.io)** - Help improve our documentation and guides

## License

MIT License - see [LICENSE](LICENSE) for details.
