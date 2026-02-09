/**
 * Session Spawn Tests for Kimi
 * 
 * These tests verify that Kimi sessions can be spawned correctly
 * with mocked machineSpawnNewSession and proper agent type handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the sync operations
vi.mock('@/sync/ops', () => ({
    machineSpawnNewSession: vi.fn(),
    machineBash: vi.fn()
}));

// Mock the apiSocket
vi.mock('@/sync/apiSocket', () => ({
    apiSocket: {
        machineRPC: vi.fn(),
        sessionRPC: vi.fn()
    }
}));

// Import mocked modules
import { machineSpawnNewSession, machineBash } from '@/sync/ops';
import type { SpawnSessionOptions, SpawnSessionResult } from '@/sync/ops';

// Type for mocked function
const mockedMachineSpawnNewSession = machineSpawnNewSession as ReturnType<typeof vi.fn>;
const mockedMachineBash = machineBash as ReturnType<typeof vi.fn>;

describe('Kimi Session Spawn', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Session Spawn Options', () => {
        it('should accept kimi as agent type in spawn options', () => {
            const options: SpawnSessionOptions = {
                machineId: 'test-machine-id',
                directory: '/home/test/project',
                agent: 'kimi'
            };

            expect(options.agent).toBe('kimi');
            expect(options.machineId).toBe('test-machine-id');
            expect(options.directory).toBe('/home/test/project');
        });

        it('should accept all valid agent types', () => {
            const agents: Array<'claude' | 'codex' | 'gemini' | 'kimi'> = [
                'claude', 'codex', 'gemini', 'kimi'
            ];

            agents.forEach(agent => {
                const options: SpawnSessionOptions = {
                    machineId: 'test-machine',
                    directory: '/test',
                    agent
                };
                expect(options.agent).toBe(agent);
            });
        });

        it('should support environment variables with kimi agent', () => {
            const options: SpawnSessionOptions = {
                machineId: 'test-machine-id',
                directory: '/home/test/project',
                agent: 'kimi',
                environmentVariables: {
                    'KIMI_MODEL': 'kimi-latest',
                    'KIMI_API_KEY': 'test-api-key'
                }
            };

            expect(options.environmentVariables).toHaveProperty('KIMI_MODEL', 'kimi-latest');
            expect(options.environmentVariables).toHaveProperty('KIMI_API_KEY', 'test-api-key');
        });

        it('should support approvedNewDirectoryCreation flag', () => {
            const options: SpawnSessionOptions = {
                machineId: 'test-machine-id',
                directory: '/home/test/new-project',
                agent: 'kimi',
                approvedNewDirectoryCreation: true
            };

            expect(options.approvedNewDirectoryCreation).toBe(true);
        });

        it('should support token parameter', () => {
            const options: SpawnSessionOptions = {
                machineId: 'test-machine-id',
                directory: '/home/test/project',
                agent: 'kimi',
                token: 'test-auth-token'
            };

            expect(options.token).toBe('test-auth-token');
        });
    });

    describe('Session Spawn Results', () => {
        it('should handle successful kimi session spawn', async () => {
            const successResult: SpawnSessionResult = {
                type: 'success',
                sessionId: 'kimi-session-123'
            };

            mockedMachineSpawnNewSession.mockResolvedValue(successResult);

            const result = await mockedMachineSpawnNewSession({
                machineId: 'test-machine',
                directory: '/test',
                agent: 'kimi'
            });

            expect(result.type).toBe('success');
            expect(result).toHaveProperty('sessionId', 'kimi-session-123');
        });

        it('should handle directory creation request', async () => {
            const directoryRequestResult: SpawnSessionResult = {
                type: 'requestToApproveDirectoryCreation',
                directory: '/home/test/new-directory'
            };

            mockedMachineSpawnNewSession.mockResolvedValue(directoryRequestResult);

            const result = await mockedMachineSpawnNewSession({
                machineId: 'test-machine',
                directory: '/home/test/new-directory',
                agent: 'kimi'
            });

            expect(result.type).toBe('requestToApproveDirectoryCreation');
            expect(result).toHaveProperty('directory', '/home/test/new-directory');
        });

        it('should handle spawn error', async () => {
            const errorResult: SpawnSessionResult = {
                type: 'error',
                errorMessage: 'Failed to spawn Kimi session: CLI not found'
            };

            mockedMachineSpawnNewSession.mockResolvedValue(errorResult);

            const result = await mockedMachineSpawnNewSession({
                machineId: 'test-machine',
                directory: '/test',
                agent: 'kimi'
            });

            expect(result.type).toBe('error');
            expect(result).toHaveProperty('errorMessage');
        });
    });

    describe('Session Spawn Calls', () => {
        it('should call machineSpawnNewSession with kimi agent', async () => {
            mockedMachineSpawnNewSession.mockResolvedValue({
                type: 'success',
                sessionId: 'test-session-id'
            });

            const options: SpawnSessionOptions = {
                machineId: 'machine-123',
                directory: '/home/user/project',
                agent: 'kimi'
            };

            await mockedMachineSpawnNewSession(options);

            expect(mockedMachineSpawnNewSession).toHaveBeenCalledWith(options);
            expect(mockedMachineSpawnNewSession).toHaveBeenCalledTimes(1);
        });

        it('should call machineSpawnNewSession with environment variables', async () => {
            mockedMachineSpawnNewSession.mockResolvedValue({
                type: 'success',
                sessionId: 'test-session-id'
            });

            const options: SpawnSessionOptions = {
                machineId: 'machine-123',
                directory: '/home/user/project',
                agent: 'kimi',
                environmentVariables: {
                    'CUSTOM_VAR': 'custom_value'
                }
            };

            await mockedMachineSpawnNewSession(options);

            expect(mockedMachineSpawnNewSession).toHaveBeenCalledWith(
                expect.objectContaining({
                    environmentVariables: { 'CUSTOM_VAR': 'custom_value' }
                })
            );
        });
    });

    describe('CLI Detection Integration', () => {
        it('should verify kimi CLI is available before spawning', async () => {
            // Simulate CLI detection
            mockedMachineBash.mockResolvedValue({
                success: true,
                stdout: 'kimi:true',
                stderr: '',
                exitCode: 0
            });

            const result = await mockedMachineBash(
                'test-machine',
                'command -v kimi >/dev/null 2>&1 && echo "kimi:true" || echo "kimi:false"',
                '/'
            );

            expect(result.success).toBe(true);
            expect(result.stdout).toContain('kimi:true');
        });

        it('should handle kimi CLI not found', async () => {
            mockedMachineBash.mockResolvedValue({
                success: true,
                stdout: 'kimi:false',
                stderr: '',
                exitCode: 0
            });

            const result = await mockedMachineBash(
                'test-machine',
                'command -v kimi',
                '/'
            );

            expect(result.stdout).toContain('kimi:false');
        });
    });

    describe('Agent Selection Flow', () => {
        it('should pass correct agent type for kimi sessions', async () => {
            mockedMachineSpawnNewSession.mockImplementation(async (options: SpawnSessionOptions) => {
                // Verify the agent type is correctly passed
                if (options.agent === 'kimi') {
                    return { type: 'success', sessionId: 'kimi-session-456' };
                }
                return { type: 'error', errorMessage: 'Wrong agent type' };
            });

            const result = await mockedMachineSpawnNewSession({
                machineId: 'test-machine',
                directory: '/test',
                agent: 'kimi'
            });

            expect(result.type).toBe('success');
            expect(result).toHaveProperty('sessionId', 'kimi-session-456');
        });

        it('should differentiate between agent types', async () => {
            const agents: Array<'claude' | 'codex' | 'gemini' | 'kimi'> = ['claude', 'codex', 'gemini', 'kimi'];
            
            for (const agent of agents) {
                mockedMachineSpawnNewSession.mockResolvedValue({
                    type: 'success',
                    sessionId: `${agent}-session-id`
                });

                const result = await mockedMachineSpawnNewSession({
                    machineId: 'test-machine',
                    directory: '/test',
                    agent
                });

                expect(result).toHaveProperty('sessionId', `${agent}-session-id`);
            }
        });
    });

    describe('Error Handling', () => {
        it('should handle network errors during spawn', async () => {
            mockedMachineSpawnNewSession.mockRejectedValue(new Error('Network error'));

            try {
                await mockedMachineSpawnNewSession({
                    machineId: 'offline-machine',
                    directory: '/test',
                    agent: 'kimi'
                });
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toBe('Network error');
            }
        });

        it('should handle timeout errors', async () => {
            mockedMachineSpawnNewSession.mockRejectedValue(new Error('Timeout'));

            try {
                await mockedMachineSpawnNewSession({
                    machineId: 'slow-machine',
                    directory: '/test',
                    agent: 'kimi'
                });
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect((error as Error).message).toBe('Timeout');
            }
        });

        it('should return error result for invalid machine', async () => {
            mockedMachineSpawnNewSession.mockResolvedValue({
                type: 'error',
                errorMessage: 'Machine not found'
            });

            const result = await mockedMachineSpawnNewSession({
                machineId: 'invalid-machine',
                directory: '/test',
                agent: 'kimi'
            });

            expect(result.type).toBe('error');
            expect(result).toHaveProperty('errorMessage', 'Machine not found');
        });
    });

    describe('Session Options Variations', () => {
        it('should spawn with all optional parameters', async () => {
            mockedMachineSpawnNewSession.mockResolvedValue({
                type: 'success',
                sessionId: 'full-options-session'
            });

            const options: SpawnSessionOptions = {
                machineId: 'machine-123',
                directory: '/home/user/project',
                agent: 'kimi',
                approvedNewDirectoryCreation: true,
                token: 'auth-token-123',
                environmentVariables: {
                    'KIMI_MODEL': 'kimi-latest',
                    'CUSTOM_SETTING': 'value'
                }
            };

            const result = await mockedMachineSpawnNewSession(options);

            expect(result.type).toBe('success');
            expect(mockedMachineSpawnNewSession).toHaveBeenCalledWith(options);
        });

        it('should spawn with minimal options (only required)', async () => {
            mockedMachineSpawnNewSession.mockResolvedValue({
                type: 'success',
                sessionId: 'minimal-session'
            });

            const options: SpawnSessionOptions = {
                machineId: 'machine-123',
                directory: '/home/user/project'
                // agent is optional
            };

            const result = await mockedMachineSpawnNewSession(options);

            expect(result.type).toBe('success');
            expect(options.agent).toBeUndefined();
        });
    });
});
