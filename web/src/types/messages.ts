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
  imageBase64?: string;
  contentType?: 'text' | 'plan' | 'decision' | 'pipeline' | 'diff';
  metadata?: Record<string, any>;
}

export interface ConfirmRequest {
  toolCallId: string;
  toolName: string;
  args: any;
  diff: string;
}

export interface PlanStep {
  stepId: number;
  description: string;
  tool: string;
  args: Record<string, any>;
  status: 'pending' | 'running' | 'done' | 'error';
  dependsOn?: number[];
  duration?: number;
}

export interface Workspace {
  id: string;
  name: string;
  projectPath: string;
  knowledgeBaseIds: string[];
}