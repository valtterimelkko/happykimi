/**
 * Profile Compatibility Tests for Kimi
 * 
 * These tests verify that profile validation works correctly with Kimi
 * compatibility flags and that the compatibility system supports all agents.
 */

import { describe, it, expect } from 'vitest';
import { 
    validateProfileForAgent, 
    AIBackendProfile,
    getProfileEnvironmentVariables 
} from '@/sync/settings';
import { getBuiltInProfile, DEFAULT_PROFILES } from '@/sync/profileUtils';

describe('Kimi Profile Compatibility', () => {
    describe('Profile Compatibility Schema', () => {
        it('should validate profile with all agents enabled', () => {
            const profile: AIBackendProfile = {
                id: 'test-profile',
                name: 'Test Profile',
                compatibility: {
                    claude: true,
                    codex: true,
                    gemini: true,
                    kimi: true
                },
                environmentVariables: [],
                isBuiltIn: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                version: '1.0.0'
            };

            expect(validateProfileForAgent(profile, 'kimi')).toBe(true);
            expect(validateProfileForAgent(profile, 'claude')).toBe(true);
            expect(validateProfileForAgent(profile, 'codex')).toBe(true);
            expect(validateProfileForAgent(profile, 'gemini')).toBe(true);
        });

        it('should validate profile with only kimi enabled', () => {
            const profile: AIBackendProfile = {
                id: 'kimi-only-profile',
                name: 'Kimi Only Profile',
                compatibility: {
                    claude: false,
                    codex: false,
                    gemini: false,
                    kimi: true
                },
                environmentVariables: [],
                isBuiltIn: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                version: '1.0.0'
            };

            expect(validateProfileForAgent(profile, 'kimi')).toBe(true);
            expect(validateProfileForAgent(profile, 'claude')).toBe(false);
            expect(validateProfileForAgent(profile, 'codex')).toBe(false);
            expect(validateProfileForAgent(profile, 'gemini')).toBe(false);
        });

        it('should validate profile with kimi disabled', () => {
            const profile: AIBackendProfile = {
                id: 'no-kimi-profile',
                name: 'No Kimi Profile',
                compatibility: {
                    claude: true,
                    codex: true,
                    gemini: true,
                    kimi: false
                },
                environmentVariables: [],
                isBuiltIn: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                version: '1.0.0'
            };

            expect(validateProfileForAgent(profile, 'kimi')).toBe(false);
            expect(validateProfileForAgent(profile, 'claude')).toBe(true);
            expect(validateProfileForAgent(profile, 'codex')).toBe(true);
            expect(validateProfileForAgent(profile, 'gemini')).toBe(true);
        });
    });

    describe('Built-in Profiles', () => {
        it('should have kimi disabled in Anthropic built-in profile', () => {
            const profile = getBuiltInProfile('anthropic');
            
            expect(profile).not.toBeNull();
            expect(profile!.compatibility.kimi).toBe(false);
            expect(profile!.compatibility.claude).toBe(true);
        });

        it('should have kimi disabled in DeepSeek built-in profile', () => {
            const profile = getBuiltInProfile('deepseek');
            
            expect(profile).not.toBeNull();
            expect(profile!.compatibility.kimi).toBe(false);
            expect(profile!.compatibility.claude).toBe(true);
        });

        it('should have kimi disabled in Z.AI built-in profile', () => {
            const profile = getBuiltInProfile('zai');
            
            expect(profile).not.toBeNull();
            expect(profile!.compatibility.kimi).toBe(false);
            expect(profile!.compatibility.claude).toBe(true);
        });

        it('should have kimi disabled in OpenAI built-in profile', () => {
            const profile = getBuiltInProfile('openai');
            
            expect(profile).not.toBeNull();
            expect(profile!.compatibility.kimi).toBe(false);
            expect(profile!.compatibility.codex).toBe(true);
        });

        it('should have kimi disabled in Azure OpenAI built-in profile', () => {
            const profile = getBuiltInProfile('azure-openai');
            
            expect(profile).not.toBeNull();
            expect(profile!.compatibility.kimi).toBe(false);
            expect(profile!.compatibility.codex).toBe(true);
        });
    });

    describe('DEFAULT_PROFILES Array', () => {
        it('should include all expected built-in profiles', () => {
            const profileIds = DEFAULT_PROFILES.map(p => p.id);
            
            expect(profileIds).toContain('anthropic');
            expect(profileIds).toContain('deepseek');
            expect(profileIds).toContain('zai');
            expect(profileIds).toContain('openai');
            expect(profileIds).toContain('azure-openai');
        });

        it('should have correct structure for all profiles', () => {
            DEFAULT_PROFILES.forEach(profile => {
                expect(profile).toHaveProperty('id');
                expect(profile).toHaveProperty('name');
                expect(profile).toHaveProperty('isBuiltIn');
                expect(profile.isBuiltIn).toBe(true);
            });
        });
    });

    describe('Profile Environment Variables', () => {
        it('should extract environment variables from profile', () => {
            const profile: AIBackendProfile = {
                id: 'test-env-profile',
                name: 'Test Env Profile',
                compatibility: { claude: true, codex: true, gemini: true, kimi: true },
                environmentVariables: [
                    { name: 'TEST_VAR', value: 'test_value' },
                    { name: 'ANOTHER_VAR', value: 'another_value' }
                ],
                isBuiltIn: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                version: '1.0.0'
            };

            const envVars = getProfileEnvironmentVariables(profile);
            
            expect(envVars).toHaveProperty('TEST_VAR', 'test_value');
            expect(envVars).toHaveProperty('ANOTHER_VAR', 'another_value');
        });

        it('should include Anthropic config variables', () => {
            const profile: AIBackendProfile = {
                id: 'test-anthropic-profile',
                name: 'Test Anthropic Profile',
                compatibility: { claude: true, codex: false, gemini: false, kimi: false },
                anthropicConfig: {
                    baseUrl: 'https://api.anthropic.com',
                    authToken: 'sk-test-token',
                    model: 'claude-3-opus-20240229'
                },
                environmentVariables: [],
                isBuiltIn: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                version: '1.0.0'
            };

            const envVars = getProfileEnvironmentVariables(profile);
            
            expect(envVars).toHaveProperty('ANTHROPIC_BASE_URL', 'https://api.anthropic.com');
            expect(envVars).toHaveProperty('ANTHROPIC_AUTH_TOKEN', 'sk-test-token');
            expect(envVars).toHaveProperty('ANTHROPIC_MODEL', 'claude-3-opus-20240229');
        });

        it('should include OpenAI config variables', () => {
            const profile: AIBackendProfile = {
                id: 'test-openai-profile',
                name: 'Test OpenAI Profile',
                compatibility: { claude: false, codex: true, gemini: false, kimi: false },
                openaiConfig: {
                    apiKey: 'sk-openai-test',
                    baseUrl: 'https://api.openai.com/v1',
                    model: 'gpt-4'
                },
                environmentVariables: [],
                isBuiltIn: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                version: '1.0.0'
            };

            const envVars = getProfileEnvironmentVariables(profile);
            
            expect(envVars).toHaveProperty('OPENAI_API_KEY', 'sk-openai-test');
            expect(envVars).toHaveProperty('OPENAI_BASE_URL', 'https://api.openai.com/v1');
            expect(envVars).toHaveProperty('OPENAI_MODEL', 'gpt-4');
        });

        it('should combine environment variables and config', () => {
            const profile: AIBackendProfile = {
                id: 'test-combined-profile',
                name: 'Test Combined Profile',
                compatibility: { claude: true, codex: true, gemini: true, kimi: true },
                environmentVariables: [
                    { name: 'CUSTOM_VAR', value: 'custom_value' }
                ],
                anthropicConfig: {
                    model: 'claude-3-haiku-20240307'
                },
                isBuiltIn: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                version: '1.0.0'
            };

            const envVars = getProfileEnvironmentVariables(profile);
            
            expect(envVars).toHaveProperty('CUSTOM_VAR', 'custom_value');
            expect(envVars).toHaveProperty('ANTHROPIC_MODEL', 'claude-3-haiku-20240307');
        });
    });

    describe('Profile Versioning', () => {
        it('should support version field in profile', () => {
            const profile: AIBackendProfile = {
                id: 'versioned-profile',
                name: 'Versioned Profile',
                compatibility: { claude: true, codex: true, gemini: true, kimi: true },
                environmentVariables: [],
                isBuiltIn: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                version: '2.0.0'
            };

            expect(profile.version).toBe('2.0.0');
        });

        it('should support createdAt and updatedAt timestamps', () => {
            const now = Date.now();
            const profile: AIBackendProfile = {
                id: 'timestamped-profile',
                name: 'Timestamped Profile',
                compatibility: { claude: true, codex: true, gemini: true, kimi: true },
                environmentVariables: [],
                isBuiltIn: false,
                createdAt: now,
                updatedAt: now,
                version: '1.0.0'
            };

            expect(profile.createdAt).toBe(now);
            expect(profile.updatedAt).toBe(now);
        });
    });

    describe('Agent Type Validation', () => {
        it('should accept all valid agent types', () => {
            const profile: AIBackendProfile = {
                id: 'all-agents-profile',
                name: 'All Agents Profile',
                compatibility: { claude: true, codex: true, gemini: true, kimi: true },
                environmentVariables: [],
                isBuiltIn: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                version: '1.0.0'
            };

            // Test that validateProfileForAgent accepts all agent type literals
            const agents: Array<'claude' | 'codex' | 'gemini' | 'kimi'> = ['claude', 'codex', 'gemini', 'kimi'];
            
            agents.forEach(agent => {
                expect(() => validateProfileForAgent(profile, agent)).not.toThrow();
            });
        });
    });
});
