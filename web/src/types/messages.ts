export interface ThinkingStep {
  id: string;
  toolName: string;
  args: string;
  result: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'denied';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'thinking';
  content: string;
  steps?: ThinkingStep[];
  timestamp?: number;
  imageBase64?: string;  // 新增字段
}

export interface ConfirmRequest {
  toolCallId: string;
  toolName: string;
  args: any;
  diff: string;
}

export interface Workspace {
  id: string;
  name: string;
  projectPath: string;
}