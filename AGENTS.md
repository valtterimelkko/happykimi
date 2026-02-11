# Happy Coder - AI Agent Development Guide

> **🚧 ACTIVE TRANSITION: HappyKimi Integration**
> 
> This codebase is currently undergoing a transition to add **Kimi Code CLI** as a supported AI agent alongside Claude, Codex, and Gemini.
> 
> **Transition Overview:**
> - **Phase 1 (CLI)**: Add `happy kimi` command to spawn and control Kimi sessions via the CLI
> - **Phase 2 (Mobile App)**: Add Kimi as an agent option in the mobile app, with CLI detection and APK build
> 
> **Key Documents:**
> - [`happykimi-transition/INTENT.md`](happykimi-transition/INTENT.md) - User intent and feasibility analysis
> - [`happykimi-transition/PRD.md`](happykimi-transition/PRD.md) - Detailed PRD with 15 modules, dependency graph, and verification checklists
> - [`happykimi-transition/README.md`](happykimi-transition/README.md) - User-facing documentation (installation, usage, troubleshooting)
> 
> The transition follows Happy's existing multi-provider architecture. See the PRD for module breakdowns, parallelization strategy, and file patterns to follow.

---

## Project Overview

**Happy Coder** is a three-component system that wraps Claude Code and Codex to enable remote control from mobile devices:

1. **happy-app** - React Native mobile app (iOS/Android) + web client + macOS desktop (Tauri)
2. **happy-cli** - Command-line interface that wraps Claude Code and Codex
3. **happy-server** - Backend server for encrypted sync and real-time communication

## Repository Structure

```
packages/
├── happy-app/      # React Native app with Expo SDK 54
├── happy-cli/      # Node.js CLI tool
└── happy-server/   # Node.js Fastify server
```

## Technology Stack

- **Package Manager**: Yarn 1.22.22
- **TypeScript**: 5.9.3 with strict mode
- **Socket.IO**: Real-time WebSocket communication
- **Encryption**: libsodium/TweetNaCl

### happy-app
- React Native 0.81.4 + Expo SDK 54
- Expo Router v6, React Native Unistyles
- Testing: Vitest

### happy-cli
- Node.js 20+, pkgroll for bundling
- Ink (React for CLI) + chalk
- Testing: Vitest with real API calls

### happy-server
- Fastify 5 + Prisma ORM 6.11.1
- PostgreSQL, Redis, MinIO

## Build Commands

```bash
# Root
yarn install

# happy-app
yarn start          # Expo dev server
yarn android        # Android emulator
yarn ios            # iOS simulator
yarn tauri:dev      # macOS desktop

# happy-cli
yarn build          # Build CLI
yarn test           # Run tests

# happy-server
yarn dev            # Dev with hot reload
yarn db             # Start PostgreSQL
yarn redis          # Start Redis
yarn migrate        # Run migrations
```

## Code Style

- **Indentation**: 4 spaces
- **Imports**: Use `@/` alias for package-relative imports
- **Prefer interfaces over types**
- **Avoid enums**: Use maps
- **Avoid classes**: Use functional patterns

### Error Handling
- Graceful error handling with specific messages
- Use `try-catch` with proper logging

## Internationalization

**Always use `t(...)` for user-visible strings:**

```typescript
import { t } from '@/text';
t('common.cancel')
```

Add to ALL language files in `packages/happy-app/sources/text/translations/`.

## Key Files

### happy-app
- `sources/app/` - Expo Router screens
- `sources/sync/` - Real-time sync engine
- `sources/auth/` - QR-based authentication

### happy-cli
- `src/claude/`, `src/codex/`, `src/gemini/` - Agent integrations
- `src/agent/` - Agent protocol handlers
- `src/daemon/` - Background service

### happy-server
- `sources/app/api/` - API routes
- `prisma/` - Database schema

## License

MIT License - See LICENSE file for details.
