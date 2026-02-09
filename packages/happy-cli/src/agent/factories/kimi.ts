/**
 * Kimi ACP Backend - Kimi Code CLI agent via ACP
 * 
 * This module provides a factory function for creating a Kimi backend
 * that communicates using the Agent Client Protocol (ACP).
 * 
 * Kimi CLI is a reference ACP implementation that supports
 * the `acp` subcommand for ACP mode.
 * 
 * Authentication approach:
 * - Users must authenticate Kimi CLI directly via `kimi login` before using `happy kimi`
 * - We skip `happy connect kimi` integration to avoid cloud token storage complexity
 * - The API key is read from local Kimi CLI config (~/.kimi/config.toml)
 */

import { AcpBackend, type AcpBackendOptions, type AcpPermissionHandler } from '../acp/AcpBackend';
import type { AgentBackend, McpServerConfig, AgentFactoryOptions } from '../core';
import { agentRegistry } from '../core';
import { kimiTransport } from '../transport';
import { logger } from '@/ui/logger';
import { 
  KIMI_API_KEY_ENV, 
  KIMI_MODEL_ENV, 
  DEFAULT_KIMI_MODEL 
} from '@/kimi/constants';
import { 
  readKimiLocalConfig, 
  determineKimiModel,
  getKimiModelSource
} from '@/kimi/utils/config';

/**
 * Options for creating a Kimi ACP backend
 */
export interface KimiBackendOptions extends AgentFactoryOptions {
  /** API key for Kimi (defaults to KIMI_API_KEY env var or local config) */
  apiKey?: string;
  
  /** Model to use. If undefined, will use local config, env var, or default.
   *  If explicitly set to null, will use default (skip local config).
   *  (defaults to KIMI_MODEL env var or 'kimi-latest') */
  model?: string | null;
  
  /** MCP servers to make available to the agent */
  mcpServers?: Record<string, McpServerConfig>;
  
  /** Optional permission handler for tool approval */
  permissionHandler?: AcpPermissionHandler;
}

/**
 * Result of creating a Kimi backend
 */
export interface KimiBackendResult {
  /** The created AgentBackend instance */
  backend: AgentBackend;
  /** The resolved model that will be used (single source of truth) */
  model: string;
  /** Source of the model selection for logging */
  modelSource: 'explicit' | 'env-var' | 'local-config' | 'default';
}

/**
 * Create a Kimi backend using ACP.
 *
 * The Kimi CLI must be installed and available in PATH.
 * Uses the `acp` subcommand to enable ACP mode.
 *
 * Authentication:
 * Users must run `kimi login` to authenticate before using this backend.
 * We do not use 'happy connect kimi' - authentication is handled directly
 * by the Kimi CLI and stored in ~/.kimi/config.toml
 *
 * @param options - Configuration options
 * @returns KimiBackendResult with backend and resolved model (single source of truth)
 */
export function createKimiBackend(options: KimiBackendOptions): KimiBackendResult {

  // Resolve API key from multiple sources (in priority order):
  // 1. Explicit apiKey option - highest priority
  // 2. Local Kimi CLI config files (~/.kimi/config.toml)
  // 3. KIMI_API_KEY environment variable - lowest priority
  
  // Try reading from local Kimi CLI config (token and model)
  const localConfig = readKimiLocalConfig();
  
  let apiKey = options.apiKey                      // 1. Explicit apiKey option
    || localConfig.token                           // 2. Local config (~/.kimi/)
    || process.env[KIMI_API_KEY_ENV];              // 3. KIMI_API_KEY env var

  if (!apiKey) {
    logger.warn(`[Kimi] No API key found. Run 'kimi login' to authenticate, or set ${KIMI_API_KEY_ENV} environment variable.`);
  }

  // Command to run kimi
  const kimiCommand = 'kimi';
  
  // Get model from options, local config, system environment, or use default
  // Priority: options.model (if provided) > local config > env var > default
  // If options.model is undefined, check local config, then env, then use default
  // If options.model is explicitly null, skip local config and use env/default
  const model = determineKimiModel(options.model, localConfig);

  // Build args - use `kimi acp` subcommand for ACP mode
  // Model is passed via KIMI_MODEL env var (kimi CLI reads it automatically)
  const kimiArgs = ['acp'];

  const backendOptions: AcpBackendOptions = {
    agentName: 'kimi',
    cwd: options.cwd,
    command: kimiCommand,
    args: kimiArgs,
    env: {
      ...options.env,
      ...(apiKey ? { [KIMI_API_KEY_ENV]: apiKey } : {}),
      // Pass model via env var - kimi CLI reads KIMI_MODEL automatically
      [KIMI_MODEL_ENV]: model,
      // Suppress debug output from kimi CLI to avoid stdout pollution
      NODE_ENV: 'production',
      DEBUG: '',
    },
    mcpServers: options.mcpServers,
    permissionHandler: options.permissionHandler,
    transportHandler: kimiTransport,
    // Check if prompt instructs the agent to change title (for auto-approval of change_title tool)
    hasChangeTitleInstruction: (prompt: string) => {
      const lower = prompt.toLowerCase();
      return lower.includes('change_title') ||
             lower.includes('change title') ||
             lower.includes('set title') ||
             lower.includes('mcp__happy__change_title');
    },
  };

  // Determine model source for logging
  const modelSource = getKimiModelSource(options.model, localConfig);

  logger.debug('[Kimi] Creating ACP SDK backend with options:', {
    cwd: backendOptions.cwd,
    command: backendOptions.command,
    args: backendOptions.args,
    hasApiKey: !!apiKey,
    model: model,
    modelSource: modelSource,
    mcpServerCount: options.mcpServers ? Object.keys(options.mcpServers).length : 0,
  });

  return {
    backend: new AcpBackend(backendOptions),
    model,
    modelSource,
  };
}

/**
 * Register Kimi backend with the global agent registry.
 * 
 * This function should be called during application initialization
 * to make the Kimi agent available for use.
 */
export function registerKimiAgent(): void {
  agentRegistry.register('kimi', (opts) => createKimiBackend(opts).backend);
  logger.debug('[Kimi] Registered with agent registry');
}
