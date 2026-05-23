import type { ChatMessage, ConfirmRequest, Workspace } from '../types/messages';

export interface ChatPersistenceState {
  activeConversationId: string;
  activeWorkspaceId: string;
  conversationIds: string[];
  conversationTitles: Record<string, string>;
  messageStore: Record<string, ChatMessage[]>;
  workspaces: Workspace[];
}

export interface WorkspaceStatusSummary {
  projectPath: string;
  modifiedFiles: string[];
  pendingDiffFiles: string[];
  fileTreeSummary: string | null;
  gitContext: string | null;
  lastVerification: {
    commands: string[];
    passed: boolean;
    output: string;
  } | null;
}

const DEFAULT_WORKSPACE: Workspace = {
  id: 'default',
  name: '默认工作区',
  projectPath: '.',
  knowledgeBaseIds: [],
};

export function buildChatPersistenceState(state: ChatPersistenceState): ChatPersistenceState {
  const conversationIds = [...new Set(state.conversationIds)].filter(Boolean);
  if (conversationIds.length === 0 && state.activeConversationId) {
    conversationIds.push(state.activeConversationId);
  }
  return {
    activeConversationId: state.activeConversationId,
    activeWorkspaceId: state.activeWorkspaceId,
    conversationIds,
    conversationTitles: state.conversationTitles || {},
    messageStore: state.messageStore || {},
    workspaces: (state.workspaces?.length ? state.workspaces : [DEFAULT_WORKSPACE]).map(normalizeWorkspace),
  };
}

export function hydrateChatPersistenceState(raw: string | null | undefined): ChatPersistenceState {
  if (!raw) {
    return buildDefaultPersistenceState();
  }

  try {
    const parsed = JSON.parse(raw);
    return buildChatPersistenceState({
      activeConversationId: parsed.activeConversationId || `conv-${Date.now()}`,
      activeWorkspaceId: parsed.activeWorkspaceId || DEFAULT_WORKSPACE.id,
      conversationIds: Array.isArray(parsed.conversationIds) ? parsed.conversationIds : [],
      conversationTitles: parsed.conversationTitles || {},
      messageStore: parsed.messageStore || {},
      workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : [DEFAULT_WORKSPACE],
    });
  } catch {
    return buildDefaultPersistenceState();
  }
}

export function buildDefaultPersistenceState(): ChatPersistenceState {
  const conversationId = `conv-${Date.now()}`;
  return {
    activeConversationId: conversationId,
    activeWorkspaceId: DEFAULT_WORKSPACE.id,
    conversationIds: [conversationId],
    conversationTitles: {},
    messageStore: {},
    workspaces: [DEFAULT_WORKSPACE],
  };
}

export function buildWorkspaceStatus(params: {
  activeWorkspaceId: string;
  workspaces: Workspace[];
  messages: ChatMessage[];
  confirmRequest: ConfirmRequest | null;
}): WorkspaceStatusSummary {
  const activeWorkspace = params.workspaces.find((workspace) => workspace.id === params.activeWorkspaceId) || DEFAULT_WORKSPACE;
  const summaryMessage = [...params.messages].reverse().find((message) => message.contentType === 'summary');
  const summary = summaryMessage?.metadata?.summary || summaryMessage?.metadata;
  const modifiedFiles = Array.isArray(summary?.appliedFiles) ? summary.appliedFiles.filter(Boolean) : [];
  const pendingDiffFiles = (params.confirmRequest?.files || []).map((file) => file.filePath);
  const latestSystemMessages = [...params.messages]
    .filter((message) => message.role === 'system')
    .slice(-20);
  const fileTreeSummary = latestSystemMessages.find((message) => String(message.content).includes('🌲 文件树摘要'))?.content || null;
  const gitContext = latestSystemMessages.find((message) => String(message.content).includes('🧾 最近变更'))?.content || null;

  return {
    projectPath: activeWorkspace.projectPath,
    modifiedFiles,
    pendingDiffFiles,
    fileTreeSummary,
    gitContext,
    lastVerification: summary?.verification
      ? {
          commands: Array.isArray(summary.verification.commands) ? summary.verification.commands : [],
          passed: Boolean(summary.verification.passed),
          output: String(summary.verification.output || ''),
        }
      : null,
  };
}

function normalizeWorkspace(workspace: Workspace): Workspace {
  return {
    id: workspace.id || `ws-${Date.now()}`,
    name: workspace.name || '未命名工作区',
    projectPath: workspace.projectPath || '.',
    knowledgeBaseIds: Array.isArray(workspace.knowledgeBaseIds) ? workspace.knowledgeBaseIds : [],
  };
}
