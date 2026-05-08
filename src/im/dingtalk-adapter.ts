import crypto from 'crypto';
import axios from 'axios';
import type { IMAdapter } from './adapter';
import type { IMChatMessage, IMResponse } from './types';

export class DingTalkAdapter implements IMAdapter {
  platform = 'dingtalk' as const;
  private appSecret: string;
  private webhookUrl?: string;

  constructor(config: { appSecret: string; webhookUrl?: string }) {
    this.appSecret = config.appSecret;
    this.webhookUrl = config.webhookUrl;
  }

  verifySignature(rawBody: string, headers: Record<string, any>): boolean {
    const timestamp = headers['timestamp'] || '';
    const sign = headers['sign'] || '';
    const computed = crypto
      .createHmac('sha256', this.appSecret)
      .update(timestamp + '\n' + this.appSecret)
      .digest('base64');
    return sign === computed;
  }

  parseMessage(rawBody: any): IMChatMessage {
    const msg = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    return {
      userId: msg.senderId || msg.senderStaffId || 'unknown',
      userName: msg.senderNick || '用户',
      content: msg.text?.content || '',
      channel: 'dingtalk',
      raw: msg,
      conversationId: msg.conversationId,
    };
  }

  async sendMessage(message: IMChatMessage, response: IMResponse): Promise<void> {
    if (!this.webhookUrl) return;
    await axios.post(this.webhookUrl, {
      msgtype: 'text',
      text: { content: response.text },
      at: response.atUser ? { atUserIds: [response.atUser] } : undefined,
    });
  }
}