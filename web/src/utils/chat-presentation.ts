import type { ChatMessage } from '../types/messages';

export function shouldRenderMessage(_message: ChatMessage): boolean {
  return true;
}

export function getBubbleRole(role: ChatMessage['role']): 'user' | 'assistant' {
  return role === 'user' ? 'user' : 'assistant';
}

export function getMessagePlacement(role: ChatMessage['role']): 'start' | 'end' {
  return role === 'user' ? 'end' : 'start';
}
