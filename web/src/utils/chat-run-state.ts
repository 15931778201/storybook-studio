export type ChatRunStatus = 'idle' | 'running' | 'paused';

export interface ChatRunState {
  status: ChatRunStatus;
  resumable: boolean;
}

export function createInitialChatRunState(): ChatRunState {
  return { status: 'idle', resumable: false };
}

export function markChatRunRunning(_state: ChatRunState): ChatRunState {
  return { status: 'running', resumable: false };
}

export function markChatRunStopped(_state: ChatRunState): ChatRunState {
  return { status: 'paused', resumable: true };
}

export function markChatRunPaused(_state: ChatRunState): ChatRunState {
  return { status: 'paused', resumable: true };
}

export function markChatRunResumed(_state: ChatRunState): ChatRunState {
  return { status: 'running', resumable: false };
}

export function markChatRunDismissed(_state: ChatRunState): ChatRunState {
  return createInitialChatRunState();
}
