/**
 * Kimi Permission Handler
 *
 * Handles tool permission requests and responses for Kimi ACP sessions.
 * Extends BasePermissionHandler with Kimi-specific permission mode logic.
 */

import { logger } from "@/ui/logger";
import { ApiSessionClient } from "@/api/apiSession";
import type { PermissionMode } from '@/api/types';
import {
    BasePermissionHandler,
    PermissionResult,
    PendingRequest
} from '@/utils/BasePermissionHandler';

export type { PermissionResult, PendingRequest };

export class KimiPermissionHandler extends BasePermissionHandler {
    private currentPermissionMode: PermissionMode = 'default';

    constructor(session: ApiSessionClient) {
        super(session);
    }

    protected getLogPrefix(): string {
        return '[Kimi]';
    }

    updateSession(newSession: ApiSessionClient): void {
        super.updateSession(newSession);
    }

    setPermissionMode(mode: PermissionMode): void {
        this.currentPermissionMode = mode;
        logger.debug(`${this.getLogPrefix()} Permission mode set to: ${mode}`);
    }

    private shouldAutoApprove(toolName: string, toolCallId: string, input: unknown): boolean {
        const alwaysAutoApproveNames = ['change_title', 'happy__change_title', 'KimiReasoning', 'think', 'save_memory'];
        const alwaysAutoApproveIds = ['change_title', 'save_memory'];
        
        if (alwaysAutoApproveNames.some(name => toolName.toLowerCase().includes(name.toLowerCase()))) {
            return true;
        }
        
        if (alwaysAutoApproveIds.some(id => toolCallId.toLowerCase().includes(id.toLowerCase()))) {
            return true;
        }
        
        switch (this.currentPermissionMode) {
            case 'yolo':
                return true;
            case 'safe-yolo':
                return true;
            case 'read-only':
                const writeTools = ['write', 'edit', 'create', 'delete', 'patch', 'fs-edit'];
                const isWriteTool = writeTools.some(wt => toolName.toLowerCase().includes(wt));
                return !isWriteTool;
            case 'default':
            default:
                return false;
        }
    }

    async handleToolCall(
        toolCallId: string,
        toolName: string,
        input: unknown
    ): Promise<PermissionResult> {
        if (this.shouldAutoApprove(toolName, toolCallId, input)) {
            logger.debug(`${this.getLogPrefix()} Auto-approving tool ${toolName} (${toolCallId}) in ${this.currentPermissionMode} mode`);

            this.session.updateAgentState((currentState) => ({
                ...currentState,
                completedRequests: {
                    ...currentState.completedRequests,
                    [toolCallId]: {
                        tool: toolName,
                        arguments: input,
                        createdAt: Date.now(),
                        completedAt: Date.now(),
                        status: 'approved',
                        decision: this.currentPermissionMode === 'yolo' ? 'approved_for_session' : 'approved'
                    }
                }
            }));

            return {
                decision: this.currentPermissionMode === 'yolo' ? 'approved_for_session' : 'approved'
            };
        }

        return new Promise<PermissionResult>((resolve, reject) => {
            this.pendingRequests.set(toolCallId, {
                resolve,
                reject,
                toolName,
                input
            });

            this.addPendingRequestToState(toolCallId, toolName, input);

            logger.debug(`${this.getLogPrefix()} Permission request sent for tool: ${toolName} (${toolCallId}) in ${this.currentPermissionMode} mode`);
        });
    }
}
