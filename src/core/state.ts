import type { Message } from '../types/message';
export class AgentState { messages: Message[] = []; addMessage(msg: Message) { this.messages.push(msg); } }
