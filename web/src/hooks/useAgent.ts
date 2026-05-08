import { useState, useRef, useCallback } from 'react';

export interface ChatMessage {
  role: 'user' | 'agent' | 'system';
  content: string;
}

interface ConfirmRequest {
  sessionId: string;
  toolCallId: string;
  toolName: string;
  args: any;
  diff: string;
}

export function useAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback((userInput: string, sessionId: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: userInput }]);

    if (abortRef.current) abortRef.current.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    const url = `/api/stream/${sessionId}?input=${encodeURIComponent(userInput)}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'final':   // 只处理最终答案
            setMessages((prev) => [...prev, { role: 'agent', content: data.content }]);
            break;
          case 'confirm': // 展示确认框
            setConfirmRequest({
              sessionId: data.sessionId,
              toolCallId: data.toolCallId,
              toolName: data.toolName,
              args: data.args,
              diff: data.diff,
            });
            break;
          case 'error':
            setMessages((prev) => [...prev, { role: 'system', content: `错误: ${data.content}` }]);
            break;
        }
      } catch {}
    };

    eventSource.onerror = () => eventSource.close();
  }, []);

  const confirmAction = useCallback(async (approved: boolean) => {
    if (!confirmRequest) return;
    await fetch('/api/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: confirmRequest.sessionId,
        toolCallId: confirmRequest.toolCallId,
        approved,
      }),
    });
    setMessages((prev) => [
      ...prev,
      { role: 'system', content: approved ? '✅ 已执行修改' : '❌ 已拒绝修改' },
    ]);
    setConfirmRequest(null);
  }, [confirmRequest]);

  return { messages, confirmRequest, sendMessage, confirmAction, setMessages };
}