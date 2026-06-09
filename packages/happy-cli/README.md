# Happy

Code on the go — control AI coding agents from your phone, browser, or terminal.

Free. Open source. Code anywhere.

## Installation

```bash
npm install -g happy
```

> Migrated from the `happy-coder` package. Thanks to [@franciscop](https://github.com/franciscop) for donating the `happy` package name!

## 다른 컴퓨터에 설치 (이 포크 빌드)

위의 `npm install -g happy`는 **공식 패키지**라, 이 포크의 커스텀 기능
(클라이언트↔CLI **파일 송수신** `uploadFile` 핸들러 등)이 들어있지 않습니다.
그 기능까지 쓰려면 **소스에서 빌드해서 설치**하세요.

### 사전 준비물
- **Node.js 20 또는 22 LTS**
- **pnpm 10.11** — `corepack enable`
- **Git**

### 설치 단계

```bash
git clone https://github.com/sangchul-moon/happy.git
cd happy
git checkout migration/upstream-sync
corepack enable

# CLI + happy-wire 만 설치 (앱/서버 패키지 제외 — 더 가벼움)
pnpm install --filter "happy..."

# CLI 빌드
pnpm --filter happy build

# 전역 명령으로 링크 (happy, happy-mcp 생성)
cd packages/happy-cli
npm link
```

> `npm link`는 이 저장소 폴더를 가리키는 심볼릭 링크입니다 — 저장소를 지우거나
> 옮기지 마세요. (CLI가 워크스페이스 의존 `@slopus/happy-wire`를 쓰기 때문에
> tarball이나 `npm i -g .` 방식은 안 되고 `npm link`를 써야 합니다.)

확인:

```bash
which happy
happy doctor   # CLI 버전과 실행 경로 표시
```

### 서버 지정

CLI가 붙을 서버를 지정합니다 (우선순위: 환경변수 > `settings.json` > 기본값):

```bash
# 방법 1) 셸 프로필에 환경변수 (~/.zshrc, ~/.bashrc 등)
export HAPPY_SERVER_URL="https://loupect.com:63000"
```

또는 `~/.happy/settings.json`에 `"serverUrl": "https://loupect.com:63000"` 추가.
생략하면 공식 클라우드 서버를 사용합니다.

### 사용

```bash
happy            # = happy claude
happy codex
```

처음 실행하면 QR/링크로 앱·웹 클라이언트와 페어링합니다.

### 업데이트 / 제거

```bash
# 최신 받아 재빌드 (전역 링크는 그대로 유지됨)
git pull && pnpm install --filter "happy..." && pnpm --filter happy build

# 제거
npm rm -g happy
```

### Windows 참고
- 동일하게 동작합니다(직접적인 네이티브 빌드 의존 없음).
- 환경변수는 PowerShell에서 `setx HAPPY_SERVER_URL "https://loupect.com:63000"`
  (새 터미널부터 적용) 또는 시스템 환경변수로 설정하세요.

## Usage

### Claude Code (default)

```bash
happy
# or
happy claude
```

This will:
1. Start a Claude Code session
2. Display a QR code to connect from your mobile device or browser
3. Allow real-time session control — all communication is end-to-end encrypted
4. Start new sessions directly from your phone or web while your computer is online

### More agents

```
happy codex
happy gemini
happy openclaw

# or any ACP-compatible CLI
happy acp opencode
happy acp -- custom-agent --flag
```

## Daemon

The daemon is a background service that stays running on your machine. It lets you spawn and manage coding sessions remotely — from your phone or the web app — without needing an open terminal.

```bash
happy daemon start
happy daemon stop
happy daemon status
happy daemon list
```

The daemon starts automatically when you run `happy`, so you usually don't need to manage it manually.

### Keeping the daemon running across reboots

If you want the daemon to come back automatically after a reboot — without opening a `happy` session first — start it from your shell profile so it inherits your normal user session context (PATH, keychain access, OAuth credentials):

```bash
# ~/.zshrc or ~/.bashrc
if [[ -o interactive ]] && [[ -z "$HAPPY_DAEMON_CHECKED" ]]; then
    export HAPPY_DAEMON_CHECKED=1
    () {
        local state=$HOME/.happy/daemon.state.json
        local pid=$(grep -oE '"pid"[[:space:]]*:[[:space:]]*[0-9]+' "$state" 2>/dev/null | grep -oE '[0-9]+')
        if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then
            happy daemon start >/dev/null 2>&1
        fi
    } &!
fi
```

The first interactive shell after a reboot triggers the start; subsequent shells short-circuit because the daemon is already running.

> **macOS users:** prefer this shell-init approach over a `launchd` LaunchAgent. A LaunchAgent runs in an agent domain that is **detached from your GUI/Aqua login session**, which means the bundled `claude-agent-sdk` cannot reach the macOS keychain and silently fails authentication ("Failed to authenticate. API Error: 401 terminated", `duration_api_ms: 0`). If you must use launchd, your wrapper has to read the OAuth access token from `~/.claude/.credentials.json` and export it as `CLAUDE_CODE_OAUTH_TOKEN` before exec'ing the daemon — and you'll need to handle token rotation yourself.

## Authentication

```bash
happy auth login
happy auth logout
```

Happy uses cryptographic key pairs for authentication — your private key stays on your machine. All session data is end-to-end encrypted before leaving your device.

To connect third-party agent APIs:

```bash
happy connect gemini
happy connect claude
happy connect codex
happy connect status
```

## Commands

| Command | Description |
|---------|-------------|
| `happy` | Start Claude Code session (default) |
| `happy codex` | Start Codex mode |
| `happy gemini` | Start Gemini CLI session |
| `happy openclaw` | Start OpenClaw session |
| `happy acp` | Start any ACP-compatible agent |
| `happy resume <id>` | Resume a previous session |
| `happy notify` | Send push notification to your devices |
| `happy doctor` | Diagnostics & troubleshooting |

---

## Advanced

### Environment Variables

| Variable | Description |
|----------|-------------|
| `HAPPY_SERVER_URL` | Custom server URL (default: `https://api.cluster-fluster.com`) |
| `HAPPY_WEBAPP_URL` | Custom web app URL (default: `https://app.happy.engineering`) |
| `HAPPY_HOME_DIR` | Custom home directory for Happy data (default: `~/.happy`) |
| `HAPPY_DISABLE_CAFFEINATE` | Disable macOS sleep prevention |
| `HAPPY_EXPERIMENTAL` | Enable experimental features |

### Sandbox (experimental)

Happy can run agents inside an OS-level sandbox to restrict file system and network access.

```bash
happy sandbox configure
happy sandbox status
happy sandbox disable
```

### Building from source

```bash
git clone https://github.com/slopus/happy
cd happy-cli
yarn install
yarn workspace happy cli --help
```

## Requirements

- Node.js >= 20.0.0
- For Claude: `claude` CLI installed & logged in
- For Codex: `codex` CLI installed & logged in
- For Gemini: `npm install -g @google/gemini-cli` + `happy connect gemini`

## License

MIT
