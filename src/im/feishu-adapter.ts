import crypto from 'crypto';
import axios from 'axios';
import type { IMAdapter } from './adapter';
import type { IMChatMessage, IMResponse } from './types';

export class FeishuAdapter implements IMAdapter {
  platform = 'feishu' as const;
  private appSecret: string;
  private webhookUrl?: string;

  constructor(config: { appSecret: string; webhookUrl?: string }) {
    this.appSecret = config.appSecret;
    this.webhookUrl = config.webhookUrl;
  }

  verifySignature(rawBody: string, headers: Record<string, any>): boolean {
    const timestamp = headers['x-lark-request-timestamp'] || '';
    const nonce = headers['x-lark-request-nonce'] || '';
    const signature = headers['x-lark-signature'] || '';
    const body = rawBody || '';

    const computed = crypto
      .createHmac('sha256', this.appSecret)
      .update(timestamp + nonce + body)
      .digest('base64');
    return signature === computed;
  }

  parseMessage(rawBody: any): IMChatMessage {
    const msg = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    const event = msg.event || msg;
    return {
      userId: event.sender?.sender_id?.open_id || event.sender_id || 'unknown',
      userName: '飞书用户',
      content: event.message?.content || event.text || '',
      channel: 'feishu',
      raw: msg,
      conversationId: event.message?.chat_id,
    };
  }

  async sendMessage(message: IMChatMessage, response: IMResponse): Promise<void> {
    if (!this.webhookUrl) return;
    await axios.post(this.webhookUrl, {
      msg_type: 'text',
      content: { text: response.text },
    });
  }
}