import { useMemo } from 'react';
import { useXChat } from '@ant-design/x-sdk';
import type {
  ChatRequestPayload,
  ChatResponsePayload,
  StandardChatMessage,
} from '../types/standard-chat';
import { createStandardChatProvider } from '../providers/standard-chat-provider';
import {
  STANDARD_CHAT_PENDING_MESSAGE,
  createErrorChatMessage,
  getFriendlyChatErrorMessage,
} from '../utils/standard-chat';

export function useStandardChat(sessionId?: string) {
  const provider = useMemo(() => createStandardChatProvider(), [sessionId]);

  const chat = useXChat<
    StandardChatMessage,
    StandardChatMessage,
    ChatRequestPayload,
    ChatResponsePayload
  >({
    provider,
    conversationKey: sessionId,
    requestPlaceholder: () => ({ ...STANDARD_CHAT_PENDING_MESSAGE }),
    requestFallback: (_, { error, errorInfo }) =>
      createErrorChatMessage(getFriendlyChatErrorMessage(error, errorInfo)),
  });

  const sendMessage = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || chat.isRequesting) return;

    chat.onRequest({ query: trimmed, sessionId });
  };

  return {
    ...chat,
    sendMessage,
  };
}
