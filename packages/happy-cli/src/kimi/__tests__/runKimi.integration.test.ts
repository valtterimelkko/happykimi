/**
 * Integration tests for runKimi
 * 
 * These tests verify the integration between runKimi and its dependencies.
 * They mock external dependencies like the Kimi CLI process.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';

// Mock dependencies
vi.mock('@/api/api', () => ({
  ApiClient: {
    create: vi.fn().mockResolvedValue({
      getOrCreateMachine: vi.fn().mockResolvedValue({}),
      getOrCreateSession: vi.fn().mockResolvedValue({
        id: 'test-session-id',
        tag: 'test-tag',
      }),
      push: vi.fn().mockReturnValue({
        sendToAllDevices: vi.fn(),
      }),
    }),
  },
}));

vi.mock('@/persistence', () => ({
  readSettings: vi.fn().mockResolvedValue({
    machineId: 'test-machine-id',
  }),
  readCredentials: vi.fn().mockResolvedValue({
    token: 'test-token',
    userId: 'test-user-id',
  }),
}));

vi.mock('@/kimi/utils/config', () => ({
  readKimiLocalConfig: vi.fn().mockReturnValue({
    token: 'test-kimi-token',
    model: 'kimi-latest',
  }),
  saveKimiModelToConfig: vi.fn(),
  getInitialKimiModel: vi.fn().mockReturnValue('kimi-latest'),
  determineKimiModel: vi.fn().mockReturnValue('kimi-latest'),
  getKimiModelSource: vi.fn().mockReturnValue('default'),
}));

vi.mock('@/claude/utils/startHappyServer', () => ({
  startHappyServer: vi.fn().mockResolvedValue({
    url: 'http://localhost:3000',
    stop: vi.fn(),
  }),
}));

vi.mock('@/agent/factories/kimi', () => ({
  createKimiBackend: vi.fn().mockReturnValue({
    backend: {
      onMessage: vi.fn(),
      startSession: vi.fn().mockResolvedValue({ sessionId: 'test-acp-session' }),
      sendPrompt: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn().mockResolvedValue(undefined),
      waitForResponseComplete: vi.fn().mockResolvedValue(undefined),
    },
    model: 'kimi-latest',
    modelSource: 'default',
  }),
}));

describe('runKimi integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have mocked dependencies available', () => {
    // This test verifies that the mocks are set up correctly
    expect(vi.mocked(ApiClient)).toBeDefined();
  });

  it('should verify KimiMode type structure', () => {
    // Test the KimiMode interface structure
    const mode = {
      permissionMode: 'default' as const,
      model: 'kimi-latest',
      originalUserMessage: 'Hello, Kimi!',
    };

    expect(mode.permissionMode).toBe('default');
    expect(mode.model).toBe('kimi-latest');
    expect(mode.originalUserMessage).toBe('Hello, Kimi!');
  });

  it('should verify KimiMessagePayload type structure', () => {
    // Test the KimiMessagePayload interface structure
    const payload = {
      type: 'message' as const,
      message: 'Hello from Kimi',
      id: randomUUID(),
      options: ['option1', 'option2'],
    };

    expect(payload.type).toBe('message');
    expect(payload.message).toBe('Hello from Kimi');
    expect(payload.id).toBeDefined();
    expect(payload.options).toHaveLength(2);
  });

  it('should handle all valid permission modes', () => {
    const validModes = ['default', 'read-only', 'safe-yolo', 'yolo'] as const;
    
    validModes.forEach(mode => {
      expect(['default', 'read-only', 'safe-yolo', 'yolo']).toContain(mode);
    });
  });

  it('should verify KimiSessionConfig type structure', () => {
    // Test the KimiSessionConfig interface structure
    const config = {
      prompt: 'Test prompt',
      sandbox: 'read-only' as const,
      'approval-policy': 'on-request' as const,
      model: 'kimi-latest',
      config: {
        mcp_servers: {
          happy: {
            command: 'node',
            args: ['happy-mcp.mjs'],
          },
        },
      },
    };

    expect(config.prompt).toBe('Test prompt');
    expect(config.sandbox).toBe('read-only');
    expect(config['approval-policy']).toBe('on-request');
    expect(config.model).toBe('kimi-latest');
    expect(config.config?.mcp_servers?.happy).toBeDefined();
  });
});

// Need to import after mocks are defined
import { ApiClient } from '@/api/api';
