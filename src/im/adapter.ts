import { IMChatMessage, IMResponse } from './types';
export interface IMAdapter {
  verifySignature(rawBody: string, headers: Record<string, any>): boolean;
  parseMessage(rawBody: any): IMChatMessage;
  sendMessage(message: IMChatMessage, response: IMResponse): Promise<void>;
  platform: 'wecom'|'dingtalk'|'feishu';
}