export type StandardChatRole = 'assistant' | 'user';

export type StandardChatStatus = 'success' | 'error';

export interface ChatRequestPayload {
  query: string;
  sessionId?: string;
}

export interface ChatResponsePayload {
  content: string;
  time: string;
  status: StandardChatStatus;
  role: StandardChatRole;
}

export interface StandardChatMessage {
  content: string;
  role: StandardChatRole;
  time?: string;
  status?: StandardChatStatus;
}

