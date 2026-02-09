# HappyKimi Transition - Progress Tracking

> **Last Updated**: 2026-02-09T21:52:00Z

---

## 📋 How to Use This Progress File

### For Agents Implementing Modules

1. **Before you start**: Find your assigned module below and update:
   - `Status` → `in_progress`
   - `Agent` → Your identifier
   - `Started` → Current timestamp (ISO format)

2. **While working**: Update the `Progress Notes` section with brief bullet points of what you've completed.

3. **When facing challenges**: Add entries to `Challenges & Solutions` using the template format.

4. **When complete**: Update:
   - `Status` → `completed`
   - `Completed` → Current timestamp
   - Ensure all files created/modified are listed

### Status Values

| Status | Meaning |
|--------|---------|
| `pending` | Not yet started, waiting for dependencies |
| `in_progress` | Actively being worked on |
| `blocked` | Cannot proceed due to dependency or issue |
| `completed` | All tasks done, verified, tested |
| `skipped` | Intentionally skipped (document reason) |

### Challenge & Solution Format

```markdown
**Challenge**: Brief description of the problem encountered
- **Context**: (optional) Additional context
- **Solution**: How you solved it (or workaround used)
- **Time Lost**: Estimate (e.g., 15 min, 2 hrs) - helps with retrospective
```

### Quick Links

