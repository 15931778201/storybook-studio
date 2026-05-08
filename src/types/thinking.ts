export interface ThinkingStep {
  id: string; toolName: string; args: string; result: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'denied';
}
