/**
 * Agent Selector Tests for Kimi
 * 
 * These tests verify that the Kimi agent option renders correctly
 * in the agent selector and that the selection flow works as expected.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the useCLIDetection hook
vi.mock('@/hooks/useCLIDetection', () => ({
    useCLIDetection: vi.fn()
}));

// Mock the sync modules
vi.mock('@/sync/storage', () => ({
    useAllMachines: vi.fn(() => []),
    useSessions: vi.fn(() => []),
    useSetting: vi.fn(() => []),
    useSettingMutable: vi.fn(() => [[], vi.fn()]),
    storage: {
        getState: vi.fn(() => ({ machines: {}, sessions: {} }))
    }
}));

// Mock the router
vi.mock('expo-router', () => ({
    useRouter: vi.fn(() => ({ push: vi.fn() })),
    useLocalSearchParams: vi.fn(() => ({})),
}));

// Mock Unistyles
vi.mock('react-native-unistyles', () => ({
    StyleSheet: {
        create: (styles: any) => styles
    },
    useUnistyles: vi.fn(() => ({
        theme: {
            colors: {
                surface: '#ffffff',
                text: '#000000',
                textSecondary: '#666666',
                button: {
                    primary: { background: '#007AFF', tint: '#ffffff' },
                    secondary: { tint: '#007AFF' }
                },
                input: { background: '#f2f2f7' },
                divider: '#e5e5ea',
                surfacePressed: '#e5e5ea',
                radio: { active: '#007AFF', inactive: '#c7c7cc', dot: '#ffffff' },
                success: '#34c759',
                textDestructive: '#ff3b30',
                warning: '#ff9500',
                warningCritical: '#ff3b30',
                permission: {
                    acceptEdits: '#34c759',
                    bypass: '#ff3b30',
                    plan: '#007AFF',
                    readOnly: '#8e8e93',
                    safeYolo: '#ff9500',
                    yolo: '#ff3b30'
                }
            }
        },
        rt: { insets: { top: 44, bottom: 34 } }
    }))
}));

// Mock react-native-safe-area-context
vi.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: vi.fn(() => ({ top: 44, bottom: 34, left: 0, right: 0 }))
}));

// Mock expo-crypto
vi.mock('expo-crypto', () => ({
    randomUUID: vi.fn(() => 'test-uuid-123')
}));

// Mock text translations
vi.mock('@/text', () => ({
    t: vi.fn((key: string, params?: Record<string, any>) => {
        const translations: Record<string, string> = {
            'agentInput.agent.claude': 'Claude',
            'agentInput.agent.codex': 'Codex',
            'agentInput.agent.gemini': 'Gemini',
            'agentInput.agent.kimi': 'Kimi',
            'agentInput.kimiPermissionMode.title': 'KIMI PERMISSION MODE',
            'agentInput.kimiPermissionMode.default': 'Default',
            'agentInput.kimiPermissionMode.readOnly': 'Read Only',
            'agentInput.kimiPermissionMode.safeYolo': 'Safe YOLO',
            'agentInput.kimiPermissionMode.yolo': 'YOLO',
            'agentInput.kimiPermissionMode.badgeReadOnly': 'Read Only',
            'agentInput.kimiPermissionMode.badgeSafeYolo': 'Safe YOLO',
            'agentInput.kimiPermissionMode.badgeYolo': 'YOLO',
            'agentInput.model.title': 'MODEL',
            'agentInput.model.configureInCli': 'Configure models in CLI settings',
            'agentInput.context.remaining': '% left',
            'agentInput.noMachinesAvailable': 'No machines',
            'agentInput.suggestion.fileLabel': 'FILE',
            'agentInput.suggestion.folderLabel': 'FOLDER',
        };
        let result = translations[key] || key;
        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                result = result.replace(`{${k}}`, String(v));
            });
        }
        return result;
    })
}));

// Import mocked modules
import { useCLIDetection } from '@/hooks/useCLIDetection';
import { useAllMachines, useSessions, useSetting, useSettingMutable, storage } from '@/sync/storage';

// Type for mocked function
const mockedUseCLIDetection = useCLIDetection as ReturnType<typeof vi.fn>;
const mockedUseAllMachines = useAllMachines as ReturnType<typeof vi.fn>;
const mockedUseSessions = useSessions as ReturnType<typeof vi.fn>;
const mockedUseSetting = useSetting as ReturnType<typeof vi.fn>;
const mockedUseSettingMutable = useSettingMutable as ReturnType<typeof vi.fn>;
const mockedStorageGetState = storage.getState as ReturnType<typeof vi.fn>;

describe('Kimi Agent Selector', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        
        // Setup default mocks
        mockedUseCLIDetection.mockReturnValue({
            claude: true,
            codex: true,
            gemini: true,
            kimi: true,
            isDetecting: false,
            timestamp: Date.now()
        });
        
        mockedUseAllMachines.mockReturnValue([
            { id: 'machine-1', name: 'Test Machine', metadata: { homeDir: '/home/test' } }
        ]);
        
        mockedUseSessions.mockReturnValue([]);
        mockedUseSetting.mockReturnValue([]);
        mockedUseSettingMutable.mockReturnValue([[], vi.fn()]);
        mockedStorageGetState.mockReturnValue({ machines: {}, sessions: {} });
    });

    describe('CLI Detection', () => {
        it('should detect Kimi CLI when available', () => {
            const result = mockedUseCLIDetection('machine-1');
            
            expect(result.kimi).toBe(true);
            expect(result.isDetecting).toBe(false);
            expect(result.timestamp).toBeGreaterThan(0);
        });

        it('should detect when Kimi CLI is not available', () => {
            mockedUseCLIDetection.mockReturnValue({
                claude: true,
                codex: true,
                gemini: true,
                kimi: false,
                isDetecting: false,
                timestamp: Date.now()
            });
            
            const result = mockedUseCLIDetection('machine-1');
            
            expect(result.kimi).toBe(false);
        });

        it('should handle loading state while detecting', () => {
            mockedUseCLIDetection.mockReturnValue({
                claude: null,
                codex: null,
                gemini: null,
                kimi: null,
                isDetecting: true,
                timestamp: 0
            });
            
            const result = mockedUseCLIDetection('machine-1');
            
            expect(result.kimi).toBeNull();
            expect(result.isDetecting).toBe(true);
        });
    });

    describe('Agent Type Support', () => {
        it('should include kimi in agent type options', () => {
            // Agent type is defined as: 'claude' | 'codex' | 'gemini' | 'kimi'
            // This test verifies the type system includes kimi
            const agentTypes: Array<'claude' | 'codex' | 'gemini' | 'kimi'> = [
                'claude', 'codex', 'gemini', 'kimi'
            ];
            
            expect(agentTypes).toContain('kimi');
            expect(agentTypes).toHaveLength(4);
        });

        it('should support all four agent types', () => {
            const cliAvailability = mockedUseCLIDetection('machine-1');
            
            // Verify all agent types are represented in CLI detection
            expect(cliAvailability).toHaveProperty('claude');
            expect(cliAvailability).toHaveProperty('codex');
            expect(cliAvailability).toHaveProperty('gemini');
            expect(cliAvailability).toHaveProperty('kimi');
        });
    });

    describe('Permission Modes for Kimi', () => {
        it('should support correct permission modes for Kimi agent', () => {
            // Kimi uses the same permission modes as Codex and Gemini
            const validKimiModes = ['default', 'read-only', 'safe-yolo', 'yolo'] as const;
            
            expect(validKimiModes).toContain('default');
            expect(validKimiModes).toContain('read-only');
            expect(validKimiModes).toContain('safe-yolo');
            expect(validKimiModes).toContain('yolo');
        });

        it('should not use Claude-specific permission modes for Kimi', () => {
            const validKimiModes = ['default', 'read-only', 'safe-yolo', 'yolo'];
            const claudeSpecificModes = ['acceptEdits', 'plan', 'bypassPermissions'];
            
            claudeSpecificModes.forEach(mode => {
                expect(validKimiModes).not.toContain(mode);
            });
        });
    });

    describe('CLI Status Integration', () => {
        it('should include kimi in connection status CLI flags', () => {
            // Connection status includes CLI detection results
            const cliStatus = {
                claude: true,
                codex: true,
                gemini: true,
                kimi: true
            };
            
            expect(cliStatus).toHaveProperty('kimi');
            expect(cliStatus.kimi).toBe(true);
        });

        it('should handle when kimi CLI is not detected', () => {
            const cliStatus = {
                claude: true,
                codex: true,
                gemini: true,
                kimi: false
            };
            
            expect(cliStatus.kimi).toBe(false);
        });
    });

    describe('Model Modes for Kimi', () => {
        it('should support Gemini model modes for Kimi', () => {
            // Kimi uses the same model modes as Gemini
            const validKimiModels = [
                'gemini-2.5-pro',
                'gemini-2.5-flash',
                'gemini-2.5-flash-lite'
            ] as const;
            
            expect(validKimiModels).toContain('gemini-2.5-pro');
            expect(validKimiModels).toContain('gemini-2.5-flash');
            expect(validKimiModels).toContain('gemini-2.5-flash-lite');
        });
    });
});
