import { describe, expect, it } from 'bun:test';
import {
  getBubbleRole,
  getMessagePlacement,
  shouldRenderMessage,
} from '../web/src/utils/chat-presentation';
import type { ChatMessage } from '../web/src/types/messages';

describe('chat presentation helpers', () => {
  it('renders assistant messages on the left side', () => {
    const msg: ChatMessage = {
      id: 'a-1',
      role: 'assistant',
      content: '你好',
      steps: [{ id: 's1', toolName: 'grep', args: '{}', result: 'ok', status: 'done' }],
    };

    expect(shouldRenderMessage(msg)).toBe(true);
    expect(getBubbleRole(msg.role)).toBe('assistant');
    expect(getMessagePlacement(msg.role)).toBe('start');
  });

  it('renders system errors on the assistant side instead of drifting right', () => {
    const msg: ChatMessage = {
      id: 'error-1',
      role: 'system',
      content: '错误: 模型服务异常',
      contentType: 'text',
    };

    expect(getBubbleRole(msg.role)).toBe('assistant');
    expect(getMessagePlacement(msg.role)).toBe('start');
  });
});
