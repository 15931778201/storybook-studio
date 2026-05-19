import type {
  ChatRequestPayload,
  ChatResponsePayload,
  StandardChatMessage,
} from '../types/standard-chat';

export const STANDARD_CHAT_API_URL = 'https://api.example.com/chat';

export const STANDARD_CHAT_PENDING_MESSAGE: StandardChatMessage = {
  content: '正在思考...',
  role: 'assistant',
  status: 'success',
};

export function createStandardChatRequest(
  query: string,
  sessionId?: string
): ChatRequestPayload {
  const request: ChatRequestPayload = { query };

  if (sessionId) {
    request.sessionId = sessionId;
  }

  return request;
}

export function createUserChatMessage(query: string): StandardChatMessage {
  return {
    content: query,
    role: 'user',
    status: 'success',
  };
}

export function createAssistantChatMessage(
  content: string,
  response?: Partial<ChatResponsePayload>
): StandardChatMessage {
  return {
    content,
    role: 'assistant',
    time: response?.time,
    status: response?.status ?? 'success',
  };
}

export function createErrorChatMessage(content: string): StandardChatMessage {
  return {
    content,
    role: 'assistant',
    status: 'error',
  };
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError';
}

export function getFriendlyChatErrorMessage(error: unknown, errorInfo?: unknown): string {
  if (isAbortError(error)) {
    return '已停止生成。';
  }

  if (errorInfo && typeof errorInfo === 'object' && 'message' in errorInfo) {
    const message = (errorInfo as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return `请求失败：${message}`;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return `网络连接异常，请稍后重试。${error.message}`;
  }

  return '服务暂时不可用，请稍后重试。';
}

export function mergeAssistantStreamContent(
  originMessage: StandardChatMessage | undefined,
  chunk: ChatResponsePayload | undefined
): StandardChatMessage {
  if (!chunk) {
    return originMessage ?? createAssistantChatMessage('');
  }

  if (chunk.status === 'error') {
    return createErrorChatMessage(chunk.content || '服务返回错误，请稍后重试。');
  }

  const previousContent =
    originMessage?.content === STANDARD_CHAT_PENDING_MESSAGE.content
      ? ''
      : originMessage?.content ?? '';

  return createAssistantChatMessage(`${previousContent}${chunk.content ?? ''}`, chunk);
}
