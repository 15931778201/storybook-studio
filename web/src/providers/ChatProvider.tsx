import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { loadModelConfig } from '../types/models';
import type { ChatMessage, ThinkingStep, ConfirmRequest, Workspace } from '../types/messages';
import type { RoleProfile } from '../types/roles';
import { PipelineStep } from '../components/StepPipelineView';

// ── Context 类型 ──
interface ChatContextValue {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  sendMessage: (text: string, image?: string) => void;
  isRequesting: boolean;
  abort: () => void;
  activeConversationId: string;
  setActiveConversationId: (id: string) => void;
  confirmRequest: ConfirmRequest | null;
  resolveConfirm: (approved: boolean) => void;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  setActiveWorkspaceId: (id: string) => void;
  addWorkspace: (name: string, projectPath: string) => void;
  activeRole: RoleProfile | null;
  setActiveRole: (role: RoleProfile | null) => void;
  // 撤销/重做
  undoStack: ChatMessage[][];
  redoStack: ChatMessage[][];
  undo: () => void;
  redo: () => void;
  // 导出
  exportToMarkdown: () => void;
  regenerateLastMessage: () => void;
  exportChat: () => void;
  pipelineSteps: PipelineStep[];
  setPipelineSteps: (steps: PipelineStep[]) => void;
}

const ChatContext = createContext<ChatContextValue>(null!);
export function useChatContext() { return useContext(ChatContext); }

