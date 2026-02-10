# HappyKimi Transition PRD

## Executive Summary

This PRD outlines the integration of Kimi Code CLI into the Happy ecosystem, enabling users to control Kimi sessions from the mobile app alongside Claude, Codex, and Gemini. The project consists of two main phases:

- **Phase 1 (CLI)**: Add `happy kimi` command to spawn and control Kimi sessions
- **Phase 2 (Mobile App)**: Add Kimi as an agent option in the Happy mobile app, build APK for personal use

---

## Current State Analysis

### Environment Status
- **Kimi CLI**: v1.6 installed at `/root/.local/bin/kimi`
- **Happy CLI**: Not globally installed (source at `/root/happykimi`)
- **Happy Relay Server**: Running at `/root/happy-relay-server`
- **Testing Framework**: Vitest for CLI, Jest-Expo for mobile app

### Existing Architecture
The happykimi project is a Yarn workspace monorepo with 3 packages:
1. **happy-cli** (`packages/happy-cli`) - TypeScript Node.js CLI v0.14.0-0
2. **happy-app** (`packages/happy-app`) - React Native + Expo SDK 54 app
3. **happy-server** (`packages/happy-server`) - Fastify backend with Prisma

### Kimi CLI Capabilities
- MCP support: `--mcp-config-file` and `--mcp-config` flags
- Session management: `--session` (resume) and `--continue` flags
- JSON streaming: `--output-format stream-json` with `--print` mode
- Permission handling: `--yolo` (auto-approve all)
- ACP support: `kimi acp` subcommand
- Work directory: `--work-dir` flag

### Authentication Approach
**Decision**: Skip `happy connect kimi` integration. Users must authenticate Kimi CLI directly via `kimi login` before using `happy kimi`. This simplifies implementation and avoids cloud token storage complexity.

---

## Module Breakdown

### Module 0: Environment Setup & Dependencies
**Parallelizable**: Yes (Cloud Agent Compatible)
**Dependencies**: None
**Skills Needed**: `using-claudecodecli`

#### Tasks
1. Verify Kimi CLI installation and version
2. Install happy-cli development dependencies
3. Build happy-cli to ensure base version works
4. Verify relay server is running

#### Verification
```bash
kimi --version  # Should show: kimi-cli version: 1.6
cd /root/happykimi/packages/happy-cli && yarn build
docker compose -f /root/happy-relay-server/docker-compose.yml ps
```

---

### Module 1: Core Types & Constants (CLI)
**Parallelizable**: Yes (Cloud Agent Compatible)
**Dependencies**: None
**Skills Needed**: None

#### Files to Create

**1.1 `packages/happy-cli/src/kimi/constants.ts`**
```typescript
// Environment variable names
export const KIMI_API_KEY_ENV = 'KIMI_API_KEY';
export const KIMI_MODEL_ENV = 'KIMI_MODEL';
export const DEFAULT_KIMI_MODEL = 'kimi-latest';

// Reuse CHANGE_TITLE_INSTRUCTION from gemini/constants.ts
export { CHANGE_TITLE_INSTRUCTION } from '@/gemini/constants';
```

**1.2 `packages/happy-cli/src/kimi/types.ts`**
```typescript
import type { PermissionMode } from '@/api/types';

export interface KimiMode {
  permissionMode: PermissionMode;
  model?: string;
  originalUserMessage?: string;
}

export interface KimiMessagePayload {
  type: 'message';
  message: string;
  id: string;
  options?: string[];
}

export interface KimiSessionConfig {
  prompt: string;
  sandbox?: 'read-only' | 'workspace-write' | 'danger-full-access';
  'approval-policy'?: 'never' | 'untrusted' | 'on-failure' | 'on-request';
  model?: string;
  config?: {
    mcp_servers?: Record<string, { command: string; args?: string[] }>;
    experimental_resume?: string;
  };
}
```

**Pattern Reference**: `packages/happy-cli/src/gemini/types.ts`

---

### Module 2: Transport Handler (CLI)
**Parallelizable**: Yes (Cloud Agent Compatible)
**Dependencies**: Module 1
**Skills Needed**: None

#### Files to Create

**2.1 `packages/happy-cli/src/agent/transport/handlers/KimiTransport.ts`**

