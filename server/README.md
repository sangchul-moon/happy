# Happy Server

Minimal backend for open-source end-to-end encrypted Claude Code clients.

## What is Happy?

Happy Server is the synchronization backbone for secure Claude Code clients. It enables multiple devices to share encrypted conversations while maintaining complete privacy - the server never sees your messages, only encrypted blobs it cannot read.

## Features

- 🔐 **Zero Knowledge** - The server stores encrypted data but has no ability to decrypt it
- 🎯 **Minimal Surface** - Only essential features for secure sync, nothing more
- 🕵️ **Privacy First** - No analytics, no tracking, no data mining
- 📖 **Open Source** - Transparent implementation you can audit and self-host
- 🔑 **Cryptographic Auth** - No passwords stored, only public key signatures
- ⚡ **Real-time Sync** - WebSocket-based synchronization across all your devices
- 📱 **Multi-device** - Seamless session management across phones, tablets, and computers
- 🔔 **Push Notifications** - Notify when Claude Code finishes tasks or needs permissions (encrypted, we can't see the content)
- 🌐 **Distributed Ready** - Built to scale horizontally when needed

## How It Works

Your Claude Code clients generate encryption keys locally and use Happy Server as a secure relay. Messages are end-to-end encrypted before leaving your device. The server's job is simple: store encrypted blobs and sync them between your devices in real-time.

## Hosting

**You don't need to self-host!** Our free cloud Happy Server at `happy-api.slopus.com` is just as secure as running your own. Since all data is end-to-end encrypted before it reaches our servers, we literally cannot read your messages even if we wanted to. The encryption happens on your device, and only you have the keys.

That said, Happy Server is open source and self-hostable if you prefer running your own infrastructure. The security model is identical whether you use our servers or your own.

## Self-Hosting

### Prerequisites

- Docker & Docker Compose
- (For local development without Docker) Node.js >= 20, Yarn

### Quick Start with Docker Compose

This is the easiest way to run the entire stack (server + PostgreSQL + Redis + MinIO):

```bash
# 1. Create your environment file
cp .env.example .env

# 2. Edit .env with secure values
#    - POSTGRES_PASSWORD: strong database password
#    - HANDY_MASTER_SECRET: random secret key for server signing
#    - MINIO_ROOT_PASSWORD: strong MinIO password
#    - S3_PUBLIC_URL: public URL for file access (e.g. https://your-domain.com/s3/happy)

# 3. Create the external network (required by docker-compose)
docker network create proxy-network

# 4. Start all services
docker-compose up -d

# The server will automatically:
#   - Wait for PostgreSQL, Redis, and MinIO to be healthy
#   - Run database migrations (prisma migrate deploy)
#   - Start the API server on port 3005
```

### Environment Variables

| Variable | Description | Example |
|---|---|---|
| `POSTGRES_DB` | Database name | `happy` |
| `POSTGRES_USER` | Database user | `happy` |
| `POSTGRES_PASSWORD` | Database password | (generate a strong one) |
| `HANDY_MASTER_SECRET` | Server-side signing key | (generate a strong one) |
| `MINIO_ROOT_USER` | MinIO access key | `minioadmin` |
| `MINIO_ROOT_PASSWORD` | MinIO secret key | (generate a strong one) |
| `S3_PUBLIC_URL` | Public URL for uploaded files | `https://your-domain.com/s3/happy` |

### Architecture

```
                    ┌─────────────┐
Clients ──────────► │ Happy Server│ :3005
                    └──┬───┬───┬──┘
                       │   │   │
              ┌────────┘   │   └────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌─────────┐ ┌─────────┐
        │PostgreSQL│ │  Redis  │ │  MinIO  │
        │  :5432   │ │  :6379  │ │  :9000  │
        └──────────┘ └─────────┘ └─────────┘
```

- **PostgreSQL** - Stores encrypted user data, sessions, messages
- **Redis** - Pub/sub for real-time WebSocket sync across server instances
- **MinIO** - S3-compatible object storage for file uploads

### Local Development (without Docker)

Run each infrastructure service individually and the server with hot reload:

```bash
# 1. Start infrastructure services
yarn db       # PostgreSQL on :5432
yarn redis    # Redis on :6379
yarn s3       # MinIO on :9000 (console on :9001)
yarn s3:init  # Create the 'happy' bucket

# 2. Install dependencies
yarn install  # Also runs prisma generate via postinstall

# 3. Run database migrations
yarn migrate

# 4. Start the development server (hot reload)
yarn dev      # Server on :3005
```

### Database Management

```bash
yarn migrate        # Run pending migrations
yarn migrate:reset  # Reset database (WARNING: deletes all data)
yarn generate       # Regenerate Prisma client after schema changes
```

### Useful Scripts

| Script | Description |
|---|---|
| `yarn dev` | Start dev server with hot reload |
| `yarn start` | Start production server |
| `yarn build` | Type-check the project |
| `yarn test` | Run tests with Vitest |
| `yarn db` | Start PostgreSQL in Docker |
| `yarn redis` | Start Redis in Docker |
| `yarn s3` | Start MinIO in Docker |
| `yarn s3:down` | Stop MinIO container |

## License

MIT - Use it, modify it, deploy it anywhere.