- [PRD](./PRD.md) - Full requirements
- [Module Dependency Graph](#module-dependencies) - See below

---

## 📊 Overall Progress Summary

```
Phase 1 (CLI)   : [██████████] 9/9 modules
Phase 2 (Mobile): [██        ] 2/7 modules
Total           : [███████   ] 11/15 modules
```

| Phase | Modules | Completed | Status |
|-------|---------|-----------|--------|
| CLI Core | 0-8 | 9/9 | 🟢 Complete |
| Mobile App | 9-13 | 2/5 | 🟡 In Progress |
| Integration | 14 | 0/1 | 🔴 Not started |
| Documentation | 15 | 0/1 | 🔴 Not started |

---

## 🔧 Module Progress Details

### Module 0: Environment Setup & Dependencies

| Field | Value |
|-------|-------|
| **Status** | `completed` |
| **Agent** | main-agent |
| **Started** | 2026-02-09T20:13:51Z |
| **Completed** | 2026-02-09T20:19:20Z |
| **Parallelizable** | Yes |
| **Dependencies** | None |

**Files Modified**:
- *none yet*

**Progress Notes**:
- [x] Verify Kimi CLI installation and version (kimi v1.6 confirmed)
- [x] Install happy-cli development dependencies (yarn install completed)
- [x] Build happy-cli to ensure base version works (build successful)
- [x] Verify relay server is running (all 4 containers healthy)

**Challenges & Solutions**:

**Challenge**: Yarn not available in PATH initially
- **Solution**: Installed yarn globally via npm (`npm install -g yarn`) and added `/root/.npm-global/bin` to PATH
- **Time Lost**: ~2 min

**Challenge**: Project uses yarn workspaces with warnings about private projects
- **Solution**: Warnings are expected and don't affect functionality; install completed successfully
- **Time Lost**: None

---

### Module 1: Core Types & Constants (CLI)

| Field | Value |
|-------|-------|
| **Status** | `completed` |
| **Agent** | main-agent |
| **Started** | 2026-02-09T20:24:00Z |
| **Completed** | 2026-02-09T20:25:30Z |
| **Parallelizable** | Yes |
| **Dependencies** | Module 0 (optional) |

**Files Created**:
- `packages/happy-cli/src/kimi/constants.ts`
- `packages/happy-cli/src/kimi/types.ts`

**Progress Notes**:
- [x] Created constants.ts with KIMI_API_KEY_ENV, KIMI_MODEL_ENV, DEFAULT_KIMI_MODEL
- [x] Reused CHANGE_TITLE_INSTRUCTION from gemini/constants.ts
- [x] Created types.ts with KimiMode, KimiMessagePayload, KimiSessionConfig interfaces
- [x] All TypeScript compilation passes
- [x] All existing tests pass (273 passed)

**Challenges & Solutions**:

**Challenge**: Parent directory `/root/happykimi/packages/happy-cli/src/kimi` did not exist
- **Solution**: Created the directory before writing files
- **Time Lost**: < 1 min

---

### Module 2: Transport Handler (CLI)

| Field | Value |
|-------|-------|
| **Status** | `completed` |
| **Agent** | sub-agent-1 |
| **Started** | 2026-02-09T20:30:00Z |
| **Completed** | 2026-02-09T20:38:00Z |
| **Parallelizable** | Yes |
| **Dependencies** | Module 1 |

**Files Created**:
- `packages/happy-cli/src/agent/transport/handlers/KimiTransport.ts`

**Files Created**:
- `packages/happy-cli/src/agent/transport/handlers/KimiTransport.ts`
- `packages/happy-cli/src/agent/transport/handlers/__tests__/KimiTransport.test.ts`

**Progress Notes**:
- [x] Implemented KimiTransport class with timeouts (init: 60s, toolCall: 120s, idle: 500ms)
- [x] Added filterStdoutLine for JSON-RPC filtering
- [x] Defined tool patterns for change_title and think
- [x] Exported singleton kimiTransport
- [x] Updated transport handlers index.ts to export KimiTransport
- [x] Created comprehensive tests (21 tests)
- [x] All tests pass

**Challenges & Solutions**:

**Challenge**: extractToolNameFromId method was missing from initial implementation
- **Solution**: Added the method to match TransportHandler interface requirements
- **Time Lost**: ~5 min

---

### Module 3: Utility Classes (CLI)

| Field | Value |
|-------|-------|
| **Status** | `completed` |
| **Agent** | sub-agent-2 |
| **Started** | 2026-02-09T20:30:00Z |
| **Completed** | 2026-02-09T20:38:00Z |
| **Parallelizable** | Yes |
| **Dependencies** | Module 1 |

**Files Created**:
- `packages/happy-cli/src/kimi/utils/config.ts`
- `packages/happy-cli/src/kimi/utils/permissionHandler.ts`
- `packages/happy-cli/src/kimi/utils/reasoningProcessor.ts`
- `packages/happy-cli/src/kimi/utils/diffProcessor.ts`

**Files Created**:
- `packages/happy-cli/src/kimi/utils/config.ts`
- `packages/happy-cli/src/kimi/utils/permissionHandler.ts`
- `packages/happy-cli/src/kimi/utils/reasoningProcessor.ts`
- `packages/happy-cli/src/kimi/utils/diffProcessor.ts`
- `packages/happy-cli/src/kimi/utils/__tests__/config.test.ts`
- `packages/happy-cli/src/kimi/utils/__tests__/permissionHandler.test.ts`

**Progress Notes**:
- [x] config.ts - Read/save Kimi config from ~/.kimi/config.toml (TOML format)
- [x] permissionHandler.ts - KimiPermissionHandler class with permission modes
- [x] reasoningProcessor.ts - KimiReasoningProcessor class
- [x] diffProcessor.ts - KimiDiffProcessor class
- [x] Created comprehensive tests (29 tests total: 13 for config, 16 for permissionHandler)
- [x] All tests pass

**Challenges & Solutions**:

**Challenge**: Test environment had existing ~/.kimi/config.toml file with test data
- **Solution**: Updated tests to be more robust and handle existing config
- **Time Lost**: ~10 min

**Challenge**: Test isolation issues with process.env modifications
- **Solution**: Fixed beforeEach/afterEach hooks to properly save/restore environment
- **Time Lost**: ~5 min

---

### Module 4: Backend Factory (CLI)

| Field | Value |
|-------|-------|
| **Status** | `completed` |
| **Agent** | main-agent |
| **Started** | 2026-02-09T21:14:45Z |
| **Completed** | 2026-02-09T21:18:00Z |
| **Parallelizable** | No |
| **Dependencies** | Modules 1, 2, 3 |

**Files Created**:
- `packages/happy-cli/src/agent/factories/kimi.ts`

**Files Modified**:
- `packages/happy-cli/src/agent/core/AgentBackend.ts` - Added 'kimi' to AgentId type
- `packages/happy-cli/src/agent/factories/index.ts` - Exported Kimi factory functions
- `packages/happy-cli/src/agent/transport/index.ts` - Exported KimiTransport

**Progress Notes**:
- [x] Create createKimiBackend() function following Gemini pattern
- [x] Integrate with AcpBackend using kimi acp subcommand
- [x] Handle model resolution and env vars (KIMI_MODEL, local config, default)
- [x] Export kimiTransport from transport index
- [x] Register Kimi agent with agentRegistry
- [x] Build passes successfully
- [x] All 323 tests pass

**Challenges & Solutions**:

**Challenge**: kimiTransport was not exported from transport index.ts
- **Solution**: Added `export { KimiTransport, kimiTransport } from './handlers';` to transport/index.ts
- **Time Lost**: ~2 min

**Challenge**: AgentId type needed to include 'kimi' for proper type safety
- **Solution**: Added 'kimi' to the AgentId union type in AgentBackend.ts
- **Time Lost**: < 1 min

---

### Module 5: Ink UI Component (CLI)

| Field | Value |
|-------|-------|
| **Status** | `completed` |
| **Agent** | sub-agent-3 |
| **Started** | 2026-02-09T20:30:00Z |
| **Completed** | 2026-02-09T20:38:00Z |
| **Parallelizable** | Yes |
| **Dependencies** | Module 1 |

**Files Created**:
- `packages/happy-cli/src/ui/ink/KimiDisplay.tsx`

**Files Created**:
- `packages/happy-cli/src/ui/ink/KimiDisplay.tsx`

**Progress Notes**:
- [x] Created React component for terminal UI using Ink
- [x] Display status, messages, model info
- [x] Handle Ctrl+C for exit with confirmation
- [x] Color-coded messages (user: magenta, assistant: cyan, system: blue, tool: yellow, result: green, status: gray)
- [x] Status bar showing "🌙 Kimi Agent Running" with model info
- [x] Build passes with no errors

**Challenges & Solutions**:
None - implementation followed GeminiDisplay pattern successfully

---

### Module 6: Main Entry Point - runKimi.ts (CLI)

| Field | Value |
|-------|-------|
| **Status** | `completed` |
| **Agent** | main-agent |
| **Started** | 2026-02-09T21:28:00Z |
| **Completed** | 2026-02-09T21:38:00Z |
| **Parallelizable** | No |
| **Dependencies** | Modules 1-5 |

**Files Created**:
- `packages/happy-cli/src/kimi/runKimi.ts`
- `packages/happy-cli/src/kimi/__tests__/emitReadyIfIdle.test.ts`
- `packages/happy-cli/src/kimi/__tests__/runKimi.integration.test.ts`

**Files Modified**:
- `packages/happy-cli/src/utils/createSessionMetadata.ts` - Added 'kimi' to BackendFlavor type
- `packages/happy-cli/src/api/apiSession.ts` - Added 'kimi' to sendAgentMessage provider type

**Progress Notes**:
- [x] Session setup and authentication (~1100 lines, following runGemini.ts pattern)
- [x] Machine ID retrieval
- [x] Session creation with metadata (flavor: 'kimi')
- [x] Message queue with mode handling
- [x] Happy MCP server startup
- [x] Backend creation with createKimiBackend()
- [x] Message handler for AgentMessage types
- [x] Main processing loop with conversation history
- [x] Cleanup on exit
- [x] Authentication check (kimi login required)
- [x] All tests pass (335 passed)

**Challenges & Solutions**:

**Challenge**: BackendFlavor type didn't include 'kimi'
- **Solution**: Added 'kimi' to BackendFlavor union type in createSessionMetadata.ts
- **Time Lost**: ~2 min

**Challenge**: sendAgentMessage provider type didn't include 'kimi'
- **Solution**: Added 'kimi' to provider type in apiSession.ts
- **Time Lost**: ~2 min

---

### Module 7: CLI Integration (CLI)

| Field | Value |
|-------|-------|
| **Status** | `completed` |
| **Agent** | main-agent |
| **Started** | 2026-02-09T21:35:00Z |
| **Completed** | 2026-02-09T21:38:00Z |
| **Parallelizable** | No |
| **Dependencies** | Module 6 |

**Files Modified**:
- `packages/happy-cli/src/index.ts` - Added kimi subcommand handling

**Progress Notes**:
- [x] Add kimi subcommand block in index.ts (after gemini section)
- [x] Handle `happy kimi model set <model>` command
- [x] Handle `happy kimi model get` command
- [x] Handle `happy kimi model` help command
- [x] Handle main `happy kimi` command with daemon auto-start
- [x] Update help text to include kimi command
- [x] Build passes successfully
- [x] All 335 tests pass

**Challenges & Solutions**:
None - integration followed existing gemini/codex patterns successfully

---

### Module 7: CLI Integration (CLI)

| Field | Value |
|-------|-------|
| **Status** | `pending` |
| **Agent** | *unassigned* |
| **Started** | - |
| **Completed** | - |
| **Parallelizable** | No |
| **Dependencies** | Module 6 |

**Files Modified**:
- `packages/happy-cli/src/index.ts` - Add kimi subcommand
- `packages/happy-cli/src/agent/core/AgentBackend.ts` - Add 'kimi' to AgentId
- `packages/happy-cli/src/agent/transport/handlers/index.ts` - Export kimiTransport
- `packages/happy-cli/src/agent/factories/index.ts` - Export createKimiBackend

**Progress Notes**:
- [ ] Add kimi subcommand block in index.ts
- [ ] Add 'kimi' to AgentId type
- [ ] Update export index files

**Challenges & Solutions**:
<!-- Add challenges here as needed -->

---

### Module 8: CLI Tests

| Field | Value |
|-------|-------|
| **Status** | `completed` |
| **Agent** | main-agent |
| **Started** | 2026-02-09T21:48:51Z |
| **Completed** | 2026-02-09T21:52:00Z |
| **Parallelizable** | Yes |
| **Dependencies** | Modules 1-7 |

**Files Created**:
- `packages/happy-cli/src/kimi/utils/__tests__/config.test.ts` (13 tests)
- `packages/happy-cli/src/kimi/utils/__tests__/permissionHandler.test.ts` (16 tests)
- `packages/happy-cli/src/kimi/__tests__/emitReadyIfIdle.test.ts` (7 tests)
- `packages/happy-cli/src/agent/transport/handlers/__tests__/KimiTransport.test.ts` (21 tests)
- `packages/happy-cli/src/kimi/__tests__/runKimi.integration.test.ts` (5 tests)

**Progress Notes**:
- [x] Unit tests for config utilities - 13 tests covering read/save config, model resolution
- [x] Unit tests for permission handler - 16 tests covering all permission modes (yolo, safe-yolo, read-only, default)
- [x] Unit tests for emitReadyIfIdle - 7 tests covering idle detection and ready state emission
- [x] Unit tests for KimiTransport - 21 tests covering JSON filtering, tool patterns, timeout configs
- [x] Integration tests for runKimi - 5 tests covering message flow and session handling
- [x] All 335 tests pass successfully

**Challenges & Solutions**:
None - all test files were created in previous modules and verified working

---

### Module 9: Mobile App Type Updates

| Field | Value |
|-------|-------|
| **Status** | `completed` |
| **Agent** | sub-agent (parallel) |
| **Started** | 2026-02-09T20:24:00Z |
| **Completed** | 2026-02-09T20:25:30Z |
| **Parallelizable** | Yes |
| **Dependencies** | None |

**Files Modified**:
- `packages/happy-app/sources/sync/settings.ts` - Added `kimi: z.boolean().default(true)` to ProfileCompatibilitySchema, updated validateProfileForAgent(), added kimi to dismissedCLIWarnings
- `packages/happy-app/sources/hooks/useCLIDetection.ts` - Added kimi to CLIAvailability interface, state initialization, bash detection command, and parsing logic

**Additional Files Updated for Compatibility**:
- `packages/happy-app/sources/app/(app)/new/index.tsx`
- `packages/happy-app/sources/app/(app)/settings/profiles.tsx`
- `packages/happy-app/sources/components/NewSessionWizard.tsx`
- `packages/happy-app/sources/sync/profileUtils.ts`
- `packages/happy-app/sources/sync/settings.spec.ts`

**Progress Notes**:
- [x] Added kimi to ProfileCompatibilitySchema
- [x] Added kimi to CLI availability interface
- [x] Added kimi detection to bash command
- [x] Updated all dependent files with kimi compatibility
- [x] TypeScript compilation passes with no errors

**Challenges & Solutions**:
None - all changes followed existing patterns successfully

---

### Module 10: Mobile App Agent Selector

| Field | Value |
|-------|-------|
| **Status** | `completed` |
| **Agent** | main-agent |
| **Started** | 2026-02-09T21:57:00Z |
| **Completed** | 2026-02-09T22:15:00Z |
| **Parallelizable** | No |
| **Dependencies** | Module 9 |

**Files Modified**:
- `packages/happy-app/sources/app/(app)/new/index.tsx` - Added 'kimi' agent type support throughout
- `packages/happy-app/sources/components/AgentInput.tsx` - Added Kimi UI, permission modes, and CLI status
- `packages/happy-app/sources/sync/persistence.ts` - Added 'kimi' to NewSessionAgentType
- `packages/happy-app/sources/sync/ops.ts` - Added 'kimi' to SpawnSessionOptions agent type
- `packages/happy-app/sources/utils/tempDataStore.ts` - Added 'kimi' to NewSessionData agentType
- `packages/happy-app/sources/text/_default.ts` - Added kimi translations
- `packages/happy-app/sources/text/translations/en.ts` - Added kimi translations
- `packages/happy-app/sources/text/translations/*.ts` (all 9 files) - Added kimi agent and permission mode strings

**Progress Notes**:
- [x] Added 'kimi' to agent type options ('claude' | 'codex' | 'gemini' | 'kimi')
- [x] Updated AgentInput component with Kimi support (permission modes, model selector, agent label)
- [x] Added Kimi CLI detection banner in new session wizard
- [x] Added Kimi CLI status indicator in connection status
- [x] Updated permission mode handling to include Kimi (same modes as Codex/Gemini)
- [x] Updated keyboard handling (Shift+Tab) for permission mode cycling
- [x] Added kimiPermissionMode translations to all 9 language files
- [x] TypeScript compilation passes with no errors
- [x] All 399 tests pass

**Challenges & Solutions**:

**Challenge**: Translation type errors for kimiPermissionMode across 9 language files
- **Solution**: Added kimiPermissionMode block to all translation files (ca, es, it, ja, pl, pt, ru, zh-Hans, zh-Hant) with English strings as placeholders
- **Time Lost**: ~15 min

**Challenge**: Multiple type definitions needed updating for 'kimi' agent type
- **Solution**: Updated NewSessionAgentType in persistence.ts, SpawnSessionOptions in ops.ts, and NewSessionData in tempDataStore.ts
- **Time Lost**: ~10 min

---

### Module 11: Mobile App Translations

| Field | Value |
|-------|-------|
| **Status** | `completed` |
| **Agent** | main-agent |
| **Started** | 2026-02-09T22:15:51Z |
| **Completed** | 2026-02-09T22:22:30Z |
| **Parallelizable** | Yes (split across 9 agents possible) |
| **Dependencies** | None |

**Files Modified**:
- `packages/happy-app/sources/text/_default.ts` - Added kimiDescription, kimiNotDetected, kimiPermissionMode
- `packages/happy-app/sources/text/translations/en.ts` - Added kimiDescription, kimiNotDetected
- `packages/happy-app/sources/text/translations/ru.ts` - Added kimiDescription, kimiNotDetected + translated kimiPermissionMode
- `packages/happy-app/sources/text/translations/pl.ts` - Added kimiDescription, kimiNotDetected + translated kimiPermissionMode
- `packages/happy-app/sources/text/translations/es.ts` - Added kimiDescription, kimiNotDetected + translated kimiPermissionMode
- `packages/happy-app/sources/text/translations/ca.ts` - Added kimiDescription, kimiNotDetected + translated kimiPermissionMode
- `packages/happy-app/sources/text/translations/it.ts` - Added kimiDescription, kimiNotDetected + translated kimiPermissionMode
- `packages/happy-app/sources/text/translations/pt.ts` - Added kimiDescription, kimiNotDetected + translated kimiPermissionMode
- `packages/happy-app/sources/text/translations/ja.ts` - Added kimiDescription, kimiNotDetected + translated kimiPermissionMode
- `packages/happy-app/sources/text/translations/zh-Hans.ts` - Added kimiDescription, kimiNotDetected + translated kimiPermissionMode
- `packages/happy-app/sources/text/translations/zh-Hant.ts` - Added kimiDescription, kimiNotDetected + translated kimiPermissionMode

**Progress Notes**:
- [x] Added `kimiDescription: 'Kimi Code CLI agent'` (localized) to all 10 translation files
- [x] Added `kimiNotDetected: 'Kimi CLI not detected on machine'` (localized) to all 10 translation files
- [x] Translated `kimiPermissionMode` blocks from English to respective languages
- [x] TypeScript compilation passes with no errors
- [x] All 399 tests pass

**Challenges & Solutions**:

**Challenge**: Initially missed zh-Hant.ts (Traditional Chinese) file
- **Solution**: Added the file to the update list and applied the same translations
- **Time Lost**: ~2 min

**Challenge**: Some translation files had kimiPermissionMode in English
- **Solution**: Translated all kimiPermissionMode strings to their respective languages while adding the new strings
- **Time Lost**: ~5 min

---

### Module 12: Mobile App Tests

| Field | Value |
|-------|-------|
| **Status** | `pending` |
| **Agent** | *unassigned* |
| **Started** | - |
| **Completed** | - |
| **Parallelizable** | Yes |
| **Dependencies** | Modules 9-11 |

**Files Created**:
- `packages/happy-app/sources/__tests__/kimi/AgentSelector.test.tsx`
- `packages/happy-app/sources/__tests__/kimi/ProfileCompatibility.test.ts`
- `packages/happy-app/sources/__tests__/kimi/SessionSpawn.test.tsx`

**Progress Notes**:
- [ ] AgentSelector tests with mocked hooks
- [ ] Profile compatibility tests
- [ ] Session spawn tests with mocked machineSpawnNewSession

**Challenges & Solutions**:
<!-- Add challenges here as needed -->

---

### Module 13: APK Build Configuration

| Field | Value |
|-------|-------|
| **Status** | `pending` |
| **Agent** | *unassigned* |
| **Started** | - |
| **Completed** | - |
| **Parallelizable** | No |
| **Dependencies** | Modules 9-12 |

**Prerequisites**:
- Android SDK installed
- ANDROID_HOME environment variable set
- Java JDK 17+ installed

**Progress Notes**:
- [ ] Run `yarn prebuild` to generate android/ folder
- [ ] Build debug APK with `yarn android:dev`
- [ ] Build release APK with gradlew
- [ ] Install on connected device via adb

**Challenges & Solutions**:
<!-- Add challenges here as needed -->

---

### Module 14: Integration Testing

| Field | Value |
|-------|-------|
| **Status** | `pending` |
| **Agent** | *unassigned* |
| **Started** | - |
| **Completed** | - |
| **Parallelizable** | No |
| **Dependencies** | Modules 7, 12, 13 |

**Progress Notes**:
- [ ] CLI integration tests: `yarn test`
- [ ] Manual E2E test: relay server + happy kimi + QR scan

**Verification Checklist**:
- [ ] `happy kimi` starts session with Ink UI
- [ ] QR code displays for mobile connection
- [ ] Permission modes work (default, yolo, safe-yolo, read-only)
- [ ] Abort (Ctrl+C) stops current task
- [ ] MCP tools (change_title) function correctly

**Challenges & Solutions**:
<!-- Add challenges here as needed -->

---

### Module 15: Documentation

| Field | Value |
|-------|-------|
| **Status** | `pending` |
| **Agent** | *unassigned* |
| **Started** | - |
| **Completed** | - |
| **Parallelizable** | Yes |
| **Dependencies** | All modules complete |

**Files Created**:
- `happykimi-transition/README.md`

**Progress Notes**:
- [ ] Prerequisites section
- [ ] CLI Installation steps
- [ ] Mobile app build instructions
- [ ] APK installation on Android
- [ ] Usage guide
- [ ] Troubleshooting section

**Challenges & Solutions**:
<!-- Add challenges here as needed -->

---

## 🔗 Module Dependencies

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

## 📝 Global Notes

<!-- Add any cross-cutting concerns or notes that affect multiple modules here -->

