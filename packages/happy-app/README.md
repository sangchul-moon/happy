# Happy 앱 — 빌드 가이드

Happy 클라이언트는 하나의 Expo / React Native 코드베이스로 **웹, iOS, Android,
데스크톱(macOS + Windows)** 을 모두 빌드합니다. 데스크톱은 웹 번들을
[Tauri](https://tauri.app) 셸로 감쌉니다.

| 타깃             | 빌드 도구          | 빌드해야 하는 OS                     |
| ---------------- | ------------------ | ------------------------------------ |
| 웹               | Expo (Metro)       | 아무 OS (macOS / Windows / Linux)    |
| macOS 데스크톱   | Tauri 2 + 웹       | **macOS**                            |
| Windows 데스크톱 | Tauri 2 + 웹       | **Windows**                          |
| iOS              | Expo prebuild      | **macOS** (Xcode 필요)               |
| Android          | Expo prebuild      | macOS / Windows / Linux              |

> Tauri는 **크로스 컴파일이 안 됩니다** — Windows 앱은 Windows에서, macOS 앱은
> macOS에서 빌드해야 합니다. iOS는 늘 그렇듯 macOS가 필요합니다.

---

## 1. 사전 준비물 (공통)

- **Git**
- **Node.js 20 LTS 또는 22 LTS**
- **pnpm 10.11** — Corepack으로 활성화: `corepack enable`
  (버전은 저장소 `packageManager` 필드에 고정돼 있음)

타깃별 추가 준비물은 각 섹션에 정리돼 있습니다.

---

## 2. 공통 셋업

저장소를 클론하고 **모노레포 루트에서** 설치합니다:

```bash
git clone https://github.com/sangchul-moon/happy.git
cd happy
git checkout migration/upstream-sync
corepack enable

# 전체 설치 (iOS/Android/데스크톱에 필요):
pnpm install

# 또는 — 웹 전용/더 빠름, 네이티브 많은 CLI·서버 패키지는 건너뜀:
pnpm install --filter "happy-app..."
```

### 앱이 바라볼 서버 지정

앱은 Happy 서버(동기화 백엔드)와 통신합니다. URL은 env 파일로 **한 번만**
지정하면 — Expo가 자동 로드하고, Tauri의 웹 export도 이 값을 가져갑니다.

`packages/happy-app/.env` 파일을 만들고:

```
EXPO_PUBLIC_HAPPY_SERVER_URL=https://your-happy-server.example.com
```

- 생략하면 기본값(공개 클라우드 서버)을 씁니다.
- 앱 **안에서**(설정 → 서버) 재빌드 없이 서버를 바꿀 수도 있습니다.

아래 앱 명령들은 모두 `packages/happy-app`에서 실행합니다:

```bash
cd packages/happy-app
```

---

## 3. 웹

네이티브 툴체인이 필요 없습니다.

```bash
# 개발 서버 (핫 리로드) — 출력되는 http://localhost:8081 을 브라우저로 열기
pnpm web

# 정적 프로덕션 번들 → ./dist (아무 정적 서버로 호스팅)
npx expo export --platform web
npx serve dist          # 정적 호스팅 예시
```

`dist/`는 단일 페이지 앱(SPA)입니다. nginx / Vercel 등 아무 정적 호스트로
서빙하세요. 서버 URL이 HTTPS면 웹도 **HTTPS**로 서빙해야 합니다(mixed-content 방지).

---

## 4. macOS 데스크톱 (Tauri)

**추가 준비물**

- **Rust** (1.77.2+): <https://rustup.rs> 에서 설치
- **Xcode Command Line Tools**: `xcode-select --install`

**빌드**

```bash
# 개발 (핫 리로드 창)
pnpm tauri:dev

# 프로덕션 .app + .dmg
pnpm tauri:build:production
```

산출물: `src-tauri/target/release/bundle/` (`.app`, `.dmg`).
`tauri build`는 먼저 `expo export`를 자동 실행합니다(`beforeBuildCommand`).

> 서명 안 한 빌드는 다른 Mac에서 Gatekeeper에 막힙니다. 배포하려면 Apple
> Developer ID로 서명/공증하세요(`src-tauri`에서 설정).

---

## 5. Windows 데스크톱 (Tauri)

**추가 준비물**

- **Rust** (1.77.2+): <https://rustup.rs> (MSVC 툴체인 사용)
- **Microsoft C++ Build Tools** — Visual Studio Build Tools의
  "Desktop development with C++" 워크로드
- **WebView2 런타임** — Windows 10/11엔 기본 설치됨(없으면 Microsoft에서 설치)

**빌드** (PowerShell, `packages\happy-app`에서)

```powershell
# 개발
pnpm tauri:dev

# 프로덕션 설치파일 (.msi + .exe/NSIS)
pnpm tauri:build:production
```

산출물: `src-tauri\target\release\bundle\` (`msi\`, `nsis\`).

> `pnpm install`이 네이티브 모듈에서 실패하면 앱만 설치하세요(루트에서):
> `pnpm install --filter "happy-app..."`

---

## 6. iOS (macOS 전용)

**추가 준비물**

- **Xcode**(+ 시뮬레이터)와 **CocoaPods**: `sudo gem install cocoapods`
  또는 `brew install cocoapods`

**빌드 / 실행**

```bash
# 네이티브 ios/ 프로젝트 생성 (최초 1회, 또는 네이티브 설정 변경 후)
pnpm prebuild

# 부팅된 시뮬레이터에서 실행
pnpm ios

# USB 연결된 실기기에서 실행
pnpm ios:connected-device
```

변형: `pnpm ios:dev` / `ios:preview` / `ios:production` (`APP_ENV` 지정).

**서명** — 기본 번들 ID는 업스트림 팀의 `com.slopus.happy.dev`입니다. 본인
기기에 올리려면 **본인 Apple 팀**을 써야 합니다:

1. `app.config.js`의 dev 번들 ID(`bundleId.development`)를 고유한 값으로 변경
   (예: `com.yourname.happy.dev`).
2. `ios/Happydev.xcworkspace`를 Xcode로 열고 → Signing & Capabilities →
   본인 Team 선택(또는 Automatic signing 켜기).

무료 Apple ID로도 로컬 기기 설치는 됩니다(앱이 7일 후 만료). 무선 배포
(TestFlight / ad-hoc)는 유료 Apple Developer Program이 필요합니다 — 아래 EAS 참고.

---

## 7. Android

**추가 준비물**

- **JDK 17**
- **Android Studio** + SDK (`ANDROID_HOME` 설정, SDK 라이선스 동의)
- `google-services.json`은 이미 이 폴더에 포함돼 있습니다.

**빌드 / 실행**

```bash
# 네이티브 android/ 프로젝트 생성
pnpm prebuild

# 에뮬레이터 / 연결된 기기에서 실행
pnpm android

# 릴리스 APK/AAB
pnpm android:production
```

변형: `pnpm android:dev` / `android:preview` / `android:production`.
릴리스 빌드는 서명 키스토어가 필요합니다(prebuild 후 `android/`에서 설정하거나
아래 EAS 사용).

---

## 8. 모바일 클라우드 빌드 (EAS) — 로컬 툴체인 불필요

Xcode/Android를 로컬에 못 깔면 Expo 클라우드에서 빌드하세요:

```bash
npm i -g eas-cli
eas login
eas build --platform ios --profile preview        # 또는 android
```

프로필은 `eas.json`에 있습니다(`development`, `preview`, `production` 및
`-store` 변형). iOS 클라우드 빌드는 유료 Apple Developer 계정이 필요하고,
Android는 필요 없습니다.

---

## 9. 트러블슈팅

- **Node 22에서 `app.config.js` 로드 중 `require is not defined`** — 이 저장소에선
  수정됨(설정이 ESM). 이 브랜치를 쓰는지 확인하세요.
- **iOS `pod install` 중 `balanced is not a function`** — 루트 `package.json`의
  `balanced-match@1.0.2` pnpm override로 수정됨. 보이면 `pnpm install` 재실행.
- **Windows `pnpm install`이 네이티브 모듈에서 실패** — 앱만 설치:
  `pnpm install --filter "happy-app..."` (`happy-cli`/`happy-server` 제외).
- **데스크톱 빌드가 웹 번들을 못 찾음** — `tauri build`가 자동으로 export하지만,
  부분적으로 수동 실행했다면 `npx expo export --platform web`을 먼저 돌려 `dist/`를
  만드세요.
- **서버가 틀림** — `packages/happy-app/.env`의 `EXPO_PUBLIC_HAPPY_SERVER_URL`을
  확인하거나, 앱 설정 → 서버에서 변경하세요.
