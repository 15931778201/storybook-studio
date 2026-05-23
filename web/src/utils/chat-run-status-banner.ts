import type { ChatRunState } from './chat-run-state';
import type { ChatMessage } from '../types/messages';

export type RunStatusBannerActionKey = 'resume' | 'retry' | 'dismiss';

export interface RunStatusBanner {
  message: string;
  description: string;
  retryText?: string;
  actions: Array<{ key: RunStatusBannerActionKey; label: string; primary?: boolean }>;
}

export function buildRunStatusBanner(runState: ChatRunState, messages: ChatMessage[] = []): RunStatusBanner | null {
  if (!runState.resumable) return null;
  const retryText = [...messages].reverse().find((message) => message.role === 'user')?.content;

  return {
    message: '生成已暂停',
    description: '可以恢复上次运行、重发上一条消息，或放弃这次暂停状态。',
    retryText,
    actions: [
      { key: 'resume', label: '恢复', primary: true },
      { key: 'retry', label: '重发' },
      { key: 'dismiss', label: '放弃' },
    ],
  };
}
