# HappyKimi Deployment Guide

> **Complete guide for deploying and running the Kimi-enabled Happy Coder system**

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [APK Installation on Android](#apk-installation-on-android)
5. [Testing the Setup](#testing-the-setup)
6. [Rollback / Reversal Procedure](#rollback--reversal-procedure)
7. [Troubleshooting](#troubleshooting)
8. [Reference](#reference)

---

## Overview

### What's New

This deployment adds **Kimi CLI support** to Happy Coder, allowing you to control Kimi sessions from your mobile device. Key differences from the original setup:

| Feature | Original Happy | Happy + Kimi |
|---------|---------------|--------------|
| Agent | Claude Code | Kimi CLI |
| VSCode Extension Conflicts | Yes (duplicate model use) | No |
| Launch Script | `/root/launch-all-happy.sh` | `/root/launch-happy-kimi.sh` |
| Session Name | `happy-persistent` | `happy-kimi` |
| Mobile App | Play Store version | Custom APK (Kimi-enabled) |

### Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Mobile App      │◄───►│  Relay Server    │◄───►│  Happy CLI       │
│  (Kimi APK)      │     │  (WebSocket)     │     │  (happy kimi)    │
└──────────────────┘     └──────────────────┘     └──────┬───────────┘
                                                         │
                                                  ┌──────▼───────────┐
                                                  │  Kimi CLI        │
                                                  │  (kimi acp)      │
                                                  └──────────────────┘
```

### Files Created

| File | Purpose |
|------|---------|
| `/root/launch-happy-kimi.sh` | New launcher for Kimi (doesn't replace existing) |
| `/root/happykimi/happy-preview.apk` | Kimi-enabled Android APK (271MB) |

---

## Prerequisites

### System Requirements

- **Node.js** 18+ 
- **Yarn** package manager
- **Docker & Docker Compose** (for relay server)
- **Kimi CLI** v1.6+ installed and authenticated
- **tmux** (for persistent sessions)

### Verify Prerequisites

```bash
# Check Node.js
node --version  # Should be 18+

# Check Yarn
yarn --version

# Check Docker
docker --version
docker compose version

# Check Kimi CLI
kimi --version  # Should show: kimi, version 1.x.x

# Check tmux
tmux -V
```

### Kimi Authentication

Before using `happy kimi`, you must authenticate:

```bash
kimi login
```

This opens a browser-based OAuth flow. Complete it before proceeding.

---

## Quick Start

### Step 1: Ensure Relay Server is Running

```bash
cd /root/happy-relay-server
docker compose up -d
docker compose ps  # Verify all 4 containers are healthy
```

### Step 2: Launch Happy + Kimi

**Using the new launcher (recommended):**

```bash
/root/launch-happy-kimi.sh
```

This creates a new tmux session called `happy-kimi` that:
- Uses Kimi CLI instead of Claude Code
- Auto-restarts if it crashes
- Runs separately from any existing Happy sessions

**Manual launch (alternative):**

```bash
tmux new-session -s happy-kimi
export HAPPY_RELAY_URL=http://localhost:3000
cd /root/happykimi/packages/happy-cli
./bin/happy.mjs kimi
```

### Step 3: Scan QR Code

1. Open the Happy app on your Android device
2. Tap "Scan QR Code"
3. Point your camera at the QR code in the terminal
4. The app will connect to your Kimi session

### Step 4: Start Using Kimi from Mobile

- Send messages from the mobile app
- Approve/deny tool calls
- Switch between sessions by swiping

---

## APK Installation on Android

### APK Location

The Kimi-enabled APK is located at:
```
/root/happykimi/happy-preview.apk
```

**Size:** ~271MB  
**Build URL:** https://expo.dev/accounts/valtterimelkko/projects/happy/builds/aa8308af-b246-4778-8c24-46b90fbb5069

### Method 1: ADB Install (Recommended)

```bash
# Connect your Android device via USB (enable USB debugging)
adb devices

# Install the APK
adb install /root/happykimi/happy-preview.apk

# Or reinstall (if updating)
adb install -r /root/happykimi/happy-preview.apk
```

### Method 2: Direct Transfer

1. Transfer the APK to your device:
   ```bash
   # Using scp to device
   scp /root/happykimi/happy-preview.apk user@device:/sdcard/Download/
   
   # Or using adb push
   adb push /root/happykimi/happy-preview.apk /sdcard/Download/
   ```

2. On your Android device:
   - Open File Manager
   - Navigate to Downloads
   - Tap the APK file
   - Enable "Install from Unknown Sources" if prompted
   - Tap "Install"

### Method 3: Download from Expo (Alternative)

If you have Expo account access:

1. Open the build URL in a browser:
   ```
   https://expo.dev/accounts/valtterimelkko/projects/happy/builds/aa8308af-b246-4778-8c24-46b90fbb5069
   ```

2. Download the APK directly to your device

3. Open and install

### Verifying APK Installation

After installation, verify the app has Kimi support:

1. Open the Happy app
2. Tap "New Session" or "+"
3. The agent selector should show: **Claude**, **Codex**, **Gemini**, and **Kimi**
4. If Kimi appears, the APK is correctly installed

---

## Testing the Setup

### Test 1: Verify CLI Build

```bash
cd /root/happykimi/packages/happy-cli
yarn build
./bin/happy.mjs --help | grep kimi  # Should show kimi command
```

### Test 2: Verify Kimi Command

```bash
cd /root/happykimi/packages/happy-cli
./bin/happy.mjs kimi --help
```

Expected output should show Kimi usage information.

### Test 3: Run Unit Tests

```bash
# CLI tests
cd /root/happykimi/packages/happy-cli
yarn test

# Mobile app tests  
cd /root/happykimi/packages/happy-app
yarn test
```

Expected: All tests pass (335 CLI tests, 445 mobile tests)

### Test 4: Launch and Connect

1. Start the session:
   ```bash
   /root/launch-happy-kimi.sh
   ```

2. Verify QR code appears in terminal

3. Scan with mobile app

4. Send a test message: "Hello, can you help me with a simple task?"

5. Verify response appears on mobile

### Test 5: Permission Handling

1. From mobile, ask Kimi to create a file:
   ```
   "Please create a file called test.txt with content 'Hello World'"
   ```

2. A permission request should appear on mobile

3. Tap "Approve" and verify the file is created

### Test 6: Session Persistence

1. Detach from tmux: `Ctrl+b, then d`

2. Verify mobile app still works

3. Reattach: `tmux attach-session -t happy-kimi`

4. Verify session is still active

---

## Rollback / Reversal Procedure

### Scenario 1: Keep Both Systems (Recommended)

You can run both the original Happy (Claude Code) and the new Happy + Kimi simultaneously:

```bash
# Original Happy (Claude Code) - existing session
tmux attach-session -t happy-persistent

# New Happy + Kimi - new session
/root/launch-happy-kimi.sh
```

Both sessions can run concurrently. Use different tmux session names to switch between them.

### Scenario 2: Stop Only Kimi Session

```bash
# Kill the Kimi session
tmux kill-session -t happy-kimi
```

The original `happy-persistent` session remains untouched.

### Scenario 3: Revert to Original Mobile App

If you want to use the original Happy app from Play Store:

1. Uninstall the Kimi-enabled APK:
   - Settings → Apps → Happy → Uninstall

2. Install original from Play Store:
   - Search "Happy Coder" in Google Play
   - Install

3. Note: The original app won't show Kimi as an agent option

### Scenario 4: Full Rollback

To completely remove the Kimi-enabled setup:

```bash
# 1. Kill the Kimi session
tmux kill-session -t happy-kimi 2>/dev/null

# 2. Remove the launch script (optional)
rm /root/launch-happy-kimi.sh

# 3. The original happy-persistent session continues working
tmux attach-session -t happy-persistent
```

**Note:** The happykimi source code and APK are in `/root/happykimi/` and don't affect the original Happy installation.

### What Cannot Be Reversed

- The APK on your phone needs manual uninstallation
- Any Kimi sessions created are stored in `~/.kimi/sessions/`

---

## Troubleshooting

### "kimi: command not found"

**Cause:** Kimi CLI not in PATH

**Solution:**
```bash
# Add to PATH
export PATH="$HOME/.local/bin:$PATH"

# Or install Kimi CLI
pip install kimi-cli
```

### "Not authenticated. Please run 'kimi login' first"

**Cause:** Kimi CLI requires authentication

**Solution:**
```bash
kimi login
# Follow the browser OAuth flow
```

### QR Code Not Displaying

**Cause:** Relay server not running or session not started

**Solution:**
```bash
# Check relay
curl http://localhost:3000/health

# If not running
cd /root/happy-relay-server
docker compose up -d

# Check session
tmux attach-session -t happy-kimi
```

### Mobile App Can't Connect

**Cause:** Network/firewall issues

**Solution:**
1. Verify relay is accessible: `curl http://localhost:3000/health`
2. Check phone is on same network (or Tailscale VPN)
3. Verify CORS settings in `/root/happy-relay-server/.env`

### "Kimi CLI not detected on machine"

**Cause:** Mobile app can't detect Kimi on the connected machine

**Solution:**
1. Ensure `happy kimi` is running
2. Check Kimi CLI is installed: `kimi --version`
3. Verify PATH includes kimi: `which kimi`

### APK Install Blocked

**Cause:** Android security settings

**Solution:**
1. Settings → Security
2. Enable "Install from Unknown Sources"
3. Or use `adb install` with USB debugging

### Session Crashes Repeatedly

**Cause:** Build error or dependency issue

**Solution:**
```bash
# Rebuild CLI
cd /root/happykimi/packages/happy-cli
yarn install
yarn build

# Check for errors
./bin/happy.mjs kimi --help
```

---

## Reference

### File Locations

| Item | Path |
|------|------|
| Kimi Launch Script | `/root/launch-happy-kimi.sh` |
| Original Launch Script | `/root/launch-all-happy.sh` |
| HappyKimi Source | `/root/happykimi/` |
| Kimi-enabled APK | `/root/happykimi/happy-preview.apk` |
| Relay Server | `/root/happy-relay-server/` |
| Happy CLI Source | `/root/happykimi/packages/happy-cli/` |
| Happy App Source | `/root/happykimi/packages/happy-app/` |

### Tmux Sessions

| Session | Purpose | Agent |
|---------|---------|-------|
| `happy-persistent` | Original Happy | Claude Code |
| `happy-kimi` | New Happy + Kimi | Kimi CLI |

### Useful Commands

```bash
# List all tmux sessions
tmux list-sessions

# Attach to Kimi session
tmux attach-session -t happy-kimi

# Attach to original session
tmux attach-session -t happy-persistent

# Kill Kimi session
tmux kill-session -t happy-kimi

# Detach from session
Ctrl+b, then d

# Check relay health
curl http://localhost:3000/health

# View relay logs
cd /root/happy-relay-server && docker compose logs -f happy-server
```

### Environment Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `HAPPY_RELAY_URL` | `http://localhost:3000` | Relay server URL |
| `PATH` | includes `/root/.local/bin` | Kimi CLI location |

---

## Support

- **HappyKimi Documentation:** `/root/happykimi/happykimi-transition/README.md`
- **Progress Tracking:** `/root/happykimi/happykimi-transition/PROGRESS.md`
- **PRD:** `/root/happykimi/happykimi-transition/PRD.md`
- **Relay Server Docs:** `/root/happy-relay-server/README.md`
- **Usage Guide:** `/root/happy-relay-server/HAPPY_USAGE.md`
