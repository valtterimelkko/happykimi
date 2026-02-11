# HappyKimi Transition

This document describes the integration of **Kimi Code CLI** into the Happy ecosystem, enabling users to control Kimi sessions from the Happy mobile app alongside Claude, Codex, and Gemini.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [CLI Installation](#cli-installation)
3. [Mobile App Build Instructions](#mobile-app-build-instructions)
4. [APK Installation on Android](#apk-installation-on-android)
5. [Usage Guide](#usage-guide)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

- **Node.js** 18+ (for CLI and mobile app development)
- **Yarn** package manager
- **Docker & Docker Compose** (for relay server)
- **Git** (for cloning the repository)
- **Kimi CLI** v1.6+ installed globally

### Kimi CLI Installation

```bash
# Install Kimi CLI via pip (recommended)
pip install kimi-cli

# Or install from source
git clone https://github.com/moonshot-ai/Kimi-AI-CLI.git
cd Kimi-AI-CLI
pip install -e .

# Verify installation
kimi --version  # Should show: kimi-cli version: 1.6
```

### Authentication

Before using `happy kimi`, you must authenticate Kimi CLI directly:

```bash
kimi login
```

This opens a browser-based OAuth flow. Once authenticated, Kimi CLI stores credentials locally.

**Note**: Happy does not store or manage Kimi credentials - authentication is handled entirely by Kimi CLI.

---

## CLI Installation

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd happykimi

# Install dependencies
yarn install

# Build the CLI
cd packages/happy-cli
yarn build
```

### 2. Link CLI (Development)

```bash
# From packages/happy-cli directory
yarn link

# Or use directly via npx
npx ./bin/happy.mjs kimi
```

### 3. Verify Installation

```bash
# Show help
./bin/happy.mjs --help

# Check kimi command is available
./bin/happy.mjs kimi --help
```

---

## Mobile App Build Instructions

### Using EAS Build (Recommended)

The project uses **EAS Build** (Expo Application Services) for cloud-based Android builds. This avoids local disk space constraints (~20GB for native compilation).

#### Prerequisites

- **EAS CLI**: `npm install -g eas-cli`
- **Expo Account**: Sign up at https://expo.dev
- **EXPO_TOKEN** (optional): For CI/automation

#### Build Steps

```bash
cd packages/happy-app

# 1. Prebuild native project (generates android/ folder)
yarn prebuild

# 2. Initialize Expo project (one-time setup)
eas project:init --force

# 3. Build preview APK with EAS
eas build --platform android --profile preview --wait

# 4. Download the APK from the provided URL
```

#### Build Profiles

| Profile | Use Case | Signed |
|---------|----------|--------|
| `preview` | Development/testing | No |
| `production` | Release distribution | Yes |

### Local Build Alternative

If you prefer building locally (requires Android SDK):

```bash
cd packages/happy-app/android
./gradlew assembleRelease

# APK location: android/app/build/outputs/apk/release/app-release.apk
```

**⚠️ Note**: Local builds require significant disk space (~20GB) for native compilation.

---

## APK Installation on Android

### Method 1: Direct Download (EAS Build)

1. Open the build URL from EAS (e.g., `https://expo.dev/accounts/.../builds/...`)
2. Download the APK file
3. Transfer to your Android device
4. Open the APK file on device to install

### Method 2: ADB Install (Development)

```bash
# Connect device via USB (enable USB debugging)
adb devices

# Install APK
adb install <path-to-apk>

# Or reinstall/upgrade
adb install -r <path-to-apk>
```

### Method 3: Expo Go (Development)

For development without building APK:

```bash
cd packages/happy-app
yarn start

# Scan QR code with Expo Go app
```

### Pre-built APK

The latest preview APK is available at:
- **Location**: `/root/happykimi/happy-preview.apk`
- **Size**: ~271MB
- **Build URL**: https://expo.dev/accounts/valtterimelkko/projects/happy/builds/aa8308af-b246-4778-8c24-46b90fbb5069

---

## Usage Guide

### Starting a Kimi Session

#### From CLI

```bash
# Start interactive Kimi session
happy kimi

# With specific model
happy kimi --model kimi-latest

# With permission mode
happy kimi --yolo              # Auto-approve all
happy kimi --safe-yolo         # Auto-approve safe operations
happy kimi --read-only         # Read-only mode
```

#### Model Management

```bash
# Set default model
happy kimi model set kimi-latest

# Get current model
happy kimi model get

# List available models
happy kimi model
```

### Mobile App Usage

1. **Start CLI Session**:
   ```bash
   happy kimi
   ```

2. **Scan QR Code**: The CLI displays a QR code for mobile connection.

3. **Select Agent**: In the mobile app, choose "Kimi" from the agent selector.

4. **Send Messages**: Type messages in the mobile app - they are relayed to the Kimi CLI session.

5. **Approve Tool Calls**: Permission requests appear on mobile for approval/rejection.

### Permission Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `default` | Ask for each tool call | Development, safety-first |
| `yolo` | Auto-approve all | Trusted environments |
| `safe-yolo` | Auto-approve safe operations | Balance of speed & safety |
| `read-only` | No file modifications | Exploration, documentation |

### Session Persistence

- Sessions can be resumed with `--session <id>`
- Use `--continue` to resume the last session
- Sessions are stored in `~/.kimi/sessions/`

---

## Troubleshooting

### CLI Issues

#### "kimi: command not found"

**Cause**: Kimi CLI is not installed or not in PATH.

**Solution**:
```bash
# Verify installation
which kimi
kimi --version

# If not found, install:
pip install kimi-cli

# Ensure pip bin directory is in PATH
export PATH="$HOME/.local/bin:$PATH"
```

#### "Not authenticated. Please run 'kimi login' first"

**Cause**: Kimi CLI requires authentication.

**Solution**:
```bash
kimi login
# Follow the browser-based OAuth flow
```

#### Build failures in happy-cli

**Cause**: Missing dependencies or TypeScript errors.

**Solution**:
```bash
cd packages/happy-cli
yarn install
yarn build

# Check for type errors
yarn typecheck
```

### Mobile App Issues

#### "Kimi CLI not detected on machine"

**Cause**: Mobile app cannot detect Kimi CLI on the connected machine.

**Solution**:
1. Ensure `happy kimi` is running on the machine
2. Check network connectivity between phone and machine
3. Verify Kimi CLI is installed: `kimi --version`

#### APK installation blocked

**Cause**: Android security settings prevent unknown source installation.

**Solution**:
1. Go to Settings → Security
2. Enable "Install from Unknown Sources"
3. Or use `adb install` with developer mode enabled

#### Expo build fails

**Cause**: Invalid credentials or project configuration.

**Solution**:
```bash
# Clean and rebuild
cd packages/happy-app
rm -rf android/
yarn prebuild

# Verify eas.json configuration
cat eas.json

# Re-init project if needed
eas project:init --force
```

### Connection Issues

#### QR code not displaying

**Cause**: Relay server not running or CLI not connected.

**Solution**:
```bash
# Start relay server
cd /root/happy-relay-server
docker compose up -d

# Verify relay is running
docker compose ps
```

#### Mobile app cannot connect

**Cause**: Network/firewall blocking connection to relay server.

**Solution**:
1. Verify relay server is accessible: `curl http://localhost:3000/health`
2. Check firewall rules for port 3000
3. Ensure phone and machine are on same network (or use public relay)

### Permission Issues

#### Tool calls not appearing on mobile

**Cause**: Permission handler not properly configured.

**Solution**:
1. Check CLI logs for errors
2. Verify permission mode is set correctly
3. Restart session with explicit permission mode: `happy kimi --yolo`

---

## Architecture Overview

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Mobile App  │◄───►│ Relay Server │◄───►│  Happy CLI   │
│  (React Native)│    │  (WebSocket) │    │  (Kimi ACP)  │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                           ┌──────▼───────┐
                                           │  Kimi CLI    │
                                           │  (kimi acp)  │
                                           └──────────────┘
```

### Key Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| happy-cli | TypeScript/Node.js | CLI interface, session management |
| happy-app | React Native/Expo | Mobile UI for agent control |
| happy-server | Fastify/Prisma | Backend API (optional) |
| Relay Server | WebSocket | Real-time mobile-CLI communication |
| Kimi CLI | Python | AI agent execution |

---

## Development

### Running Tests

```bash
# CLI tests
cd packages/happy-cli
yarn test

# Mobile app tests
cd packages/happy-app
yarn test
```

### Project Structure

```
packages/
├── happy-cli/          # TypeScript CLI
│   ├── src/kimi/       # Kimi-specific code
│   ├── src/agent/      # Agent backend & transport
│   └── src/ui/ink/     # Terminal UI components
├── happy-app/          # React Native mobile app
│   ├── sources/        # App source code
│   └── __tests__/      # Test files
└── happy-server/       # Fastify backend (optional)
```

---

## Resources

- **Kimi CLI Docs**: https://github.com/moonshot-ai/Kimi-AI-CLI
- **Expo Docs**: https://docs.expo.dev
- **Happy Project**: See main repository README

---

## License

See [LICENCE](../LICENCE) file in the project root.
