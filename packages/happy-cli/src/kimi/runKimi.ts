/**
 * Kimi CLI Entry Point
 * 
 * This module provides the main entry point for running the Kimi agent
 * through Happy CLI. It manages the agent lifecycle, session state, and
 * communication with the Happy server and mobile app.
 * 
 * Note: Kimi uses ACP (Agent Client Protocol) like Gemini, so this follows
 * the same patterns as runGemini.ts with Kimi-specific adaptations.
 */

import { render } from 'ink';
import React from 'react';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import { join, resolve } from 'node:path';

import { ApiClient } from '@/api/api';
import { logger } from '@/ui/logger';
import { Credentials, readSettings } from '@/persistence';
import { createSessionMetadata } from '@/utils/createSessionMetadata';
import { initialMachineMetadata } from '@/daemon/run';
import { configuration } from '@/configuration';
import packageJson from '../../package.json';
import { MessageQueue2 } from '@/utils/MessageQueue2';
import { hashObject } from '@/utils/deterministicJson';
import { projectPath } from '@/projectPath';
import { startHappyServer } from '@/claude/utils/startHappyServer';
import { MessageBuffer } from '@/ui/ink/messageBuffer';
import { notifyDaemonSessionStarted } from '@/daemon/controlClient';
import { registerKillSessionHandler } from '@/claude/registerKillSessionHandler';
import { stopCaffeinate } from '@/utils/caffeinate';
import { connectionState } from '@/utils/serverConnectionErrors';
import { setupOfflineReconnection } from '@/utils/setupOfflineReconnection';
import type { ApiSessionClient } from '@/api/apiSession';

import { createKimiBackend } from '@/agent/factories/kimi';
import type { AgentBackend, AgentMessage } from '@/agent';
import { KimiDisplay } from '@/ui/ink/KimiDisplay';
import { KimiPermissionHandler } from '@/kimi/utils/permissionHandler';
import { KimiReasoningProcessor } from '@/kimi/utils/reasoningProcessor';
import { KimiDiffProcessor } from '@/kimi/utils/diffProcessor';
import type { KimiMode, KimiMessagePayload } from '@/kimi/types';
import type { PermissionMode } from '@/api/types';
import { KIMI_MODEL_ENV, DEFAULT_KIMI_MODEL, CHANGE_TITLE_INSTRUCTION } from '@/kimi/constants';
import {
  readKimiLocalConfig,
  saveKimiModelToConfig,
  getInitialKimiModel
} from '@/kimi/utils/config';
import { ConversationHistory } from '@/gemini/utils/conversationHistory';

/**
 * Main entry point for the kimi command with ink UI
 */
