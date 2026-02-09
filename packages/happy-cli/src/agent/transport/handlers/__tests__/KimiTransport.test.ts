/**
 * KimiTransport Tests
 *
 * Tests for the Kimi CLI transport handler.
 */

import { describe, expect, it } from 'vitest';
import { KimiTransport, KIMI_TIMEOUTS, kimiTransport } from '../KimiTransport';

describe('KimiTransport', () => {
    describe('singleton', () => {
        it('should export a singleton instance', () => {
            expect(kimiTransport).toBeInstanceOf(KimiTransport);
            expect(kimiTransport.agentName).toBe('kimi');
        });
    });

    describe('timeouts', () => {
        it('should return correct init timeout', () => {
            expect(kimiTransport.getInitTimeout()).toBe(KIMI_TIMEOUTS.init);
            expect(kimiTransport.getInitTimeout()).toBe(60_000);
        });

        it('should return correct tool call timeout', () => {
            expect(kimiTransport.getToolCallTimeout()).toBe(KIMI_TIMEOUTS.toolCall);
            expect(kimiTransport.getToolCallTimeout()).toBe(120_000);
        });

        it('should return correct idle timeout', () => {
            expect(kimiTransport.getIdleTimeout()).toBe(KIMI_TIMEOUTS.idle);
            expect(kimiTransport.getIdleTimeout()).toBe(500);
        });
    });

    describe('filterStdoutLine', () => {
        it('should return null for empty lines', () => {
            expect(kimiTransport.filterStdoutLine('')).toBeNull();
            expect(kimiTransport.filterStdoutLine('   ')).toBeNull();
        });

        it('should return null for non-JSON lines', () => {
            expect(kimiTransport.filterStdoutLine('Debug message')).toBeNull();
            expect(kimiTransport.filterStdoutLine('Some log output')).toBeNull();
            expect(kimiTransport.filterStdoutLine('error: something happened')).toBeNull();
        });

        it('should return null for lines not starting with { or [', () => {
            expect(kimiTransport.filterStdoutLine('12345')).toBeNull();
            expect(kimiTransport.filterStdoutLine('"string"')).toBeNull();
            expect(kimiTransport.filterStdoutLine('true')).toBeNull();
        });

        it('should return null for invalid JSON', () => {
            expect(kimiTransport.filterStdoutLine('{invalid json}')).toBeNull();
            expect(kimiTransport.filterStdoutLine('{"unclosed": "string}')).toBeNull();
        });

        it('should return null for JSON primitives', () => {
            expect(kimiTransport.filterStdoutLine('12345')).toBeNull();
            expect(kimiTransport.filterStdoutLine('"just a string"')).toBeNull();
            expect(kimiTransport.filterStdoutLine('true')).toBeNull();
            expect(kimiTransport.filterStdoutLine('null')).toBeNull();
        });

        it('should return the line for valid JSON objects', () => {
            const jsonLine = '{"jsonrpc": "2.0", "method": "test"}';
            expect(kimiTransport.filterStdoutLine(jsonLine)).toBe(jsonLine);
        });

        it('should return the line for valid JSON arrays', () => {
            const jsonLine = '[{"jsonrpc": "2.0"}, {"method": "test"}]';
            expect(kimiTransport.filterStdoutLine(jsonLine)).toBe(jsonLine);
        });

        it('should handle JSON-RPC messages', () => {
            const rpcRequest = '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{}}';
            expect(kimiTransport.filterStdoutLine(rpcRequest)).toBe(rpcRequest);

            const rpcResponse = '{"jsonrpc":"2.0","id":1,"result":{}}';
            expect(kimiTransport.filterStdoutLine(rpcResponse)).toBe(rpcResponse);
        });

        it('should preserve original line including whitespace', () => {
            const indentedLine = '  {"jsonrpc": "2.0"}  ';
            expect(kimiTransport.filterStdoutLine(indentedLine)).toBe(indentedLine);
        });
    });

    describe('getToolPatterns', () => {
        it('should return tool patterns', () => {
            const patterns = kimiTransport.getToolPatterns();
            expect(patterns).toBeInstanceOf(Array);
            expect(patterns.length).toBeGreaterThan(0);
        });

        it('should include change_title pattern', () => {
            const patterns = kimiTransport.getToolPatterns();
            const changeTitlePattern = patterns.find(p => p.name === 'change_title');
            expect(changeTitlePattern).toBeDefined();
            expect(changeTitlePattern?.patterns).toContain('change_title');
            expect(changeTitlePattern?.patterns).toContain('happy__change_title');
        });

        it('should include think pattern', () => {
            const patterns = kimiTransport.getToolPatterns();
            const thinkPattern = patterns.find(p => p.name === 'think');
            expect(thinkPattern).toBeDefined();
            expect(thinkPattern?.patterns).toContain('think');
        });
    });

    describe('extractToolNameFromId', () => {
        it('should extract change_title from tool call ID', () => {
            expect(kimiTransport.extractToolNameFromId?.('change_title-123456')).toBe('change_title');
            expect(kimiTransport.extractToolNameFromId?.('happy__change_title-abc')).toBe('change_title');
        });

        it('should extract think from tool call ID', () => {
            expect(kimiTransport.extractToolNameFromId?.('think-123456')).toBe('think');
        });

        it('should return null for unknown tool IDs', () => {
            expect(kimiTransport.extractToolNameFromId?.('unknown-tool-123')).toBeNull();
            expect(kimiTransport.extractToolNameFromId?.('some-random-id')).toBeNull();
        });

        it('should be case insensitive', () => {
            expect(kimiTransport.extractToolNameFromId?.('CHANGE_TITLE-123')).toBe('change_title');
            expect(kimiTransport.extractToolNameFromId?.('Think-123')).toBe('think');
        });
    });

    describe('KIMI_TIMEOUTS constant', () => {
        it('should have correct timeout values', () => {
            expect(KIMI_TIMEOUTS.init).toBe(60_000);
            expect(KIMI_TIMEOUTS.toolCall).toBe(120_000);
            expect(KIMI_TIMEOUTS.idle).toBe(500);
        });
    });
});
