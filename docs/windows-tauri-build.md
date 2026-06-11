# Windows 데스크톱 설치형 패키지 빌드 (Tauri, .exe/.msi)

`migration/upstream-sync` 브랜치 기준. Windows 데스크톱 앱(설치형)을 만들어 실제 사용하기 위한 절차.

## 결론

- 코드/Tauri 설정 변경 **불필요** — 소스·의존성이 전부 크로스플랫폼이고 macOS 전용 분기 없음. `main.rs`에 Windows subsystem 속성 존재. `icons/icon.ico` 존재. `bundle.targets: "all"` → Windows에서 **MSI + NSIS(.exe)** 설치파일 자동 생성.
- 빌드는 **Windows에서 네이티브로** 수행해야 함 (MSVC 링커는 Windows 전용). WSL Linux에서 .exe 산출 불가.

## 1) Windows 사전 설치

관리자 권한 PowerShell 권장.

| 항목 | 설치 | 비고 |
|---|---|---|
| Node.js 20/22 LTS | https://nodejs.org | |
| pnpm | `corepack enable` | Node에 동봉된 corepack 사용 |
| Rust (MSVC) | https://rustup.rs (`rustup-init.exe`) | 기본 `x86_64-pc-windows-msvc` 툴체인 |
| VS C++ Build Tools | "Build Tools for Visual Studio" → **Desktop development with C++** 워크로드 | MSVC 링커 + Windows SDK. 2~6GB, 관리자 권한 |
| WebView2 Runtime | Win11/대부분 Win10 기본 탑재 | 없으면 MS Evergreen Runtime 설치 |

설치 확인 (PowerShell):
```powershell
node -v ; pnpm -v ; rustc --version ; cargo --version
```

## 2) 코드 받기

```powershell
git clone https://github.com/sangchul-moon/happy.git
cd happy
git checkout migration/upstream-sync
```

## 3) 의존성 설치 (웹 클라이언트만)

> Linux에서 만든 node_modules는 재사용 불가 — Windows에서 새로 설치해야 함(네이티브 모듈 재빌드).

```powershell
pnpm install --filter "happy-app..."
```

## 4) 서버 URL 지정

`packages\happy-app\.env` 생성, 한 줄:
```
EXPO_PUBLIC_HAPPY_SERVER_URL=https://loupect.com:63000
```

## 5) Windows 설치파일 빌드

```powershell
pnpm --filter happy-app run tauri:build:production
```

- 내부적으로 `beforeBuildCommand`가 웹 프론트엔드를 `dist`로 export 후 Tauri가 네이티브 번들 생성.
- 첫 빌드는 Rust 의존성 컴파일로 수 분~십수 분 소요.

## 6) 산출물 위치

```
packages\happy-app\src-tauri\target\release\bundle\
  ├─ msi\Happy_0.1.0_x64_en-US.msi      ← MSI 설치파일
  └─ nsis\Happy_0.1.0_x64-setup.exe     ← NSIS 설치파일(.exe)
```

둘 중 하나를 더블클릭해 설치 → 시작 메뉴에서 "Happy" 실행. 앱이 `loupect.com:63000`에 연결되며, QR/링크로 페어링 후 파일 송수신 사용.

## 참고

- 빌드 산출 버전은 `src-tauri/tauri.conf.json`의 `version`(현재 0.1.0) 기준.
- 서명되지 않은 설치파일이라 SmartScreen 경고가 뜰 수 있음("추가 정보 → 실행").
- macOS 서명 블록(`bundle.macOS`)은 Windows 빌드에서 무시됨.
- 빌드 중 `__TAURI_BUNDLE_TYPE variable not found` 경고가 뜨지만 무해함(자동 업데이트 플러그인용, 우리 용도와 무관).

## 실제 빌드에서 마주친 Windows 고유 이슈 (해결법)

이 절차로 실제 빌드(2026-06-09)를 검증하며 겪은 문제들:

1. **의존성 postinstall이 Unix 명령(`rm`, `tar`) 사용 → 실패**
   - `@shopify/react-native-skia`가 `rm -rf`, `@more-tech/react-native-libsodium`가 `tar`를 호출하는데 cmd엔 없음.
   - 해결: **Git for Windows의 unix 도구를 PATH 앞에 추가**. `pnpm install` / `tauri build` 실행 전:
     ```powershell
     $env:Path = "C:\Program Files\Git\usr\bin;" + $env:Path
     ```

2. **`corepack enable`가 Program Files 권한으로 실패(EPERM)**
   - 관리자 없이: 쓰기 가능한 사용자 디렉터리에 심 설치 후 PATH 추가.
     ```powershell
     corepack enable --install-directory "$env:USERPROFILE\.corepack-bin"
     $env:Path = "$env:USERPROFILE\.corepack-bin;" + $env:Path
     ```

3. **PowerShell 실행 정책이 `pnpm.ps1` 차단**
   - `powershell.exe -ExecutionPolicy Bypass ...`로 실행하거나, 세션에서 `Set-ExecutionPolicy -Scope Process Bypass`.

4. **WSL 파일시스템(`\\wsl.localhost\...`)에서 빌드 금지**
   - cargo/MSVC가 UNC 경로 미지원. 반드시 네이티브 `C:\` 경로에서 빌드.

5. **node_modules는 OS별로 새로 설치**
   - Linux에서 만든 node_modules 재사용 불가(네이티브 모듈). Windows에서 `pnpm install` 새로 수행.

### 검증된 통합 빌드 명령 (단일 PowerShell 세션)

```powershell
$env:Path = "$env:USERPROFILE\.corepack-bin;C:\Program Files\Git\usr\bin;$env:USERPROFILE\.cargo\bin;" + $env:Path
Set-Location C:\Users\ENCAR\happy   # 네이티브 C:\ 경로
corepack enable --install-directory "$env:USERPROFILE\.corepack-bin"
pnpm install --filter "happy-app..."
pnpm --filter happy-app run tauri:build:production
```
(powershell.exe는 `-ExecutionPolicy Bypass`로 기동)
