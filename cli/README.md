# Happy

Code on the go — control AI coding agents from your mobile device.

Free. Open source. Code anywhere.

## Installation

```bash
npm install -g happy-coder
```

## Usage

### Claude (default)

```bash
happy
```

This will:
1. Start a Claude Code session
2. Display a QR code to connect from your mobile device
3. Allow real-time session sharing between Claude Code and your mobile app

### Gemini

```bash
happy gemini
```

Start a Gemini CLI session with remote control capabilities.

**First time setup:**
```bash
# Authenticate with Google
happy connect gemini
```

## Commands

### Main Commands

- `happy` – Start Claude Code session (default)
- `happy gemini` – Start Gemini CLI session
- `happy codex` – Start Codex mode

### Utility Commands

- `happy auth` – Manage authentication
- `happy connect` – Store AI vendor API keys in Happy cloud
- `happy notify` – Send a push notification to your devices
- `happy daemon` – Manage background service
- `happy doctor` – System diagnostics & troubleshooting

### Connect Subcommands

```bash
happy connect gemini     # Authenticate with Google for Gemini
happy connect claude     # Authenticate with Anthropic
happy connect codex      # Authenticate with OpenAI
happy connect status     # Show connection status for all vendors
```

### Gemini Subcommands

```bash
happy gemini                      # Start Gemini session
happy gemini model set <model>    # Set default model
happy gemini model get            # Show current model
happy gemini project set <id>     # Set Google Cloud Project ID (for Workspace accounts)
happy gemini project get          # Show current Google Cloud Project ID
```

**Available models:** `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`

## Options

### Claude Options

- `-m, --model <model>` - Claude model to use (default: sonnet)
- `-p, --permission-mode <mode>` - Permission mode: auto, default, or plan
- `--claude-env KEY=VALUE` - Set environment variable for Claude Code
- `--claude-arg ARG` - Pass additional argument to Claude CLI

### Global Options

- `-h, --help` - Show help
- `-v, --version` - Show version

## Environment Variables

### Happy Configuration

- `HAPPY_SERVER_URL` - Custom server URL (default: https://api.cluster-fluster.com)
- `HAPPY_WEBAPP_URL` - Custom web app URL (default: https://app.happy.engineering)
- `HAPPY_HOME_DIR` - Custom home directory for Happy data (default: ~/.happy)
- `HAPPY_DISABLE_CAFFEINATE` - Disable macOS sleep prevention (set to `true`, `1`, or `yes`)
- `HAPPY_EXPERIMENTAL` - Enable experimental features (set to `true`, `1`, or `yes`)

### Gemini Configuration

- `GEMINI_MODEL` - Override default Gemini model
- `GOOGLE_CLOUD_PROJECT` - Google Cloud Project ID (required for Workspace accounts)

## Gemini Authentication

### Personal Google Account

Personal Gmail accounts work out of the box:

```bash
happy connect gemini
happy gemini
```

### Google Workspace Account

Google Workspace (organization) accounts require a Google Cloud Project:

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Gemini API
3. Set the project ID:

```bash
happy gemini project set your-project-id
```

Or use environment variable:
```bash
GOOGLE_CLOUD_PROJECT=your-project-id happy gemini
```

**Guide:** https://goo.gle/gemini-cli-auth-docs#workspace-gca

## Build from Source

If you want to build and run the CLI from the monorepo source (e.g. for self-hosting or development):

### Prerequisites

- Node.js >= 20.0.0
- Yarn
- Claude CLI installed & logged in (`claude` command available in PATH)
- (For Gemini) Gemini CLI installed (`npm install -g @google/gemini-cli`)

### Build & Run

```bash
cd cli
yarn install
yarn build
yarn start        # Build and run
```

### Connect to a Self-Hosted Server

Create a `.env.dev-local-server` file (or edit the existing one):

```env
HAPPY_HOME_DIR=~/.happy-dev
HAPPY_SERVER_URL=http://localhost:3005
HAPPY_WEBAPP_URL=http://localhost:8081
DEBUG=1
NODE_NO_WARNINGS=1
```

Then run:

```bash
yarn dev:local-server
```

This uses a separate data directory (`~/.happy-dev`) so it won't conflict with your production Happy installation.

### Development Scripts

| Script | Description |
|---|---|
| `yarn build` | Build the project |
| `yarn start` | Build and run |
| `yarn dev` | Run without building (tsx, fast iteration) |
| `yarn dev:local-server` | Run connected to local server |
| `yarn typecheck` | TypeScript type checking |
| `yarn test` | Build and run tests |

### Daemon Management

The CLI can run a background daemon for persistent connections:

```bash
# Development variant
yarn dev:daemon:start
yarn dev:daemon:stop
yarn dev:daemon:status

# Stable variant
yarn stable:daemon:start
yarn stable:daemon:stop
yarn stable:daemon:status
```

### Create a Global Command

To create a `happy-dev` command that you can run from anywhere:

```bash
yarn link:dev      # Creates global 'happy-dev' command
yarn unlink:dev    # Removes it
```

## Contributing

Interested in contributing? See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
