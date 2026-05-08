import crypto from 'crypto';
import axios from 'axios';
import type { IMAdapter } from './adapter';
import type { IMChatMessage, IMResponse } from './types';

export class WeComAdapter implements IMAdapter {
  platform = 'wecom' as const;
  private token: string;
  private encodingAESKey: string;
  private corpId?: string;
  private webhookUrl?: string;

  constructor(config: { token: string; encodingAESKey: string; corpId?: string; webhookUrl?: string }) {
    this.token = config.token;
    this.encodingAESKey = config.encodingAESKey;
    this.corpId = config.corpId;
    this.webhookUrl = config.webhookUrl;
  }

  verifySignature(rawBody: string, headers: Record<string, any>): boolean {
    const signature = headers['x-wework-signature'] || '';
    const timestamp = headers['x-wework-timestamp'] || '';
    const nonce = headers['x-wework-nonce'] || '';
    const echostr = rawBody;

    const tmpArr = [this.token, timestamp, nonce, echostr].sort().join('');
    const sha1 = crypto.createHash('sha1').update(tmpArr).digest('hex');
    return sha1 === signature;
  }

  parseMessage(rawBody: any): IMChatMessage {
    // 企业微信群机器人回调格式
    const msg = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    return {
      userId: msg.From?.UserId || msg.UserID || 'unknown',
      userName: msg.From?.Name || msg.From?.Alias || '用户',
      content: msg.Text?.Content || msg.Msg?.Content || '',
      channel: 'wecom',
      raw: msg,
      conversationId: msg.ChatId || msg.ChatID,
    };
  }

  async sendMessage(message: IMChatMessage, response: IMResponse): Promise<void> {
    if (!this.webhookUrl) return;
    await axios.post(this.webhookUrl, {
      msgtype: 'text',
      text: {
        content: response.text,
        mentioned_list: response.atUser ? [response.atUser] : [],
      },
    });
  }
}