```typescript
import type { TransportHandler, ToolPattern } from '../TransportHandler';

export const KIMI_TIMEOUTS = {
  init: 60_000,        // 1 minute for startup
  toolCall: 120_000,   // 2 minutes for tool calls
  idle: 500,           // Idle detection
} as const;

export class KimiTransport implements TransportHandler {
  readonly agentName = 'kimi';

  getInitTimeout(): number { return KIMI_TIMEOUTS.init; }
  getToolCallTimeout(): number { return KIMI_TIMEOUTS.toolCall; }

  filterStdoutLine(line: string): string | null {
    const trimmed = line.trim();
    if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
      return null;
    }
    try {
      JSON.parse(trimmed);
      return line;
    } catch { return null; }
  }

  getToolPatterns(): ToolPattern[] {
    return [
      { name: 'change_title', patterns: ['change_title', 'happy__change_title'] },
      { name: 'think', patterns: ['think'] },
    ];
  }
}

export const kimiTransport = new KimiTransport();
```

**Pattern Reference**: `packages/happy-cli/src/agent/transport/handlers/GeminiTransport.ts`

---

### Module 3: Utility Classes (CLI)
**Parallelizable**: Yes (Cloud Agent Compatible)
**Dependencies**: Module 1
**Skills Needed**: None

#### Files to Create

**3.1 `packages/happy-cli/src/kimi/utils/config.ts`**
- `readKimiLocalConfig()` - Read from `~/.kimi/config.toml`
- `saveKimiModelToConfig()` - Save model preference
- `getInitialKimiModel()` - Model resolution priority
- Pattern: `packages/happy-cli/src/gemini/utils/config.ts`

**3.2 `packages/happy-cli/src/kimi/utils/permissionHandler.ts`**
```typescript
export class KimiPermissionHandler extends BasePermissionHandler {
  protected getLogPrefix(): string { return '[Kimi]'; }
  // Permission mode logic for yolo, safe-yolo, read-only, default
}
```
- Pattern: `packages/happy-cli/src/gemini/utils/permissionHandler.ts`

**3.3 `packages/happy-cli/src/kimi/utils/reasoningProcessor.ts`**
```typescript
export class KimiReasoningProcessor extends BaseReasoningProcessor {
  protected getToolName(): string { return 'KimiReasoning'; }
}
```
- Pattern: `packages/happy-cli/src/gemini/utils/reasoningProcessor.ts`

**3.4 `packages/happy-cli/src/kimi/utils/diffProcessor.ts`**
```typescript
export class KimiDiffProcessor extends BaseDiffProcessor {
  protected getToolName(): string { return 'KimiDiff'; }
}
```
- Pattern: `packages/happy-cli/src/gemini/utils/diffProcessor.ts`

---

### Module 4: Backend Factory (CLI)
**Parallelizable**: No
**Dependencies**: Modules 1, 2, 3
**Skills Needed**: None

#### Files to Create

**4.1 `packages/happy-cli/src/agent/factories/kimi.ts`**
```typescript
import { AcpBackend } from '../acp/AcpBackend';
import { kimiTransport } from '../transport/handlers/KimiTransport';
import { readKimiLocalConfig, getInitialKimiModel } from '@/kimi/utils/config';

export interface KimiBackendOptions {
  cwd: string;
  mcpServers?: Record<string, McpServerConfig>;
  permissionHandler?: AcpPermissionHandler;
  apiKey?: string;
  model?: string | null;
}

export interface KimiBackendResult {
  backend: AgentBackend;
  model: string;
  modelSource: 'explicit' | 'env-var' | 'local-config' | 'default';
}

export function createKimiBackend(options: KimiBackendOptions): KimiBackendResult {
  const model = options.model ?? getInitialKimiModel();

  const kimiCommand = 'kimi';
  const kimiArgs = ['acp'];  // Use kimi acp subcommand

  return {
    backend: new AcpBackend({
      agentName: 'kimi',
      cwd: options.cwd,
      command: kimiCommand,
      args: kimiArgs,
      env: { KIMI_MODEL: model },
      mcpServers: options.mcpServers,
      permissionHandler: options.permissionHandler,
      transportHandler: kimiTransport,
    }),
    model,
    modelSource: 'default',
  };
}
```

**Pattern Reference**: `packages/happy-cli/src/agent/factories/gemini.ts`

---

### Module 5: Ink UI Component (CLI)
**Parallelizable**: Yes (Cloud Agent Compatible)
**Dependencies**: Module 1
**Skills Needed**: None

#### Files to Create

**5.1 `packages/happy-cli/src/ui/ink/KimiDisplay.tsx`**
- React component for terminal UI
- Display status, messages, model info
- Handle Ctrl+C for exit
- Pattern: `packages/happy-cli/src/ui/ink/GeminiDisplay.tsx`

---

### Module 6: Main Entry Point (CLI)
**Parallelizable**: No
**Dependencies**: Modules 1-5
**Skills Needed**: None

#### Files to Create

