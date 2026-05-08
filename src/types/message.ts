export interface Message {
  id?: string;
  role: 'system' | 'user' | 'assistant' | 'tool' | 'thinking';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  steps?: any[];
  timestamp?: number;
  imageBase64?: string;
}
export interface ToolCall {
  id: string;
  type: string;
  function: { name: string; arguments: string };
}
export interface ToolResult { success: boolean; output: string; metadata?: any; }