function safeString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    return (value as any).text ?? (value as any).message ?? JSON.stringify(value);
  }
  return String(value ?? '');
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [activeConversationId, setActiveConversationId] = useState(`conv-${Date.now()}`);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('default');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([
    { id: 'default', name: '默认工作区', projectPath: '.' },
  ]);
  const [activeRole, setActiveRole] = useState<RoleProfile | null>(null);

  // 消息缓存
  const [messageStore, setMessageStore] = useState<Record<string, ChatMessage[]>>({});
  const currentKey = `${activeWorkspaceId}:${activeConversationId}`;
  const messages = messageStore[currentKey] || [];

  const updateMessages = useCallback((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setMessageStore(prev => ({ ...prev, [currentKey]: updater(prev[currentKey] || []) }));
  }, [currentKey]);

  const setMessages = useCallback((action: React.SetStateAction<ChatMessage[]>) => {
    updateMessages(prev => typeof action === 'function' ? (action as any)(prev) : action);
  }, [updateMessages]);

  // 撤销/重做
  const [undoStack, setUndoStack] = useState<ChatMessage[][]>([]);
  const [redoStack, setRedoStack] = useState<ChatMessage[][]>([]);

  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack(r => [...r, messages]);
      setMessages(last);
      return prev.slice(0, -1);
    });
  }, [messages, setMessages]);

  const redo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const next = prev[prev.length - 1];
      setUndoStack(u => [...u, messages]);
      setMessages(next);
      return prev.slice(0, -1);
    });
  }, [messages, setMessages]);

  // 每次消息改变前保存快照（但不包括 undo/redo 操作本身造成的变更）
  const snapshotRef = useRef(false);
  const saveSnapshot = useCallback(() => {
    if (snapshotRef.current) return;
    setUndoStack(prev => [...prev, messages]);
    setRedoStack([]);
  }, [messages]);

  // 导出 Markdown
  const exportToMarkdown = useCallback(() => {
    let md = '# Agent 对话记录\n\n';
    messages.forEach(msg => {
      if (msg.role === 'user') md += `**👤 用户**：${msg.content}\n\n`;
      else if (msg.role === 'assistant') md += `**🤖 助手**：${msg.content}\n\n`;
    });
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-chat-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages]);

  // 其他状态
  const [isRequesting, setIsRequesting] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const confirmResolverRef = useRef<((approved: boolean) => void) | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const thinkingMsgIdRef = useRef<string | null>(null);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);

  const abort = useCallback(() => {
    eventSourceRef.current?.close();
    setIsRequesting(false);
  }, []);

  const resolveConfirm = useCallback((approved: boolean) => {
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
  }, [activeConversationId]);

  const addWorkspace = useCallback((name: string, projectPath: string) => {
    const newWs: Workspace = { id: `ws-${Date.now()}`, name, projectPath };
    setWorkspaces(prev => [...prev, newWs]);
    setActiveWorkspaceId(newWs.id);
  }, []);

  const sendMessage = useCallback((text: string, image?: string) => {
    if (!text.trim() || isRequesting) return;

    // 保存快照用于撤销
    saveSnapshot();
    snapshotRef.current = true;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
      imageBase64: image || undefined,  // 新增字段
    };
    updateMessages(prev => [...prev, userMsg]);
    setIsRequesting(true);

    const thinkingId = crypto.randomUUID();
    thinkingMsgIdRef.current = thinkingId;
    const thinkMsg: ChatMessage = {
      id: thinkingId,
      role: 'thinking',
      content: '思考中…',
      steps: [],
      timestamp: Date.now(),
      imageBase64: image || undefined,  // 新增字段
    };
    updateMessages(prev => [...prev, thinkMsg]);

    // 模型配置与角色
    const modelConfig = loadModelConfig();
    const params = new URLSearchParams({ input: text });
    if (activeRole) params.append('role', JSON.stringify(activeRole));
    params.append('model', modelConfig.model);
    if (modelConfig.apiKey) params.append('apiKey', modelConfig.apiKey);
    if (modelConfig.baseURL) params.append('baseURL', modelConfig.baseURL);
    params.append('temperature', String(modelConfig.temperature));
    params.append('maxTokens', String(modelConfig.maxTokens));
    if (image) {
      params.append('image', 'true');  // 告诉后端有图片
    }
    const url = `/api/stream/${activeConversationId}?${params.toString()}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const content = safeString(data.content);

        switch (data.type) {
          case 'text':
            updateMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];              
              if (last && last.role === 'assistant') {
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + content,
                };         
              } else {
                updated.push({
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  content,
                  timestamp: Date.now(),
                });                
              }
              return updated;
            });
            break;
          case 'thought':
            setPipelineSteps(prev => [...prev, {
              id: crypto.randomUUID(),
              type: 'thought',
              content: data.content,
            }]);
            break;        
          case 'tool-start':
            setPipelineSteps(prev => [...prev, {
              id: crypto.randomUUID(),
              type: 'action',
              content: `调用工具: ${data.toolName}`,
              toolName: data.toolName,
              status: 'running',
            }]);            
            updateMessages(prev => prev.map(m => {
              if (m.id !== thinkingId) return m;
              const step: ThinkingStep = {
                id: crypto.randomUUID(),
                toolName: data.toolName,
                args: data.args,
                result: '',
                status: 'running',
              };
              return { ...m, steps: [...(m.steps || []), step] };
            }));
            break;
          case 'tool-end':
            setPipelineSteps(prev => prev.map(s =>
              s.toolName === data.toolName && s.status === 'running'
                ? { ...s, status: data.status === 'done' ? 'success' : 'error', content: `结果: ${data.result.slice(0, 80)}` }
                : s
            ));            
            updateMessages(prev => prev.map(m => {
              if (m.id !== thinkingId) return m;
              return {
                ...m,
                steps: (m.steps || []).map(s =>
                  s.toolName === data.toolName && s.status === 'running'
                    ? { ...s, result: data.result, status: data.status || 'done' }
                    : s
                ),
              };
            }));
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
            setPipelineSteps(prev => [...prev, {
              id: crypto.randomUUID(),
              type: 'final',
              content: data.content,
              status: 'success',
            }]);            
            updateMessages(prev =>
              prev.filter(m => m.id !== thinkingId && m.role !== 'assistant')
                .concat({ id: crypto.randomUUID(), role: 'assistant', content, timestamp: Date.now() })
            );
            es.close();
            setIsRequesting(false);
            snapshotRef.current = false;
            break;
          case 'error':
            updateMessages(prev =>
              prev.filter(m => m.id !== thinkingId)
                .concat({ id: crypto.randomUUID(), role: 'system', content: `错误: ${content}`, timestamp: Date.now() })
            );
            es.close();
            setIsRequesting(false);
            snapshotRef.current = false;
            break;
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      setIsRequesting(false);
      snapshotRef.current = false;
    };
  }, [activeConversationId, activeRole, isRequesting, updateMessages, saveSnapshot]);

  const regenerateLastMessage = useCallback(() => {
    // 找到最后一条用户消息，重新发送
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      // 移除最后一条 assistant 消息（以及可能夹在中间的 thinking 消息）
      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === lastUserMsg.id);
        if (idx >= 0) {
          // 保留到该用户消息为止，后面的都去掉
          return prev.slice(0, idx + 1);
        }
        return prev;
      });
      // 重新发送该用户消息
      sendMessage(lastUserMsg.content);
    }
  }, [messages, sendMessage]);

  const exportChat = useCallback(() => {
    let md = '# Agent 对话记录\n\n';
    messages.filter(m => m.role !== 'thinking').forEach(msg => {
      if (msg.role === 'user') md += `**👤 用户**：${msg.content}\n\n`;
      else if (msg.role === 'assistant') md += `**🤖 助手**：${msg.content}\n\n`;
    });
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-chat-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages]);
  
  // 切换会话/工作区时重置请求状态
  useEffect(() => {
    setIsRequesting(false);
  }, [activeConversationId, activeWorkspaceId]);

  return (
    <ChatContext.Provider value={{
      messages, setMessages, sendMessage, isRequesting, abort,
      activeConversationId, setActiveConversationId,
      confirmRequest, resolveConfirm,
      workspaces, activeWorkspaceId, setActiveWorkspaceId, addWorkspace,
      activeRole, setActiveRole,
      undoStack, redoStack, undo, redo,
      exportToMarkdown,
      regenerateLastMessage,
      exportChat,
      pipelineSteps, setPipelineSteps,
    }}>
      {children}
    </ChatContext.Provider>
  );
}


