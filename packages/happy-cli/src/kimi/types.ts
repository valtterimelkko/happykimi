/**
 * Kimi Types
 *
 * Centralized type definitions for Kimi integration.
 */

import type { PermissionMode } from '@/api/types';

/**
 * Mode configuration for Kimi messages
 */
export interface KimiMode {
  permissionMode: PermissionMode;
  model?: string;
  originalUserMessage?: string; // Original user message without system prompt
}

/**
 * Kimi message payload for sending messages to mobile app
 */
export interface KimiMessagePayload {
  type: 'message';
  message: string;
  id: string;
  options?: string[];
}

/**
 * Kimi session configuration
 */
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
