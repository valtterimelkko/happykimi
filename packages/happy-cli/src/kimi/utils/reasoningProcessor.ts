/**
 * Kimi Reasoning Processor
 *
 * Handles agent_thought_chunk events for Kimi ACP.
 * Extends BaseReasoningProcessor with Kimi-specific configuration.
 */

import {
    BaseReasoningProcessor,
    ReasoningToolCall,
    ReasoningToolResult,
    ReasoningMessage,
    ReasoningOutput
} from '@/utils/BaseReasoningProcessor';

export type { ReasoningToolCall, ReasoningToolResult, ReasoningMessage, ReasoningOutput };

export class KimiReasoningProcessor extends BaseReasoningProcessor {
    protected getToolName(): string {
        return 'KimiReasoning';
    }

    protected getLogPrefix(): string {
        return '[KimiReasoningProcessor]';
    }

    processChunk(chunk: string): void {
        this.processInput(chunk);
    }

    complete(): boolean {
        return this.completeReasoning();
    }
}
