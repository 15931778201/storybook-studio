import { describe, expect, it } from 'bun:test';
import type { ChatMessage, Workspace } from '../web/src/types/messages';
import {
  buildWorkspaceStatus,
  buildChatPersistenceState,
  hydrateChatPersistenceState,
} from '../web/src/utils/chat-session-state';

describe('chat session state helpers', () => {
  it('builds workspace status from messages and pending confirm request', () => {
    const workspaces: Workspace[] = [
      { id: 'ws-1', name: 'Demo', projectPath: '/tmp/demo', knowledgeBaseIds: ['kb-1'] },
    ];
    const messages: ChatMessage[] = [
      {
        id: 'summary-1',
        role: 'assistant',
        content: '',
        contentType: 'summary',
        metadata: {
          summary: {
            appliedFiles: ['src/a.ts', 'src/b.ts'],
            verification: {
              commands: ['bun test'],
              passed: false,
              output: 'failed',
            },
          },
        },
      },
    ];

    const status = buildWorkspaceStatus({
      activeWorkspaceId: 'ws-1',
      workspaces,
      messages,
      confirmRequest: {
        toolCallId: 'tool-1',
        toolName: 'apply_patch',
        args: {},
        diff: 'diff --git',
        files: [
          { filePath: 'src/a.ts', changeType: 'modified', accepted: true },
          { filePath: 'src/c.ts', changeType: 'added', accepted: true },
        ],
      },
    });

    expect(status.projectPath).toBe('/tmp/demo');
    expect(status.modifiedFiles).toEqual(['src/a.ts', 'src/b.ts']);
    expect(status.pendingDiffFiles).toEqual(['src/a.ts', 'src/c.ts']);
    expect(status.lastVerification?.commands).toEqual(['bun test']);
    expect(status.lastVerification?.passed).toBe(false);
  });

  it('hydrates persisted chat state with defaults when data is partial', () => {
    const persisted = buildChatPersistenceState({
      activeConversationId: 'conv-1',
      activeWorkspaceId: 'ws-1',
      conversationTitles: { 'conv-1': 'hello' },
      conversationIds: ['conv-1'],
      messageStore: { 'ws-1:conv-1': [{ id: 'm1', role: 'user', content: 'hi' }] },
      workspaces: [{ id: 'ws-1', name: 'Demo', projectPath: '/tmp/demo', knowledgeBaseIds: [] }],
    });

    const hydrated = hydrateChatPersistenceState(JSON.stringify(persisted));

    expect(hydrated.activeConversationId).toBe('conv-1');
    expect(hydrated.activeWorkspaceId).toBe('ws-1');
    expect(hydrated.conversationIds).toEqual(['conv-1']);
    expect(hydrated.messageStore['ws-1:conv-1']).toHaveLength(1);
    expect(hydrated.workspaces[0].projectPath).toBe('/tmp/demo');
  });
});