**6.1 `packages/happy-cli/src/kimi/runKimi.ts`**
Main orchestration file (~1300 lines), following `runGemini.ts` pattern:

1. Session setup and authentication
2. Machine ID retrieval
3. Session creation with metadata
4. Message queue with mode handling
5. Happy MCP server startup
6. Backend creation with `createKimiBackend()`
7. Message handler for AgentMessage types
8. Main processing loop
9. Cleanup on exit

**Critical Pattern Reference**: `packages/happy-cli/src/gemini/runGemini.ts` (1327 lines)

---

### Module 7: CLI Integration (CLI)
**Parallelizable**: No
**Dependencies**: Module 6
**Skills Needed**: None

#### Files to Modify

**7.1 `packages/happy-cli/src/index.ts`**
Add kimi subcommand block after gemini section (lines 110-327):
```typescript
} else if (subcommand === 'kimi') {
  // Handle kimi subcommands (model set/get, project set/get)
  // Handle main kimi command
  const { runKimi } = await import('@/kimi/runKimi');
  const { credentials } = await authAndSetupMachineIfNeeded();
  // Auto-start daemon
  await runKimi({ credentials, startedBy });
  return;
}
```

**7.2 `packages/happy-cli/src/agent/core/AgentBackend.ts`**
Add 'kimi' to AgentId type (line 51):
```typescript
export type AgentId = 'claude' | 'codex' | 'gemini' | 'kimi' | 'opencode' | 'claude-acp' | 'codex-acp';
```

**7.3 Export Index Files**
- `packages/happy-cli/src/agent/transport/handlers/index.ts` - Export kimiTransport
- `packages/happy-cli/src/agent/factories/index.ts` - Export createKimiBackend

---

### Module 8: CLI Tests
**Parallelizable**: Yes (Cloud Agent Compatible)
**Dependencies**: Modules 1-7
**Skills Needed**: None

#### Files to Create

**8.1 Unit Tests**
- `src/kimi/utils/__tests__/config.test.ts`
- `src/kimi/utils/__tests__/permissionHandler.test.ts`
- `src/kimi/__tests__/emitReadyIfIdle.test.ts`
- `src/agent/transport/handlers/__tests__/KimiTransport.test.ts`

**8.2 Integration Tests**
- `src/kimi/__tests__/runKimi.integration.test.ts`
  - Mock Kimi process spawning
  - Test message flow
  - Test permission handling

**Testing Framework**: Vitest (already configured)

---

### Module 9: Mobile App Type Updates
**Parallelizable**: Yes (Cloud Agent Compatible)
**Dependencies**: None (can start parallel with CLI)
**Skills Needed**: None

#### Files to Modify

**9.1 `packages/happy-app/sources/sync/settings.ts`**
Add kimi to ProfileCompatibilitySchema:
```typescript
compatibility: z.object({
  claude: z.boolean().default(true),
  codex: z.boolean().default(true),
  gemini: z.boolean().default(true),
  kimi: z.boolean().default(true),  // Add this
})
```

**9.2 `packages/happy-app/sources/hooks/useCLIDetection.ts`**
Add kimi to CLI availability interface and detection:
```typescript
interface CLIAvailability {
  claude: boolean;
  codex: boolean;
  gemini: boolean;
  kimi: boolean;  // Add this
}
```

---

### Module 10: Mobile App Agent Selector
**Parallelizable**: No
**Dependencies**: Module 9
**Skills Needed**: None

#### Files to Modify

**10.1 `packages/happy-app/sources/app/(app)/new/index.tsx`**
- Add 'kimi' to agent type options
- Update AgentInput component usage
- Handle Kimi-specific configuration

**10.2 `packages/happy-app/sources/components/AgentInput.tsx`**
- Add Kimi icon/branding
- Support Kimi selection

**10.3 `packages/happy-app/sources/sync/profileUtils.ts`**
- Update DEFAULT_PROFILES to include Kimi compatibility

---

### Module 11: Mobile App Translations
**Parallelizable**: Yes (Cloud Agent Compatible - Multiple Agents)
**Dependencies**: None
**Skills Needed**: None

#### Files to Modify (9 language files)
All in `packages/happy-app/sources/text/translations/`:
- `en.ts` - English
- `ru.ts` - Russian
- `pl.ts` - Polish
- `es.ts` - Spanish
- `ca.ts` - Catalan
- `it.ts` - Italian
- `pt.ts` - Portuguese
- `ja.ts` - Japanese
- `zh-Hans.ts` - Chinese

**Strings to Add**:
```typescript
kimi: 'Kimi',
kimiDescription: 'Kimi Code CLI agent',
kimiNotDetected: 'Kimi CLI not detected on machine',
```

