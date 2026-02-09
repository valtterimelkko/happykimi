/**
 * Kimi Transport Handler
 *
 * Kimi CLI-specific implementation of TransportHandler.
 * Handles:
 * - Standard init timeout (Kimi CLI is faster than Gemini)
 * - Stdout filtering (only valid JSON-RPC lines)
 * - Tool name patterns (change_title, think)
 *
 * @module KimiTransport
 */

import type { TransportHandler, ToolPattern } from '../TransportHandler';

/**
 * Kimi-specific timeout values (in milliseconds)
 */
export const KIMI_TIMEOUTS = {
  /** Kimi CLI is faster on first start */
  init: 60_000,
  /** Standard tool call timeout */
  toolCall: 120_000,
  /** Idle detection after last message chunk */
  idle: 500,
} as const;

/**
 * Known tool name patterns for Kimi CLI.
 * Used to extract real tool names from toolCallId.
 */
const KIMI_TOOL_PATTERNS: ToolPattern[] = [
  {
    name: 'change_title',
    patterns: ['change_title', 'happy__change_title'],
  },
  {
    name: 'think',
    patterns: ['think'],
  },
];

/**
 * Kimi CLI transport handler.
 *
 * Handles Kimi-specific quirks:
 * - Cleaner stdout (no debug output like Gemini)
 * - Standard ACP protocol handling
 * - Simpler tool pattern matching
 */
export class KimiTransport implements TransportHandler {
  readonly agentName = 'kimi';

  /**
   * Kimi CLI needs 1 minute for first start
   */
  getInitTimeout(): number {
    return KIMI_TIMEOUTS.init;
  }

  /**
   * Filter stdout to only valid JSON-RPC lines.
   *
   * Kimi CLI is cleaner than Gemini but we still filter to ensure
   * only valid JSON-RPC messages are processed.
   */
  filterStdoutLine(line: string): string | null {
    const trimmed = line.trim();

    // Empty lines - skip
    if (!trimmed) {
      return null;
    }

    // Must start with { or [ to be valid JSON-RPC
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return null;
    }

    // Validate it's actually parseable JSON and is an object
    try {
      const parsed = JSON.parse(trimmed);
      // Must be an object or array, not a primitive
      if (typeof parsed !== 'object' || parsed === null) {
        return null;
      }
      return line;
    } catch {
      return null;
    }
  }

  /**
   * Kimi-specific tool patterns
   */
  getToolPatterns(): ToolPattern[] {
    return KIMI_TOOL_PATTERNS;
  }

  /**
   * Get timeout for a tool call
   */
  getToolCallTimeout(): number {
    return KIMI_TIMEOUTS.toolCall;
  }

  /**
   * Get idle detection timeout
   */
  getIdleTimeout(): number {
    return KIMI_TIMEOUTS.idle;
  }

  /**
   * Extract tool name from toolCallId using Kimi patterns.
   *
   * Tool IDs often contain the tool name as a prefix (e.g., "change_title-123" -> "change_title").
   */
  extractToolNameFromId(toolCallId: string): string | null {
    const lowerId = toolCallId.toLowerCase();

    for (const toolPattern of KIMI_TOOL_PATTERNS) {
      for (const pattern of toolPattern.patterns) {
        if (lowerId.includes(pattern.toLowerCase())) {
          return toolPattern.name;
        }
      }
    }

    return null;
  }
}

/**
 * Singleton instance for convenience
 */
export const kimiTransport = new KimiTransport();
