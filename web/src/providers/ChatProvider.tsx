import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage, ConfirmRequest, Workspace } from '../types/messages';

interface ChatContextValue {
  messages: ChatMessage[];
  setMessages: (v: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  sendMessage: (text: string, image?: string | null) => void;
  isRequesting: boolean;
  abort: () => void;
  activeConversationId: string;
  setActiveConversationId: (id: string) => void;
  confirmRequest: ConfirmRequest | null;
  resolveConfirm: (approved: boolean) => void;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  setActiveWorkspaceId: (id: string) => void;
  addWorkspace: (n: string, p: string) => void;
  activeRole: any | null;
  setActiveRole: (r: any | null) => void;
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
  const [activeConversationId, setActiveConversationId] = useState('conv-' + Date.now());
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('default');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([
    { id: 'default', name: '默认工作区', projectPath: '.' },
  ]);
  const [activeRole, setActiveRole] = useState<any | null>(null);

  const [messageStore, setMessageStore] = useState<Record<string, ChatMessage[]>>({});
  const currentKey = `${activeWorkspaceId}:${activeConversationId}`;
  const messages = messageStore[currentKey] || [];

  const updateMessages = (updater: (prev: ChatMessage[]) => ChatMessage[]) =>
    setMessageStore(prev => ({ ...prev, [currentKey]: updater(prev[currentKey] || []) }));

  const setMessages = (action: any) =>
    updateMessages(prev => (typeof action === 'function' ? action(prev) : action));

  const [isRequesting, setIsRequesting] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const confirmResolverRef = useRef<((b: boolean) => void) | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const thinkingIdRef = useRef<string | null>(null);

  const abort = () => {
    esRef.current?.close();
    setIsRequesting(false);
  };

  const resolveConfirm = (approved: boolean) => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(approved);
      confirmResolverRef.current = null;
    }
    fetch('/api/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: activeConversationId, approved }),
    }).catch(console.error);
    setConfirmRequest(null);
  };

  const addWorkspace = (name: string, projectPath: string) => {
    const ws: Workspace = { id: 'ws-' + Date.now(), name, projectPath };
    setWorkspaces(prev => [...prev, ws]);
    setActiveWorkspaceId(ws.id);
  };

  const sendMessage = useCallback(
    (text: string, image?: string | null) => {
      if (!text.trim() || isRequesting) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text.trim(),
        contentType: 'text',
        timestamp: Date.now(),
        imageBase64: image || undefined,
      };
      updateMessages(prev => [...prev, userMsg]);
      setIsRequesting(true);

      const thinkId = crypto.randomUUID();
      thinkingIdRef.current = thinkId;
      updateMessages(prev => [
        ...prev,
        { id: thinkId, role: 'thinking', content: '思考中…', contentType: 'text', timestamp: Date.now(), steps: [] },
      ]);

      const params = new URLSearchParams({ input: text });
      if (activeRole) params.append('role', JSON.stringify(activeRole));
      if (image) params.append('image', 'true');

      const url = `/api/stream/${activeConversationId}?${params.toString()}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          const content = safeString(data.content);

          switch (data.type) {
            case 'text':
              updateMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant' && last.contentType === 'text') {
                  return [...prev.slice(0, -1), { ...last, content: last.content + content }];
                }
                return [
                  ...prev,
                  { id: crypto.randomUUID(), role: 'assistant', content, contentType: 'text', timestamp: Date.now() },
                ];
              });
              break;

            case 'plan':
              updateMessages(prev => [
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
              updateMessages(prev => [
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
              updateMessages(prev => [
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

            case 'tool-start':
              updateMessages(prev =>
                prev.map(m => {
                  if (m.id !== thinkingIdRef.current) return m;
                  const step = { id: crypto.randomUUID(), toolName: data.toolName, args: data.args, result: '', status: 'running' };
                  return { ...m, steps: [...(m.steps || []), step] };
                })
              );
              break;

            case 'tool-end':
              updateMessages(prev =>
                prev.map(m => {
                  if (m.id !== thinkingIdRef.current) return m;
                  return {
                    ...m,
                    steps: (m.steps || []).map((s: any) =>
                      s.toolName === data.toolName && s.status === 'running'
                        ? { ...s, result: data.result, status: data.status || 'done' }
                        : s
                    ),
                  };
                })
              );
              break;

            case 'confirm':
              setConfirmRequest({
                toolCallId: data.toolCallId,
                toolName: data.toolName,
                args: data.args,
                diff: safeString(data.diff),
              });
              break;

            case 'final':
              updateMessages(prev =>
                prev
                  .filter(m => m.id !== thinkingIdRef.current && m.role !== 'assistant')
                  .concat({ id: crypto.randomUUID(), role: 'assistant', content, contentType: 'text', timestamp: Date.now() })
              );
              es.close();
              setIsRequesting(false);
              break;

            case 'error':
              updateMessages(prev =>
                prev
                  .filter(m => m.id !== thinkingIdRef.current)
                  .concat({ id: crypto.randomUUID(), role: 'system', content: `错误: ${content}`, contentType: 'text', timestamp: Date.now() })
              );
              es.close();
              setIsRequesting(false);
              break;
          }
        } catch {}
      };

      es.onerror = () => {
        es.close();
        setIsRequesting(false);
      };
    },
    [activeConversationId, activeRole, isRequesting, updateMessages]
  );

  useEffect(() => {
    setIsRequesting(false);
  }, [activeConversationId, activeWorkspaceId]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        setMessages,
        sendMessage,
        isRequesting,
        abort,
        activeConversationId,
        setActiveConversationId,
        confirmRequest,
        resolveConfirm,
        workspaces,
        activeWorkspaceId,
        setActiveWorkspaceId,
        addWorkspace,
        activeRole,
        setActiveRole,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}