---

### Module 12: Mobile App Tests
**Parallelizable**: Yes (Cloud Agent Compatible)
**Dependencies**: Modules 9-11
**Skills Needed**: None

#### Files to Create

**12.1 Jest Tests with Device Mocking**
- `sources/__tests__/kimi/AgentSelector.test.tsx`
  - Mock useCLIDetection hook
  - Test Kimi option renders
  - Test selection flow

- `sources/__tests__/kimi/ProfileCompatibility.test.ts`
  - Test profile validation with Kimi
  - Test compatibility flags

- `sources/__tests__/kimi/SessionSpawn.test.tsx`
  - Mock machineSpawnNewSession
  - Test Kimi session creation

**Testing Framework**: Jest-Expo (already configured via `"jest": { "preset": "jest-expo" }`)

---

### Module 13: APK Build Configuration
**Parallelizable**: No
**Dependencies**: Modules 9-12
**Skills Needed**: None
**Build Method**: **EAS Build (Expo Cloud)** - Recommended over local builds

#### Prerequisites
- Expo account at https://expo.dev
- EAS CLI installed: `npm install -g eas-cli`
- EXPO_TOKEN environment variable set (optional, for CI/automation)
- *(Local SDK only needed if building locally with gradlew)*

#### Tasks

1. **Prebuild native project** (generates android/ folder):
```bash
cd /root/happykimi/packages/happy-app
yarn prebuild
```

2. **Configure Expo project** (one-time setup):
```bash
EXPO_TOKEN="your-expo-token" eas project:init --force
# This creates the Expo project and updates app.config.js with projectId
```

3. **Build with EAS Build** (recommended - cloud build, no local disk constraints):

**For preview/development builds**:
```bash
EXPO_TOKEN="your-expo-token" eas build --platform android --profile preview --wait
```

**For production release builds**:
```bash
EXPO_TOKEN="your-expo-token" eas build --platform android --profile production --wait
```

4. **Download and install APK**:
```bash
# EAS will output download link, or get from web dashboard
# For testing on connected device:
adb install <downloaded-apk-path>
```

#### Local Build Alternative (if EAS not available)

If you prefer local builds with gradlew instead of EAS:

```bash
# Install Android SDK manually
cd /root/happykimi/packages/happy-app/android
./gradlew assembleRelease
# APK will be at: android/app/build/outputs/apk/release/app-release.apk
```

**⚠️ Note**: Local builds require significant disk space (~20GB) for native C++ compilation. EAS Build is preferred.

#### Why EAS Build?
- ✅ No local disk space constraints
- ✅ Faster parallel compilation on Expo servers
- ✅ Free tier: ~30 builds/month
- ✅ Managed credentials (Keystore, signing keys)
- ✅ Consistent builds across environments
- ✅ Historical build management via Expo dashboard

---

### Module 14: Integration Testing
**Parallelizable**: No
**Dependencies**: Modules 7, 12
**Skills Needed**: `webapp-testing`

#### Test Plan

**14.1 CLI Integration Tests**
```bash
cd /root/happykimi/packages/happy-cli
yarn build
yarn test
```

**14.2 E2E Tests (Manual)**
1. Start relay server: `cd /root/happy-relay-server && docker compose up -d`
2. Start happy kimi: `./bin/happy.mjs kimi`
3. Verify QR code displays
4. Test mobile connection (if available)

---

### Module 15: Documentation
**Parallelizable**: Yes (Cloud Agent Compatible)
**Dependencies**: All modules complete
**Skills Needed**: None

#### Files to Create

**15.1 `happykimi-transition/README.md`**
Contents:
1. Prerequisites
2. CLI Installation steps
3. Mobile app build instructions
4. APK installation on Android
5. Usage guide
6. Troubleshooting

---

## Dependency Graph

```
Module 0 (Setup)
     │
     ├──► Module 1 (Types/Constants) ──┬──► Module 2 (Transport)
     │                                  ├──► Module 3 (Utilities)
     │                                  └──► Module 5 (UI)
     │                                           │
     └──► Module 9 (App Types) ───────────────────┤
                    │                              │
                    ▼                              ▼
              Module 10 (Agent Selector)     Module 4 (Factory)
                    │                              │
                    ▼                              ▼
              Module 11 (Translations)       Module 6 (runKimi)
                    │                              │
                    ▼                              ▼
              Module 12 (App Tests)          Module 7 (CLI Integration)
                    │                              │
                    └──────────┬───────────────────┘
                               │
                               ▼
                    Module 8 (CLI Tests)
                               │
                               ▼
                    Module 13 (APK Build)
                               │
                               ▼
                    Module 14 (Integration Testing)
                               │
                               ▼
                    Module 15 (Documentation)
```

