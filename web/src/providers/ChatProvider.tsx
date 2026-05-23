import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage, ConfirmRequest, ThinkingStep, PlanStep, Workspace } from '../types/messages';
import { mergeSummaryIntoAssistantMessage, shouldSuppressStandaloneSystemMessage } from '../utils/chat-summary-flow';
import { buildChatPersistenceState, buildDefaultPersistenceState, hydrateChatPersistenceState } from '../utils/chat-session-state';
import { createPersistenceScheduler } from '../utils/chat-persistence-scheduler';
import {
  createInitialChatRunState,
  markChatRunDismissed,
  markChatRunResumed,
  markChatRunRunning,
  markChatRunStopped,
  type ChatRunState,
} from '../utils/chat-run-state';
import { buildImageStreamParams, type UploadedImageAttachment } from '../utils/chat-upload';
import { BUILTIN_ROLES } from '../data/builtinRoles';
import {
  buildRoleSwitchMessage,
  findRoleByCommandTarget,
  loadCustomRoles,
  parseRoleSwitchCommand,
} from '../utils/role-command';

interface ChatContextValue {
  messages: ChatMessage[];
  setMessages: (v: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  sendMessage: (text: string, image?: UploadedImageAttachment | null) => void;
  isRequesting: boolean;
  abort: () => void;
  runState: ChatRunState;
  activeConversationId: string;
  setActiveConversationId: (id: string) => void;
  confirmRequest: ConfirmRequest | null;
  resolveConfirm: (approved: boolean, selectedFiles?: Record<string, boolean>) => void;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  setActiveWorkspaceId: (id: string) => void;
  addWorkspace: (n: string, p: string, kbIds?: string[]) => void;
  activeRole: any | null;
  setActiveRole: (r: any | null) => void;
  conversationTitles: Record<string, string>;
  updateConversationTitle: (id: string, title: string) => void;
  conversationIds: string[];
  createConversation: () => string;
  deleteConversation: (id: string) => void;
  sendPlanControl: (action: 'pause' | 'resume' | 'skip' | 'retry', stepId?: number, extra?: { scope?: 'session' | 'step' | 'tool' | 'verification'; toolName?: string }) => Promise<void>;
  resumeLastRun: () => Promise<void>;
  dismissPausedRun: () => void;
}

const ChatContext = createContext<ChatContextValue>(null!);

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
}

