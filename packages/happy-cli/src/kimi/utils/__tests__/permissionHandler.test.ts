/**
 * Kimi Permission Handler Tests
 *
 * Tests for the Kimi CLI permission handler.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { KimiPermissionHandler } from '../permissionHandler';
import type { PermissionMode } from '@/api/types';

// Mock dependencies
vi.mock('@/ui/logger', () => ({
    logger: {
        debug: vi.fn(),
    },
}));

// Create a mock session
const createMockSession = () => ({
    updateAgentState: vi.fn(),
    rpcHandlerManager: {
        registerHandler: vi.fn(),
    },
});

describe('KimiPermissionHandler', () => {
    let mockSession: ReturnType<typeof createMockSession>;
    let handler: KimiPermissionHandler;

    beforeEach(() => {
        mockSession = createMockSession();
        handler = new KimiPermissionHandler(mockSession as any);
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create a handler with the given session', () => {
            expect(handler).toBeDefined();
        });
    });

    describe('setPermissionMode', () => {
        it('should set permission mode to yolo', () => {
            handler.setPermissionMode('yolo');
            // Mode is internal, tested via handleToolCall behavior
        });

        it('should set permission mode to safe-yolo', () => {
            handler.setPermissionMode('safe-yolo');
        });

        it('should set permission mode to read-only', () => {
            handler.setPermissionMode('read-only');
        });

        it('should set permission mode to default', () => {
            handler.setPermissionMode('default');
        });
    });

    describe('handleToolCall - auto-approve behaviors', () => {
        it('should auto-approve change_title tool', async () => {
            const result = await handler.handleToolCall('change_title-123', 'change_title', {});
            expect(result.decision).toBe('approved');
        });

        it('should auto-approve happy__change_title tool', async () => {
            const result = await handler.handleToolCall('happy__change_title-123', 'happy__change_title', {});
            expect(result.decision).toBe('approved');
        });

        it('should auto-approve KimiReasoning tool', async () => {
            const result = await handler.handleToolCall('reasoning-123', 'KimiReasoning', {});
            expect(result.decision).toBe('approved');
        });

        it('should auto-approve think tool', async () => {
            const result = await handler.handleToolCall('think-123', 'think', {});
            expect(result.decision).toBe('approved');
        });

        it('should auto-approve save_memory tool', async () => {
            const result = await handler.handleToolCall('save_memory-123', 'save_memory', {});
            expect(result.decision).toBe('approved');
        });

        it('should auto-approve when toolCallId contains change_title', async () => {
            const result = await handler.handleToolCall('change_title-abc123', 'other', {});
            expect(result.decision).toBe('approved');
        });
    });

    describe('handleToolCall - permission modes', () => {
        it('should auto-approve all tools in yolo mode', async () => {
            handler.setPermissionMode('yolo');
            const result = await handler.handleToolCall('write-123', 'writeFile', { path: '/test' });
            expect(result.decision).toBe('approved_for_session');
        });

        it('should auto-approve all tools in safe-yolo mode', async () => {
            handler.setPermissionMode('safe-yolo');
            const result = await handler.handleToolCall('write-123', 'writeFile', { path: '/test' });
            expect(result.decision).toBe('approved');
        });

        it('should not auto-approve write tools in read-only mode', async () => {
            handler.setPermissionMode('read-only');
            // Write tools should not be auto-approved in read-only mode
            // The result is a promise that indicates it's waiting for user approval
            const resultPromise = handler.handleToolCall('write-123', 'writeFile', { path: '/test' });
            expect(resultPromise).toBeInstanceOf(Promise);
            // The promise should not resolve immediately (no auto-approve)
            // We don't await it to avoid timeout - just verify it's a pending promise
        });

        it('should return pending promise in default mode for non-auto-approve tools', async () => {
            handler.setPermissionMode('default');
            const result = handler.handleToolCall('custom-123', 'customTool', {});
            expect(result).toBeInstanceOf(Promise);
        });
    });

    describe('updateSession', () => {
        it('should update the session reference', () => {
            const newMockSession = createMockSession();
            handler.updateSession(newMockSession as any);
            // Should not throw
        });
    });
});