export async function runKimi(opts: {
  credentials: Credentials;
  startedBy?: 'daemon' | 'terminal';
}): Promise<void> {
  //
  // Define session
  //

  const sessionTag = randomUUID();

  // Set backend for offline warnings (before any API calls)
  connectionState.setBackend('Kimi');

  const api = await ApiClient.create(opts.credentials);

  //
  // Machine
  //

  const settings = await readSettings();
  const machineId = settings?.machineId;
  if (!machineId) {
    console.error(`[START] No machine ID found in settings, which is unexpected since authAndSetupMachineIfNeeded should have created it. Please report this issue on https://github.com/slopus/happy-cli/issues`);
    process.exit(1);
  }
  logger.debug(`Using machineId: ${machineId}`);
  await api.getOrCreateMachine({
    machineId,
    metadata: initialMachineMetadata
  });

  //
  // Kimi authentication check
  // Users must run `kimi login` before using `happy kimi`
  // We skip cloud token integration - authentication is handled directly by Kimi CLI
  //
  const localConfig = readKimiLocalConfig();
  if (!localConfig.token) {
    console.error(chalk.yellow('⚠️  Kimi CLI not authenticated.'));
    console.error('');
    console.error('Please run: kimi login');
    console.error('');
    console.error('This will authenticate you with the Kimi API.');
    process.exit(1);
  }
  logger.debug('[Kimi] Using local config token from ~/.kimi/config.toml');

  //
  // Create session
  //

  const { state, metadata } = createSessionMetadata({
    flavor: 'kimi',
    machineId,
    startedBy: opts.startedBy
  });
  const response = await api.getOrCreateSession({ tag: sessionTag, metadata, state });

  // Handle server unreachable case - create offline stub with hot reconnection
  let session: ApiSessionClient;
  // Permission handler declared here so it can be updated in onSessionSwap callback
  // (assigned later after Happy server setup)
  let permissionHandler: KimiPermissionHandler;

  // Session swap synchronization to prevent race conditions during message processing
  // When a swap is requested during processing, it's queued and applied after the current cycle
  let isProcessingMessage = false;
  let pendingSessionSwap: ApiSessionClient | null = null;

  /**
   * Apply a pending session swap. Called between message processing cycles.
   * This ensures session swaps happen at safe points, not during message processing.
   */
  const applyPendingSessionSwap = () => {
    if (pendingSessionSwap) {
      logger.debug('[kimi] Applying pending session swap');
      session = pendingSessionSwap;
      if (permissionHandler) {
        permissionHandler.updateSession(pendingSessionSwap);
      }
      pendingSessionSwap = null;
    }
  };

  const { session: initialSession, reconnectionHandle } = setupOfflineReconnection({
    api,
    sessionTag,
    metadata,
    state,
    response,
    onSessionSwap: (newSession) => {
      // If we're processing a message, queue the swap for later
      // This prevents race conditions where session changes mid-processing
      if (isProcessingMessage) {
        logger.debug('[kimi] Session swap requested during message processing - queueing');
        pendingSessionSwap = newSession;
      } else {
        // Safe to swap immediately
        session = newSession;
        if (permissionHandler) {
          permissionHandler.updateSession(newSession);
        }
      }
    }
  });
  session = initialSession;

  // Report to daemon (only if we have a real session)
  if (response) {
    try {
      logger.debug(`[START] Reporting session ${response.id} to daemon`);
      const result = await notifyDaemonSessionStarted(response.id, metadata);
      if (result.error) {
        logger.debug(`[START] Failed to report to daemon (may not be running):`, result.error);
      } else {
        logger.debug(`[START] Reported session ${response.id} to daemon`);
      }
    } catch (error) {
      logger.debug('[START] Failed to report to daemon (may not be running):', error);
    }
  }

  const messageQueue = new MessageQueue2<KimiMode>((mode) => hashObject({
    permissionMode: mode.permissionMode,
    model: mode.model,
  }));

  // Conversation history for context preservation across model changes
  const conversationHistory = new ConversationHistory({ maxMessages: 20, maxCharacters: 50000 });

  // Track current overrides to apply per message
  let currentPermissionMode: PermissionMode | undefined = undefined;
  let currentModel: string | undefined = undefined;

  session.onUserMessage((message) => {
    // Resolve permission mode (validate) - same as Gemini/Codex
    let messagePermissionMode = currentPermissionMode;
    if (message.meta?.permissionMode) {
      const validModes: PermissionMode[] = ['default', 'read-only', 'safe-yolo', 'yolo'];
      if (validModes.includes(message.meta.permissionMode as PermissionMode)) {
        messagePermissionMode = message.meta.permissionMode as PermissionMode;
        currentPermissionMode = messagePermissionMode;
        // Update permission handler with new mode
        updatePermissionMode(messagePermissionMode);
        logger.debug(`[Kimi] Permission mode updated from user message to: ${currentPermissionMode}`);
      } else {
        logger.debug(`[Kimi] Invalid permission mode received: ${message.meta.permissionMode}`);
      }
    } else {
      logger.debug(`[Kimi] User message received with no permission mode override, using current: ${currentPermissionMode ?? 'default (effective)'}`);
    }
    
    // Initialize permission mode if not set yet
    if (currentPermissionMode === undefined) {
      currentPermissionMode = 'default';
      updatePermissionMode('default');
    }

    // Resolve model; explicit null resets to default (undefined)
    let messageModel = currentModel;
    if (message.meta?.hasOwnProperty('model')) {
      // If model is explicitly null, reset internal state but don't update displayed model
      // If model is provided, use it and update displayed model
      // Otherwise keep current model
      if (message.meta.model === null) {
        messageModel = undefined; // Explicitly reset - will use default/env/config
        currentModel = undefined;
        // Don't call updateDisplayedModel here - keep current displayed model
        // The backend will use the correct model from env/config/default
      } else if (message.meta.model) {
        const previousModel = currentModel;
        messageModel = message.meta.model;
        currentModel = messageModel;
        // Only update UI and show message if model actually changed
        if (previousModel !== messageModel) {
          // Save model to config file so it persists across sessions
          updateDisplayedModel(messageModel, true); // Update UI and save to config
          // Show model change message in UI (this will trigger UI re-render)
          messageBuffer.addMessage(`Model changed to: ${messageModel}`, 'system');
          logger.debug(`[Kimi] Model changed from ${previousModel} to ${messageModel}`);
        }
      }
      // If message.meta.model is undefined, keep currentModel
    }

    // Build the full prompt with appendSystemPrompt if provided
    // Only include system prompt for the first message to avoid forcing tool usage on every message
    const originalUserMessage = message.content.text;
    let fullPrompt = originalUserMessage;
    if (isFirstMessage && message.meta?.appendSystemPrompt) {
      // Prepend system prompt to user message only for first message
      // Also add change_title instruction (like Codex/Gemini does)
      // Use EXACT same format as Codex: add instruction AFTER user message
      fullPrompt = message.meta.appendSystemPrompt + '\n\n' + originalUserMessage + '\n\n' + CHANGE_TITLE_INSTRUCTION;
      isFirstMessage = false;
    }

    const mode: KimiMode = {
      permissionMode: messagePermissionMode || 'default',
      model: messageModel,
      originalUserMessage, // Store original message separately
    };
    messageQueue.push(fullPrompt, mode);
    
    // Record user message in conversation history for context preservation
    conversationHistory.addUserMessage(originalUserMessage);
  });

  let thinking = false;
  session.keepAlive(thinking, 'remote');
  const keepAliveInterval = setInterval(() => {
    session.keepAlive(thinking, 'remote');
  }, 2000);

  // Track if this is the first message to include system prompt only once
  let isFirstMessage = true;

  const sendReady = () => {
    session.sendSessionEvent({ type: 'ready' });
    try {
      api.push().sendToAllDevices(
        "It's ready!",
        'Kimi is waiting for your command',
        { sessionId: session.sessionId }
      );
    } catch (pushError) {
      logger.debug('[Kimi] Failed to send ready push', pushError);
    }
  };

  /**
   * Check if we can emit ready event
   * * Returns true when ready event was emitted
   */
  const emitReadyIfIdle = (): boolean => {
    if (shouldExit) {
      return false;
    }
    if (thinking) {
      return false;
    }
    if (isResponseInProgress) {
      return false;
    }
    if (messageQueue.size() > 0) {
      return false;
    }

    sendReady();
    return true;
  };

  //
  // Abort handling
  //

  let abortController = new AbortController();
  let shouldExit = false;
  let kimiBackend: AgentBackend | null = null;
  let acpSessionId: string | null = null;
  let wasSessionCreated = false;

  async function handleAbort() {
    logger.debug('[Kimi] Abort requested - stopping current task');
    
    // Send turn_aborted event when abort is requested
    session.sendAgentMessage('kimi', {
      type: 'turn_aborted',
      id: randomUUID(),
    });
    
    // Abort reasoning processor and reset diff processor
    reasoningProcessor.abort();
    diffProcessor.reset();
    
    try {
      abortController.abort();
      messageQueue.reset();
      if (kimiBackend && acpSessionId) {
        await kimiBackend.cancel(acpSessionId);
      }
      logger.debug('[Kimi] Abort completed - session remains active');
    } catch (error) {
      logger.debug('[Kimi] Error during abort:', error);
    } finally {
      abortController = new AbortController();
    }
  }

  const handleKillSession = async () => {
    logger.debug('[Kimi] Kill session requested - terminating process');
    await handleAbort();
    logger.debug('[Kimi] Abort completed, proceeding with termination');

    try {
      if (session) {
        session.updateMetadata((currentMetadata) => ({
          ...currentMetadata,
          lifecycleState: 'archived',
          lifecycleStateSince: Date.now(),
          archivedBy: 'cli',
          archiveReason: 'User terminated'
        }));

        session.sendSessionDeath();
        await session.flush();
        await session.close();
      }

      stopCaffeinate();
      happyServer.stop();

      if (kimiBackend) {
        await kimiBackend.dispose();
      }

      logger.debug('[Kimi] Session termination complete, exiting');
      process.exit(0);
    } catch (error) {
      logger.debug('[Kimi] Error during session termination:', error);
      process.exit(1);
    }
  };

  session.rpcHandlerManager.registerHandler('abort', handleAbort);
  registerKillSessionHandler(session.rpcHandlerManager, handleKillSession);

  //
  // Initialize Ink UI
  //

  const messageBuffer = new MessageBuffer();
  const hasTTY = process.stdout.isTTY && process.stdin.isTTY;
  let inkInstance: ReturnType<typeof render> | null = null;

  // Track current model for UI display
  // Initialize with env var or default to show correct model from start
  let displayedModel: string | undefined = getInitialKimiModel();
  
  // Log initial values
  logger.debug(`[kimi] Initial model setup: env[KIMI_MODEL_ENV]=${process.env[KIMI_MODEL_ENV] || 'not set'}, localConfig=${localConfig.model || 'not set'}, displayedModel=${displayedModel}`);

  // Function to update displayed model and notify UI
  const updateDisplayedModel = (model: string | undefined, saveToConfig: boolean = false) => {
    // Only update if model is actually provided (not undefined)
    if (model === undefined) {
      logger.debug(`[kimi] updateDisplayedModel called with undefined, skipping update`);
      return;
    }
    
    const oldModel = displayedModel;
    displayedModel = model;
    logger.debug(`[kimi] updateDisplayedModel called: oldModel=${oldModel}, newModel=${model}, saveToConfig=${saveToConfig}`);
    
    // Save to config file if requested (when user changes model via mobile app)
    if (saveToConfig) {
      saveKimiModelToConfig(model);
    }
    
    // Trigger UI update by adding a system message with model info
    if (hasTTY && oldModel !== model) {
      logger.debug(`[kimi] Adding model update message to buffer: [MODEL:${model}]`);
      messageBuffer.addMessage(`[MODEL:${model}]`, 'system');
    } else if (hasTTY) {
      logger.debug(`[kimi] Model unchanged, skipping update message`);
    }
  };

  if (hasTTY) {
    console.clear();
    // Create a React component that reads displayedModel from closure
    const DisplayComponent = () => {
      const currentModelValue = displayedModel || DEFAULT_KIMI_MODEL;
      return React.createElement(KimiDisplay, {
        messageBuffer,
        logPath: process.env.DEBUG ? logger.getLogPath() : undefined,
        currentModel: currentModelValue,
        onExit: async () => {
          logger.debug('[kimi]: Exiting agent via Ctrl-C');
          shouldExit = true;
          await handleAbort();
        }
      });
    };
    
    inkInstance = render(React.createElement(DisplayComponent), {
      exitOnCtrlC: false,
      patchConsole: false
    });
    
    // Send initial model to UI so it displays correctly from start
    const initialModelName = displayedModel || DEFAULT_KIMI_MODEL;
    logger.debug(`[kimi] Sending initial model to UI: ${initialModelName}`);
    messageBuffer.addMessage(`[MODEL:${initialModelName}]`, 'system');
  }

  if (hasTTY) {
    process.stdin.resume();
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.setEncoding('utf8');
  }

  //
  // Start Happy MCP server and create Kimi backend
  //

  const happyServer = await startHappyServer(session);
  const bridgeCommand = join(projectPath(), 'bin', 'happy-mcp.mjs');
  const mcpServers = {
    happy: {
      command: bridgeCommand,
      args: ['--url', happyServer.url]
    }
  };

  // Create permission handler for tool approval
  permissionHandler = new KimiPermissionHandler(session);
  
  // Create reasoning processor for handling thinking/reasoning chunks
  const reasoningProcessor = new KimiReasoningProcessor((message) => {
    session.sendAgentMessage('kimi', message);
  });
  
  // Create diff processor for handling file edit events and diff tracking
  const diffProcessor = new KimiDiffProcessor((message) => {
    session.sendAgentMessage('kimi', message);
  });
  
  // Update permission handler when permission mode changes
  const updatePermissionMode = (mode: PermissionMode) => {
    permissionHandler.setPermissionMode(mode);
  };

  // Accumulate Kimi response text for sending complete message to mobile
  let accumulatedResponse = '';
  let isResponseInProgress = false;
  let currentResponseMessageId: string | null = null;
  let hadToolCallInTurn = false;
  let pendingChangeTitle = false;
  let changeTitleCompleted = false;
  let taskStartedSent = false;

  /**
   * Set up message handler for Kimi backend
   * This function is called when backend is created or recreated
   */
  function setupKimiMessageHandler(backend: AgentBackend): void {
    backend.onMessage((msg: AgentMessage) => {
      switch (msg.type) {
        case 'model-output':
          if (msg.textDelta) {
            // If this is the first delta of a new response, create a new message
            if (!isResponseInProgress) {
              // Start of new response - create new assistant message
              messageBuffer.removeLastMessage('system'); // Remove "Thinking..." if present
              messageBuffer.addMessage(msg.textDelta, 'assistant');
              isResponseInProgress = true;
              logger.debug(`[kimi] Started new response, first chunk length: ${msg.textDelta.length}`);
            } else {
              // Continue existing response - update last assistant message
              messageBuffer.updateLastMessage(msg.textDelta, 'assistant');
              logger.debug(`[kimi] Updated response, chunk length: ${msg.textDelta.length}`);
            }
            accumulatedResponse += msg.textDelta;
          }
          break;

        case 'status':
          // Log status changes for debugging
          const statusDetail = msg.detail 
            ? (typeof msg.detail === 'object' ? JSON.stringify(msg.detail) : String(msg.detail))
            : '';
          logger.debug(`[kimi] Status changed: ${msg.status}${statusDetail ? ` - ${statusDetail}` : ''}`);
          
          // Log error status with details
          if (msg.status === 'error') {
            logger.debug(`[kimi] ⚠️ Error status received: ${statusDetail || 'Unknown error'}`);
            
            // Send turn_aborted event when error occurs
            session.sendAgentMessage('kimi', {
              type: 'turn_aborted',
              id: randomUUID(),
            });
          }
          
          if (msg.status === 'running') {
            thinking = true;
            session.keepAlive(thinking, 'remote');
            
            // Send task_started event ONCE per turn
            if (!taskStartedSent) {
              session.sendAgentMessage('kimi', {
                type: 'task_started',
                id: randomUUID(),
              });
              taskStartedSent = true;
            }
            
            // Show thinking indicator in UI
            messageBuffer.addMessage('Thinking...', 'system');
          } else if (msg.status === 'idle' || msg.status === 'stopped') {
            // Complete reasoning processor when status becomes idle
            reasoningProcessor.complete();
          } else if (msg.status === 'error') {
            thinking = false;
            session.keepAlive(thinking, 'remote');
            accumulatedResponse = '';
            isResponseInProgress = false;
            currentResponseMessageId = null;
            
            // Show error in CLI UI
            let errorMessage = 'Unknown error';
            if (msg.detail) {
              if (typeof msg.detail === 'object') {
                const detailObj = msg.detail as Record<string, unknown>;
                errorMessage = (detailObj.message as string) || 
                             (detailObj.details as string) || 
                             JSON.stringify(detailObj);
              } else {
                errorMessage = String(msg.detail);
              }
            }
            
            // Check for authentication error
            if (errorMessage.includes('Authentication required') || errorMessage.includes('401')) {
              errorMessage = `Authentication required.\n` +
                `Please run: kimi login\n` +
                `This will authenticate you with the Kimi API.`;
            }
            
            messageBuffer.addMessage(`Error: ${errorMessage}`, 'status');
            
            session.sendAgentMessage('kimi', {
              type: 'message',
              message: `Error: ${errorMessage}`,
            });
          }
          break;

        case 'tool-call':
          // Track that we had tool calls in this turn
          hadToolCallInTurn = true;
          
          // Show tool call in UI
          const toolArgs = msg.args ? JSON.stringify(msg.args).substring(0, 100) : '';
          logger.debug(`[kimi] 🔧 Tool call received: ${msg.toolName} (${msg.callId})`);
          
          messageBuffer.addMessage(`Executing: ${msg.toolName}${toolArgs ? ` ${toolArgs}${toolArgs.length >= 100 ? '...' : ''}` : ''}`, 'tool');
          session.sendAgentMessage('kimi', {
            type: 'tool-call',
            name: msg.toolName,
            callId: msg.callId,
            input: msg.args,
            id: randomUUID(),
          });
          break;

        case 'tool-result':
          // Track change_title completion
          if (msg.toolName === 'change_title' || 
              msg.callId?.includes('change_title') ||
              msg.toolName === 'happy__change_title') {
            changeTitleCompleted = true;
            logger.debug('[kimi] change_title completed');
          }
          
          // Show tool result in UI
          const isError = msg.result && typeof msg.result === 'object' && 'error' in msg.result;
          const resultText = typeof msg.result === 'string' 
            ? msg.result.substring(0, 200)
            : JSON.stringify(msg.result).substring(0, 200);
          const truncatedResult = resultText + (typeof msg.result === 'string' && msg.result.length > 200 ? '...' : '');
          
          const resultSize = typeof msg.result === 'string' 
            ? msg.result.length 
            : JSON.stringify(msg.result).length;
          
          logger.debug(`[kimi] ${isError ? '❌' : '✅'} Tool result received: ${msg.toolName} (${msg.callId}) - Size: ${resultSize} bytes${isError ? ' [ERROR]' : ''}`);
          
          // Process tool result through diff processor
          if (!isError) {
            diffProcessor.processToolResult(msg.toolName, msg.result, msg.callId);
          }
          
          if (isError) {
            const errorMsg = (msg.result as any).error || 'Tool call failed';
            logger.debug(`[kimi] ❌ Tool call error: ${errorMsg.substring(0, 300)}`);
            messageBuffer.addMessage(`Error: ${errorMsg}`, 'status');
          } else {
            // Log summary for large results
            if (resultSize > 1000) {
              logger.debug(`[kimi] ✅ Large tool result (${resultSize} bytes) - first 200 chars: ${truncatedResult}`);
            }
            messageBuffer.addMessage(`Result: ${truncatedResult}`, 'result');
          }
          
          session.sendAgentMessage('kimi', {
            type: 'tool-result',
            callId: msg.callId,
            output: msg.result,
            id: randomUUID(),
          });
          break;

        case 'fs-edit':
          messageBuffer.addMessage(`File edit: ${msg.description}`, 'tool');
          
          // Process fs-edit through diff processor
          diffProcessor.processFsEdit(msg.path || '', msg.description, msg.diff);
          
          session.sendAgentMessage('kimi', {
            type: 'file-edit',
            description: msg.description,
            diff: msg.diff,
            filePath: msg.path || 'unknown',
            id: randomUUID(),
          });
          break;

        default:
          // Handle token-count and other potential message types
          if ((msg as any).type === 'token-count') {
            session.sendAgentMessage('kimi', {
              type: 'token_count',
              ...(msg as any),
              id: randomUUID(),
            });
          }
          break;

        case 'terminal-output':
          messageBuffer.addMessage(msg.data, 'result');
          session.sendAgentMessage('kimi', {
            type: 'terminal-output',
            data: msg.data,
            callId: (msg as any).callId || randomUUID(),
          });
          break;

        case 'permission-request':
          // Forward permission request to mobile app
          const payload = (msg as any).payload || {};
          session.sendAgentMessage('kimi', {
            type: 'permission-request',
            permissionId: msg.id,
            toolName: payload.toolName || (msg as any).reason || 'unknown',
            description: (msg as any).reason || payload.toolName || '',
            options: payload,
          });
          break;

        case 'exec-approval-request':
          // Handle exec approval request
          const execApprovalMsg = msg as any;
          const callId = execApprovalMsg.call_id || execApprovalMsg.callId || randomUUID();
          const { call_id, type, ...inputs } = execApprovalMsg;
          
          logger.debug(`[kimi] Exec approval request received: ${callId}`);
          messageBuffer.addMessage(`Exec approval requested: ${callId}`, 'tool');
          
          session.sendAgentMessage('kimi', {
            type: 'tool-call',
            name: 'KimiBash',
            callId: callId,
            input: inputs,
            id: randomUUID(),
          });
          break;

        case 'patch-apply-begin':
          // Handle patch operation begin
          const patchBeginMsg = msg as any;
          const patchCallId = patchBeginMsg.call_id || patchBeginMsg.callId || randomUUID();
          
          const changeCount = patchBeginMsg.changes ? Object.keys(patchBeginMsg.changes).length : 0;
          const filesMsg = changeCount === 1 ? '1 file' : `${changeCount} files`;
          messageBuffer.addMessage(`Modifying ${filesMsg}...`, 'tool');
          logger.debug(`[kimi] Patch apply begin: ${patchCallId}, files: ${changeCount}`);
          
          session.sendAgentMessage('kimi', {
            type: 'tool-call',
            name: 'KimiPatch',
            callId: patchCallId,
            input: {
              auto_approved: patchBeginMsg.auto_approved,
              changes: patchBeginMsg.changes
            },
            id: randomUUID(),
          });
          break;

        case 'patch-apply-end':
          // Handle patch operation end
          const patchEndMsg = msg as any;
          const patchEndCallId = patchEndMsg.call_id || patchEndMsg.callId || randomUUID();
          
          if (patchEndMsg.success) {
            const message = patchEndMsg.stdout || 'Files modified successfully';
            messageBuffer.addMessage(message.substring(0, 200), 'result');
          } else {
            const errorMsg = patchEndMsg.stderr || 'Failed to modify files';
            messageBuffer.addMessage(`Error: ${errorMsg.substring(0, 200)}`, 'result');
          }
          logger.debug(`[kimi] Patch apply end: ${patchEndCallId}, success: ${patchEndMsg.success}`);
          
          session.sendAgentMessage('kimi', {
            type: 'tool-result',
            callId: patchEndCallId,
            output: {
              stdout: patchEndMsg.stdout,
              stderr: patchEndMsg.stderr,
              success: patchEndMsg.success
            },
            id: randomUUID(),
          });
          break;

        case 'event':
          // Handle thinking events - process through ReasoningProcessor
          if (msg.name === 'thinking') {
            const thinkingPayload = msg.payload as { text?: string } | undefined;
            const thinkingText = (thinkingPayload && typeof thinkingPayload === 'object' && 'text' in thinkingPayload)
              ? String(thinkingPayload.text || '')
              : '';
            if (thinkingText) {
              // Process thinking chunk through reasoning processor
              reasoningProcessor.processChunk(thinkingText);
              
              logger.debug(`[kimi] 💭 Thinking chunk received: ${thinkingText.length} chars - Preview: ${thinkingText.substring(0, 100)}...`);
              
              // Show thinking message in UI
              if (!thinkingText.startsWith('**')) {
                const thinkingPreview = thinkingText.substring(0, 100);
                messageBuffer.updateLastMessage(`[Thinking] ${thinkingPreview}...`, 'system');
              }
            }
            // Also forward to mobile for UI feedback
            session.sendAgentMessage('kimi', {
              type: 'thinking',
              text: thinkingText,
            });
          }
          break;
      }
    });
  }

  let first = true;

  try {
    let currentModeHash: string | null = null;
    let pending: { message: string; mode: KimiMode; isolate: boolean; hash: string } | null = null;

    while (!shouldExit) {
      let message: { message: string; mode: KimiMode; isolate: boolean; hash: string } | null = pending;
      pending = null;

      if (!message) {
        logger.debug('[kimi] Main loop: waiting for messages from queue...');
        const waitSignal = abortController.signal;
        const batch = await messageQueue.waitForMessagesAndGetAsString(waitSignal);
        if (!batch) {
          if (waitSignal.aborted && !shouldExit) {
            logger.debug('[kimi] Main loop: wait aborted, continuing...');
            continue;
          }
          logger.debug('[kimi] Main loop: no batch received, breaking...');
          break;
        }
        logger.debug(`[kimi] Main loop: received message from queue (length: ${batch.message.length})`);
        message = batch;
      }

      if (!message) {
        break;
      }

      // Track if we need to inject conversation history (after model change)
      let injectHistoryContext = false;
      
      // Handle mode change - restart session if permission mode or model changed
      if (wasSessionCreated && currentModeHash && message.hash !== currentModeHash) {
        logger.debug('[Kimi] Mode changed – restarting Kimi session');
        messageBuffer.addMessage('═'.repeat(40), 'status');
        
        // Check if we have conversation history to preserve
        if (conversationHistory.hasHistory()) {
          messageBuffer.addMessage(`Switching model (preserving ${conversationHistory.size()} messages of context)...`, 'status');
          injectHistoryContext = true;
          logger.debug(`[Kimi] Will inject conversation history: ${conversationHistory.getSummary()}`);
        } else {
          messageBuffer.addMessage('Starting new Kimi session (mode changed)...', 'status');
        }
        
        // Reset permission handler and reasoning processor on mode change
        permissionHandler.reset();
        reasoningProcessor.abort();
        
        // Dispose old backend and create new one with new model
        if (kimiBackend) {
          await kimiBackend.dispose();
          kimiBackend = null;
        }

        // Create new backend with new model
        const modelToUse = message.mode?.model === undefined ? undefined : (message.mode.model || null);
        const backendResult = createKimiBackend({
          cwd: process.cwd(),
          mcpServers,
          permissionHandler,
          // Pass model from message - if undefined, will use local config/env/default
          model: modelToUse,
        });
        kimiBackend = backendResult.backend;

        // Set up message handler again
        setupKimiMessageHandler(kimiBackend);

        // Use model from factory result
        const actualModel = backendResult.model;
        logger.debug(`[kimi] Model change - modelToUse=${modelToUse}, actualModel=${actualModel} (from ${backendResult.modelSource})`);
        
        // Update conversation history with new model
        conversationHistory.setCurrentModel(actualModel);
        
        logger.debug('[kimi] Starting new ACP session with model:', actualModel);
        const { sessionId } = await kimiBackend.startSession();
        acpSessionId = sessionId;
        logger.debug(`[kimi] New ACP session started: ${acpSessionId}`);
        
        // Update displayed model in UI
        logger.debug(`[kimi] Calling updateDisplayedModel with: ${actualModel}`);
        updateDisplayedModel(actualModel, false);
        
        // Update permission handler with current permission mode
        updatePermissionMode(message.mode.permissionMode);
        
        wasSessionCreated = true;
        currentModeHash = message.hash;
        first = false;
      }

      currentModeHash = message.hash;
      // Show only original user message in UI, not the full prompt with system prompt
      const userMessageToShow = message.mode?.originalUserMessage || message.message;
      messageBuffer.addMessage(userMessageToShow, 'user');

      // Mark that we're processing a message to synchronize session swaps
      isProcessingMessage = true;

      try {
        if (first || !wasSessionCreated) {
          // First message or session not created yet - create backend and start session
          if (!kimiBackend) {
            const modelToUse = message.mode?.model === undefined ? undefined : (message.mode.model || null);
            const backendResult = createKimiBackend({
              cwd: process.cwd(),
              mcpServers,
              permissionHandler,
              model: modelToUse,
            });
            kimiBackend = backendResult.backend;

            // Set up message handler
            setupKimiMessageHandler(kimiBackend);

            // Use model from factory result
            const actualModel = backendResult.model;
            logger.debug(`[kimi] Backend created, model will be: ${actualModel} (from ${backendResult.modelSource})`);
            logger.debug(`[kimi] Calling updateDisplayedModel with: ${actualModel}`);
            updateDisplayedModel(actualModel, false);
            
            // Track current model in conversation history
            conversationHistory.setCurrentModel(actualModel);
          }
          
          // Start session if not started
          if (!acpSessionId) {
            logger.debug('[kimi] Starting ACP session...');
            updatePermissionMode(message.mode.permissionMode);
            const { sessionId } = await kimiBackend.startSession();
            acpSessionId = sessionId;
            logger.debug(`[kimi] ACP session started: ${acpSessionId}`);
            wasSessionCreated = true;
            currentModeHash = message.hash;
          }
        }
        
        if (!acpSessionId) {
          throw new Error('ACP session not started');
        }
         
        // Reset accumulator when sending a new prompt
        accumulatedResponse = '';
        isResponseInProgress = false;
        hadToolCallInTurn = false;
        taskStartedSent = false;
        
        // Track if this prompt contains change_title instruction
        pendingChangeTitle = message.message.includes('change_title') || 
                             message.message.includes('happy__change_title');
        changeTitleCompleted = false;
        
        if (!kimiBackend || !acpSessionId) {
          throw new Error('Kimi backend or session not initialized');
        }
        
        // The prompt already includes system prompt and change_title instruction
        let promptToSend = message.message;
        
        // Inject conversation history context if model was just changed
        if (injectHistoryContext && conversationHistory.hasHistory()) {
          const historyContext = conversationHistory.getContextForNewSession();
          promptToSend = historyContext + promptToSend;
          logger.debug(`[kimi] Injected conversation history context (${historyContext.length} chars)`);
        }
        
        logger.debug(`[kimi] Sending prompt to Kimi (length: ${promptToSend.length}): ${promptToSend.substring(0, 100)}...`);
        
        // Send prompt to Kimi backend
        await kimiBackend.sendPrompt(acpSessionId, promptToSend);
        logger.debug('[kimi] Prompt sent successfully');
        
        // Wait for Kimi to finish responding (all chunks received + final idle)
        if (kimiBackend.waitForResponseComplete) {
          await kimiBackend.waitForResponseComplete(120000);
          logger.debug('[kimi] Response complete');
        }
        
        // Mark as not first message after sending prompt
        if (first) {
          first = false;
        }
      } catch (error) {
        logger.debug('[kimi] Error in kimi session:', error);
        const isAbortError = error instanceof Error && error.name === 'AbortError';

        if (isAbortError) {
          messageBuffer.addMessage('Aborted by user', 'status');
          session.sendSessionEvent({ type: 'message', message: 'Aborted by user' });
        } else {
          // Parse error message
          let errorMsg = 'Process error occurred';
          
          if (typeof error === 'object' && error !== null) {
            const errObj = error as any;
            
            // Extract error information from various possible formats
            const errorDetails = errObj.data?.details || errObj.details || '';
            const errorCode = errObj.code || errObj.status || (errObj.response?.status);
            const errorMessage = errObj.message || errObj.error?.message || '';
            const errorString = String(error);
            
            // Check for authentication error
            if (errorMessage.includes('Authentication required') || 
                errorMessage.includes('401') || 
                errorDetails.includes('Authentication required') ||
                errorCode === 401) {
              errorMsg = `Authentication required.\n` +
                         `Please run: kimi login\n` +
                         `This will authenticate you with the Kimi API.`;
            }
            // Check for rate limit error (429)
            else if (errorCode === 429 || 
                     errorDetails.includes('429') || errorMessage.includes('429') ||
                     errorDetails.includes('rateLimitExceeded') || 
                     errorMessage.includes('Rate limit exceeded')) {
              errorMsg = 'Kimi API rate limit exceeded. Please wait a moment and try again.';
            }
            // Check for empty error (command not found)
            else if (Object.keys(error).length === 0) {
              errorMsg = 'Failed to start Kimi. Is "kimi" CLI installed? Run: pip install kimi-cli';
            }
            // Use message from error object
            else if (errObj.message || errorMessage) {
              errorMsg = errorDetails || errorMessage || errObj.message;
            }
          } else if (error instanceof Error) {
            errorMsg = error.message;
          }
          
          messageBuffer.addMessage(errorMsg, 'status');
          session.sendAgentMessage('kimi', {
            type: 'message',
            message: errorMsg,
          });
        }
      } finally {
        // Reset permission handler, reasoning processor, and diff processor after turn
        permissionHandler.reset();
        reasoningProcessor.abort();
        diffProcessor.reset();
        
        // Send accumulated response to mobile app ONLY when turn is complete
        if (accumulatedResponse.trim()) {
          // Record assistant response in conversation history
          conversationHistory.addAssistantMessage(accumulatedResponse);
          
          const messagePayload: KimiMessagePayload = {
            type: 'message',
            message: accumulatedResponse,
            id: randomUUID(),
          };
          
          logger.debug(`[kimi] Sending complete message to mobile (length: ${accumulatedResponse.length}): ${accumulatedResponse.substring(0, 100)}...`);
          session.sendAgentMessage('kimi', messagePayload);
          accumulatedResponse = '';
          isResponseInProgress = false;
        }
        
        // Send task_complete ONCE at the end of turn
        session.sendAgentMessage('kimi', {
          type: 'task_complete',
          id: randomUUID(),
        });
        
        // Reset tracking flags
        hadToolCallInTurn = false;
        pendingChangeTitle = false;
        changeTitleCompleted = false;
        taskStartedSent = false;
        
        thinking = false;
        session.keepAlive(thinking, 'remote');
        
        // Emit ready if idle
        emitReadyIfIdle();

        // Message processing complete - safe to apply any pending session swap
        isProcessingMessage = false;
        applyPendingSessionSwap();

        logger.debug(`[kimi] Main loop: turn completed, continuing to next iteration (queue size: ${messageQueue.size()})`);
      }
    }

  } finally {
    // Clean up resources
    logger.debug('[kimi]: Final cleanup start');

    // Cancel offline reconnection if still running
    if (reconnectionHandle) {
      logger.debug('[kimi]: Cancelling offline reconnection');
      reconnectionHandle.cancel();
    }

    try {
      session.sendSessionDeath();
      await session.flush();
      await session.close();
    } catch (e) {
      logger.debug('[kimi]: Error while closing session', e);
    }

    if (kimiBackend) {
      await kimiBackend.dispose();
    }

    happyServer.stop();

    if (process.stdin.isTTY) {
      try { process.stdin.setRawMode(false); } catch { /* ignore */ }
    }
    if (hasTTY) {
      try { process.stdin.pause(); } catch { /* ignore */ }
    }

    clearInterval(keepAliveInterval);
    if (inkInstance) {
      inkInstance.unmount();
    }
    messageBuffer.clear();

    logger.debug('[kimi]: Final cleanup completed');
  }
}

// Import chalk for error messages
import chalk from 'chalk';
