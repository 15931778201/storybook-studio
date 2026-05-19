import {
  AbstractChatProvider,
  XRequest,
  type TransformMessage,
  type XRequestOptions,
} from '@ant-design/x-sdk';
import type {
  ChatRequestPayload,
  ChatResponsePayload,
  StandardChatMessage,
} from '../types/standard-chat';
import {
  STANDARD_CHAT_API_URL,
  createStandardChatRequest,
  createUserChatMessage,
  mergeAssistantStreamContent,
} from '../utils/standard-chat';

export class StandardChatProvider extends AbstractChatProvider<
  StandardChatMessage,
  ChatRequestPayload,
  ChatResponsePayload
> {
  transformParams(
    requestParams: Partial<ChatRequestPayload>,
    options: XRequestOptions<ChatRequestPayload, ChatResponsePayload, StandardChatMessage>
  ): ChatRequestPayload {
    const params = options.params ?? {};
    const query = requestParams.query ?? params.query ?? '';
    const sessionId = requestParams.sessionId ?? params.sessionId;

    return createStandardChatRequest(query, sessionId);
  }

  transformLocalMessage(requestParams: Partial<ChatRequestPayload>): StandardChatMessage {
    return createUserChatMessage(requestParams.query ?? '');
  }

  transformMessage(
    info: TransformMessage<StandardChatMessage, ChatResponsePayload>
  ): StandardChatMessage {
    return mergeAssistantStreamContent(info.originMessage, info.chunk);
  }
}

export function createStandardChatProvider() {
  return new StandardChatProvider({
    request: XRequest<ChatRequestPayload, ChatResponsePayload, StandardChatMessage>(
      STANDARD_CHAT_API_URL,
      {
        manual: true,
      }
    ),
  });
}