---

## Parallelization Summary

### Can Run Fully in Parallel (Cloud Agent Compatible)
- Module 1: Core Types & Constants
- Module 2: Transport Handler
- Module 3: Utility Classes
- Module 5: Ink UI Component
- Module 8: CLI Tests (after Module 7)
- Module 9: Mobile App Type Updates
- Module 11: Translations (9 files - can split across agents)
- Module 12: Mobile App Tests
- Module 15: Documentation

### Must Run Sequentially
- Module 0 → Module 1 (setup before coding)
- Module 4 → Module 6 (factory before runKimi)
- Module 6 → Module 7 (runKimi before integration)
- Module 10 → Module 13 (UI before build)
- Module 13 → Module 14 (build before E2E test)

### Local Environment Required
- Module 0: Environment Setup
- Module 7: CLI Integration (needs full context)
- Module 13: APK Build (needs Android SDK)
- Module 14: Integration Testing

---

## Skills Useful for Each Module

| Module | Relevant Skills |
|--------|-----------------|
| 0 | `using-claudecodecli` |
| 1-7 | None (TypeScript patterns) |
| 8 | None (Vitest) |
| 9-12 | None (React Native) |
| 13 | None (local Android build) |
| 14 | `webapp-testing` |
| 15 | None |

---

## Verification Checklist

### Phase 1 (CLI) Verification
- [ ] `happy kimi` starts session with Ink UI
- [ ] QR code displays for mobile connection
- [ ] `happy kimi model set gemini-2.5-pro` works
- [ ] `happy kimi model get` shows current model
- [ ] Permission modes work (default, yolo, safe-yolo, read-only)
- [ ] Abort (Ctrl+C) stops current task
- [ ] Session resume works after abort
- [ ] MCP tools (change_title) function correctly
- [ ] All tests pass: `yarn test`

### Phase 2 (Mobile App) Verification
- [ ] Kimi appears in agent selector
- [ ] Kimi CLI detection works
- [ ] Kimi sessions can be spawned from mobile
- [ ] Permission requests appear on mobile
- [ ] Approval/rejection flows work
- [ ] Model switching works mid-session
- [ ] APK builds successfully
- [ ] APK installs on Android device
- [ ] All tests pass: `yarn test`

### Final E2E Test
1. Start relay: `docker compose up -d`
2. Run CLI: `happy kimi`
3. Scan QR code with phone
4. Send message from phone
5. Approve tool calls from phone
6. Verify response received

---

## Critical File References

| Purpose | File Path |
|---------|-----------|
| Gemini entry point pattern | `packages/happy-cli/src/gemini/runGemini.ts` |
| Backend factory pattern | `packages/happy-cli/src/agent/factories/gemini.ts` |
| Transport handler pattern | `packages/happy-cli/src/agent/transport/handlers/GeminiTransport.ts` |
| ACP backend (reuse) | `packages/happy-cli/src/agent/acp/AcpBackend.ts` |
| CLI entry point | `packages/happy-cli/src/index.ts` |
| Agent types | `packages/happy-cli/src/agent/core/AgentBackend.ts` |
| Permission modes | `packages/happy-cli/src/api/types.ts` |
| App new session | `packages/happy-app/sources/app/(app)/new/index.tsx` |
| Settings schema | `packages/happy-app/sources/sync/settings.ts` |
| CLI detection | `packages/happy-app/sources/hooks/useCLIDetection.ts` |

---

## Estimated Effort by Module

| Module | LOC | Complexity | Est. Time |
|--------|-----|------------|-----------|
| 0 | - | Low | 15 min |
| 1 | ~60 | Low | 30 min |
| 2 | ~100 | Medium | 45 min |
| 3 | ~400 | Medium | 2 hrs |
| 4 | ~180 | Medium | 1 hr |
| 5 | ~200 | Medium | 1 hr |
| 6 | ~1300 | High | 4 hrs |
| 7 | ~200 | Medium | 1 hr |
| 8 | ~400 | Medium | 2 hrs |
| 9 | ~50 | Low | 30 min |
| 10 | ~150 | Medium | 1 hr |
| 11 | ~50 | Low | 30 min |
| 12 | ~200 | Medium | 1 hr |
| 13 | ~20 | Low | 30 min |
| 14 | - | Medium | 2 hrs |
| 15 | ~200 | Low | 1 hr |

**Total**: ~3500 LOC, ~18 hours estimated effort
