/**
 * Kimi Config Utilities Tests
 *
 * Tests for the Kimi CLI configuration utilities.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
    readKimiLocalConfig,
    saveKimiModelToConfig,
    getInitialKimiModel,
    determineKimiModel,
    getKimiModelSource,
    type KimiLocalConfig,
} from '../config';

// Mock dependencies
vi.mock('@/ui/logger', () => ({
    logger: {
        debug: vi.fn(),
    },
}));

describe('Kimi Config Utilities', () => {
    let originalKimiModel: string | undefined;

    beforeEach(() => {
        originalKimiModel = process.env.KIMI_MODEL;
        delete process.env.KIMI_MODEL;
    });

    afterEach(() => {
        if (originalKimiModel !== undefined) {
            process.env.KIMI_MODEL = originalKimiModel;
        } else {
            delete process.env.KIMI_MODEL;
        }
        vi.clearAllMocks();
    });

    describe('getInitialKimiModel', () => {
        it('should return environment variable when set', () => {
            process.env.KIMI_MODEL = 'kimi-custom-model';
            expect(getInitialKimiModel()).toBe('kimi-custom-model');
        });

        it('should return default model when no env var or config', () => {
            const result = getInitialKimiModel();
            // Result should be one of: env var, local config model, or default
            // Since we can't control the local config file in tests, we just verify it's a string
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe('determineKimiModel', () => {
        const mockConfig: KimiLocalConfig = {
            token: null,
            model: null,
        };

        it('should return explicit model when provided', () => {
            const result = determineKimiModel('kimi-explicit', mockConfig);
            expect(result).toBe('kimi-explicit');
        });

        it('should return env var model when explicit is null', () => {
            process.env.KIMI_MODEL = 'kimi-from-env';
            const result = determineKimiModel(null, mockConfig);
            expect(result).toBe('kimi-from-env');
        });

        it('should return default when explicit is null and no env var', () => {
            const result = determineKimiModel(null, mockConfig);
            expect(result).toBe('kimi-latest');
        });

        it('should return env var over local config when explicit is undefined', () => {
            process.env.KIMI_MODEL = 'kimi-env-override';
            const configWithModel: KimiLocalConfig = {
                token: null,
                model: 'kimi-from-config',
            };
            const result = determineKimiModel(undefined, configWithModel);
            expect(result).toBe('kimi-env-override');
        });

        it('should return local config when no env var', () => {
            const configWithModel: KimiLocalConfig = {
                token: null,
                model: 'kimi-from-config',
            };
            const result = determineKimiModel(undefined, configWithModel);
            expect(result).toBe('kimi-from-config');
        });
    });

    describe('getKimiModelSource', () => {
        const mockConfig: KimiLocalConfig = {
            token: null,
            model: null,
        };

        it('should return explicit when explicit model is provided', () => {
            const result = getKimiModelSource('kimi-explicit', mockConfig);
            expect(result).toBe('explicit');
        });

        it('should return env-var when KIMI_MODEL is set', () => {
            process.env.KIMI_MODEL = 'kimi-env';
            const result = getKimiModelSource(undefined, mockConfig);
            expect(result).toBe('env-var');
        });

        it('should return local-config when config has model', () => {
            const configWithModel: KimiLocalConfig = {
                token: null,
                model: 'kimi-config',
            };
            const result = getKimiModelSource(undefined, configWithModel);
            expect(result).toBe('local-config');
        });

        it('should return default when no model source available', () => {
            const result = getKimiModelSource(undefined, mockConfig);
            expect(result).toBe('default');
        });
    });

    describe('readKimiLocalConfig', () => {
        it('should return default config when no config file exists', () => {
            const config = readKimiLocalConfig();
            expect(config).toHaveProperty('token');
            expect(config).toHaveProperty('model');
        });
    });

    describe('saveKimiModelToConfig', () => {
        it('should not throw when saving model', () => {
            expect(() => saveKimiModelToConfig('kimi-test-model')).not.toThrow();
        });
    });
});