function safeString(v: any): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') return v.text ?? v.message ?? JSON.stringify(v);
  return String(v ?? '');
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const initialPersistence = buildDefaultPersistenceState();
  const [activeConversationId, setActiveConversationId] = useState(initialPersistence.activeConversationId);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(initialPersistence.activeWorkspaceId);
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialPersistence.workspaces);
  const [activeRole, setActiveRole] = useState<any | null>(() => {
    const saved = localStorage.getItem('activeRoleId');
    return saved ? { id: saved } : { id: 'programmer', name: '全栈程序猿' };
  });

  const handleSetActiveRole = useCallback((role: any | null) => {
    setActiveRole(role);
    if (role?.id) {
      localStorage.setItem('activeRoleId', role.id);
    } else {
      localStorage.removeItem('activeRoleId');
    }
  }, []);

  const [messageStore, setMessageStore] = useState<Record<string, ChatMessage[]>>({});
  const [conversationTitles, setConversationTitles] = useState<Record<string, string>>({});
  const [conversationIds, setConversationIds] = useState<string[]>(initialPersistence.conversationIds);
  const currentKey = `${activeWorkspaceId}:${activeConversationId}`;
  const messages = messageStore[currentKey] || [];

  const updateMessages = (updater: (prev: ChatMessage[]) => ChatMessage[]) =>
    setMessageStore((prev) => ({ ...prev, [currentKey]: updater(prev[currentKey] || []) }));

  const setMessages = (action: any) =>
    updateMessages((prev) => (typeof action === 'function' ? action(prev) : action));

  const [isRequesting, setIsRequesting] = useState(false);
  const [runState, setRunState] = useState<ChatRunState>(() => createInitialChatRunState());
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const updateConversationTitle = useCallback((id: string, title: string) => {
    setConversationTitles((prev) => ({ ...prev, [id]: title }));
  }, []);
  const confirmResolverRef = useRef<((b: boolean) => void) | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const thinkingIdRef = useRef<string | null>(null);
  const persistenceSchedulerRef = useRef(createPersistenceScheduler<string>({
    delayMs: 500,
    save: (payload) => {
      localStorage.setItem('chat-persistence', payload);
    },
  }));

  const abort = () => {
    fetch(`/api/sessions/${activeConversationId}/stop`, {
      method: 'POST',
    }).catch(() => {});
    esRef.current?.close();
    setIsRequesting(false);
    setRunState((prev) => markChatRunStopped(prev));
  };

  const resolveConfirm = (approved: boolean, selectedFiles?: Record<string, boolean>) => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(approved);
      confirmResolverRef.current = null;
    }
    fetch('/api/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: activeConversationId, approved, selectedFiles }),
    }).catch(console.error);
    setConfirmRequest(null);
  };

  const addWorkspace = (name: string, projectPath: string, knowledgeBaseIds: string[] = []) => {
    const ws: Workspace = { id: 'ws-' + Date.now(), name, projectPath, knowledgeBaseIds };
    setWorkspaces((prev) => [...prev, ws]);
    setActiveWorkspaceId(ws.id);
  };

  const createConversation = useCallback(() => {
    const newId = `conv-${Date.now()}`;
    setConversationIds((prev) => [newId, ...prev.filter((id) => id !== newId)]);
    setActiveConversationId(newId);
    return newId;
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversationIds((prev) => {
      const next = prev.filter((item) => item !== id);
      if (id === activeConversationId) {
        setActiveConversationId(next[0] || createConversation());
      }
      return next;
    });
    setConversationTitles((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setMessageStore((prev) => {
      const next = { ...prev };
      delete next[`${activeWorkspaceId}:${id}`];
      return next;
    });
  }, [activeConversationId, activeWorkspaceId, createConversation]);

  const sendPlanControl = useCallback(async (
    action: 'pause' | 'resume' | 'skip' | 'retry',
    stepId?: number,
    extra?: { scope?: 'session' | 'step' | 'tool' | 'verification'; toolName?: string }
  ) => {
    await fetch('/api/agents/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: activeConversationId, action, stepId, ...extra }),
    });
  }, [activeConversationId]);

  const resumeLastRun = useCallback(async () => {
    setIsRequesting(true);
    setRunState((prev) => markChatRunResumed(prev));
    try {
      const result = await fetch(`/api/sessions/${activeConversationId}/resume`, {
        method: 'POST',
      }).then((response) => response.json());

      if (result?.ok && result.final) {
        updateMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: String(result.final),
            contentType: 'text',
            timestamp: Date.now(),
          },
        ]);
        setRunState(createInitialChatRunState());
      } else {
        setRunState((prev) => markChatRunStopped(prev));
      }
    } catch {
      setRunState((prev) => markChatRunStopped(prev));
    } finally {
      setIsRequesting(false);
    }
  }, [activeConversationId, updateMessages]);

  const dismissPausedRun = useCallback(() => {
    setRunState((prev) => markChatRunDismissed(prev));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('chat-persistence');
      const hydrated = raw ? hydrateChatPersistenceState(raw) : buildDefaultPersistenceState();
      setActiveConversationId(hydrated.activeConversationId);
      setActiveWorkspaceId(hydrated.activeWorkspaceId);
      setConversationIds(hydrated.conversationIds);
      setConversationTitles(hydrated.conversationTitles);
      setMessageStore(hydrated.messageStore);
      setWorkspaces(hydrated.workspaces);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const payload = buildChatPersistenceState({
        activeConversationId,
        activeWorkspaceId,
        conversationIds,
        conversationTitles,
        messageStore,
        workspaces,
      });
      persistenceSchedulerRef.current.schedule(JSON.stringify(payload));
    } catch {}
  }, [activeConversationId, activeWorkspaceId, conversationIds, conversationTitles, messageStore, workspaces]);

  useEffect(() => {
    return () => persistenceSchedulerRef.current.flush();
  }, []);

  const sendMessage = useCallback(
    async (text: string, image?: UploadedImageAttachment | null) => {
      if (!text.trim() || isRequesting) return;

      const trimmed = text.trim();
      const roleCommand = parseRoleSwitchCommand(trimmed);
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
        contentType: 'text',
        timestamp: Date.now(),
        imageBase64: image?.previewUrl,
      };
      updateMessages((prev) => [...prev, userMsg]);

      if (roleCommand) {
        const roles = [...BUILTIN_ROLES, ...loadCustomRoles(localStorage)];
        const matchedRole = findRoleByCommandTarget(roles, roleCommand.target);
        const assistantContent = matchedRole
          ? buildRoleSwitchMessage(matchedRole)
          : `未找到角色：${roleCommand.target}`;
        if (matchedRole) {
          handleSetActiveRole(matchedRole);
        }
        updateMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: assistantContent,
            contentType: 'text',
            timestamp: Date.now(),
            metadata: matchedRole ? { roleId: matchedRole.id, roleName: matchedRole.name } : undefined,
          },
        ]);
        return;
      }

      if (!conversationTitles[activeConversationId]) {
        const title = trimmed.length > 30 ? `${trimmed.slice(0, 30)}…` : trimmed;
        updateConversationTitle(activeConversationId, title);
      }
      setConversationIds((prev) => prev.includes(activeConversationId) ? prev : [activeConversationId, ...prev]);
      setIsRequesting(true);
      setRunState((prev) => markChatRunRunning(prev));

      const assistantId = crypto.randomUUID();
      thinkingIdRef.current = assistantId;
      updateMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', contentType: 'text', timestamp: Date.now(), steps: [] },
      ]);

      const params = new URLSearchParams({ input: text });

      const imageParams = buildImageStreamParams(image || null);
      if (imageParams.imageRef) {
        params.append('imageRef', imageParams.imageRef);
      }

      const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
      if (activeWs?.projectPath) {
        params.append('projectPath', activeWs.projectPath);
      }
      if (activeWs?.knowledgeBaseIds?.length) {
        params.append('kbIds', activeWs.knowledgeBaseIds.join(','));
      }
      if (activeRole) {
        params.append('roleId', activeRole.id);
      }

      const es = new EventSource(`/api/stream/${activeConversationId}?${params.toString()}`);
      esRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const content = safeString(data.content);

          switch (data.type) {
            case 'stream':
            case 'text':
              updateMessages((prev) => prev.map((m) =>
                m.id === thinkingIdRef.current
                  ? { ...m, content: m.content + content }
                  : m
              ));
              break;

            case 'plan':
              updateMessages((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  content: `📋 ${data.goal || '任务计划'}`,
                  contentType: 'plan',
                  metadata: { goal: data.goal, steps: data.steps },
                  timestamp: Date.now(),
                },
              ]);
              break;

            case 'decision':
              updateMessages((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  content: data.question || '决策点',
                  contentType: 'decision',
                  metadata: { question: data.question, options: data.options, chosen: data.chosen },
                  timestamp: Date.now(),
                },
              ]);
              break;

            case 'pipeline':
              updateMessages((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  content: '执行步骤',
                  contentType: 'pipeline',
                  metadata: { steps: data.steps, currentStep: data.currentStep },
                  timestamp: Date.now(),
                },
              ]);
              break;

            case 'plan-step-update':
              updateMessages((prev) => prev.map((m) => {
                if (m.contentType !== 'plan' || !m.metadata?.steps) return m;
                const updatedSteps = (m.metadata.steps as PlanStep[]).map((s) =>
                  s.stepId === data.stepId
                    ? { ...s, status: data.status, duration: data.duration ?? s.duration, resultSummary: data.resultSummary ?? s.resultSummary }
                    : s,
                );
                return {
                  ...m,
                  metadata: {
                    ...m.metadata,
                    steps: updatedSteps,
                    currentExecution: {
                      stepId: data.stepId,
                      phase: data.status === 'running' ? 'step' : data.status === 'pending' ? 'idle' : m.metadata?.currentExecution?.phase,
                      status: data.status === 'pending' ? 'paused' : data.status,
                      summary: data.resultSummary,
                    },
                  },
                };
              }));
              break;

            case 'replan':
              updateMessages((prev) => prev.map((m) => {
                if (m.contentType !== 'plan') return m;
                return {
                  ...m,
                  content: `🔄 步骤 ${data.failedStepId} 失败，正在重新规划…`,
                  metadata: {
                    ...m.metadata,
                    replanReason: data.reason,
                    remainingSteps: data.remainingSteps,
                  },
                };
              }));
              break;

            case 'tool-start':
              updateMessages((prev) =>
                prev.map((m) => {
                  if (m.contentType === 'plan' && m.metadata?.steps) {
                    return {
                      ...m,
                      metadata: {
                        ...m.metadata,
                        currentExecution: {
                          stepId: data.stepId,
                          phase: 'tool',
                          toolName: data.toolName,
                          status: 'running',
                        },
                      },
                    };
                  }
                  if (m.id !== thinkingIdRef.current) return m;
                  const step: ThinkingStep = { id: crypto.randomUUID(), toolName: data.toolName, args: data.args, result: '', status: 'running' };
                  return { ...m, steps: [...(m.steps || []), step] };
                }),
              );
              break;

            case 'tool-end':
              updateMessages((prev) =>
                prev.map((m) => {
                  if (m.contentType === 'plan' && m.metadata?.steps) {
                    return {
                      ...m,
                      metadata: {
                        ...m.metadata,
                        currentExecution: {
                          stepId: data.stepId,
                          phase: data.status === 'paused' ? 'tool' : 'verification',
                          toolName: data.toolName,
                          status: data.status === 'paused' ? 'paused' : 'running',
                          summary: data.result,
                        },
                      },
                    };
                  }
                  if (m.id !== thinkingIdRef.current) return m;
                  return {
                    ...m,
                    steps: (m.steps || []).map((s: any) =>
                      s.toolName === data.toolName && s.status === 'running'
                        ? { ...s, result: data.result, status: data.status || 'done' }
                        : s,
                    ),
                  };
                }),
              );
              break;

            case 'test-result':
              updateMessages((prev) => prev.map((m) => {
                if (m.contentType !== 'plan' || !m.metadata?.steps) return m;
                return {
                  ...m,
                  metadata: {
                    ...m.metadata,
                    currentExecution: {
                      ...(m.metadata.currentExecution || {}),
                      phase: 'verification',
                      status: /失败/.test(String(data.summary || '')) ? 'error' : 'done',
                      summary: data.summary,
                    },
                  },
                };
              }));
              if (!shouldSuppressStandaloneSystemMessage(data.type)) {
                updateMessages((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    role: 'system',
                    content: `${data.summary}\n${data.command ? `命令: ${data.command}\n` : ''}${safeString(data.output)}`,
                    contentType: 'text',
                    timestamp: Date.now(),
                  },
                ]);
              }
              break;

            case 'repair-start':
              if (!shouldSuppressStandaloneSystemMessage(data.type)) {
                updateMessages((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    role: 'system',
                    content: `自动修复开始\n${data.command ? `命令: ${data.command}\n` : ''}${data.changedFiles?.length ? `文件: ${data.changedFiles.join(', ')}\n` : ''}${safeString(data.output)}`,
                    contentType: 'text',
                    timestamp: Date.now(),
                  },
                ]);
              }
              break;

            case 'repair-end':
              if (!shouldSuppressStandaloneSystemMessage(data.type)) {
                updateMessages((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    role: 'system',
                    content: `自动修复${data.success ? '完成' : '后仍失败'}\n${safeString(data.output)}\n${safeString(data.rerunOutput)}`,
                    contentType: 'text',
                    timestamp: Date.now(),
                  },
                ]);
              }
              break;

            case 'repair-skipped':
              if (!shouldSuppressStandaloneSystemMessage(data.type)) {
                updateMessages((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    role: 'system',
                    content: `自动修复未执行\n${safeString(data.output)}`,
                    contentType: 'text',
                    timestamp: Date.now(),
                  },
                ]);
              }
              break;

            case 'summary-ready':
              updateMessages((prev) => mergeSummaryIntoAssistantMessage(prev, thinkingIdRef.current, data.summary));
              break;

            case 'confirm':
              setConfirmRequest({
                toolCallId: data.toolCallId,
                toolName: data.toolName,
                args: data.args,
                diff: safeString(data.diff),
                files: data.files,
                summary: data.summary,
              });
              break;

            case 'final':
              updateMessages((prev) => prev.map((m) =>
                m.id === thinkingIdRef.current
                  ? { ...m, content }
                  : m
              ));
              thinkingIdRef.current = null;
              es.close();
              setIsRequesting(false);
              setRunState(createInitialChatRunState());
              break;

            case 'error':
              updateMessages((prev) => prev.map((m) =>
                m.id === thinkingIdRef.current
                  ? { ...m, content: `错误: ${content}` }
                  : m
              ));
              thinkingIdRef.current = null;
              es.close();
              setIsRequesting(false);
              setRunState(createInitialChatRunState());
              break;
          }
        } catch {}
      };

      es.onerror = () => {
        if (thinkingIdRef.current) {
          updateMessages((prev) => prev.map((m) =>
            m.id === thinkingIdRef.current
              ? { ...m, content: m.content || '⚠️ 连接已断开，请检查后端服务是否正常运行，然后重试。' }
              : m
          ));
          thinkingIdRef.current = null;
        }
        es.close();
        setIsRequesting(false);
        setRunState((prev) => markChatRunStopped(prev));
      };
    },
    [activeConversationId, activeRole, isRequesting, updateMessages, conversationTitles, updateConversationTitle, workspaces, activeWorkspaceId, handleSetActiveRole],
  );

  useEffect(() => {
    setIsRequesting(false);
    setRunState(createInitialChatRunState());
  }, [activeConversationId, activeWorkspaceId]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        setMessages,
        sendMessage,
        isRequesting,
        abort,
        runState,
        activeConversationId,
        setActiveConversationId,
        confirmRequest,
        resolveConfirm,
        workspaces,
        activeWorkspaceId,
        setActiveWorkspaceId,
        addWorkspace,
        activeRole,
        setActiveRole: handleSetActiveRole,
        conversationTitles,
        updateConversationTitle,
        conversationIds,
        createConversation,
        deleteConversation,
        sendPlanControl,
        resumeLastRun,
        dismissPausedRun,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
