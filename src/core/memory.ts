export interface MemoryItem { key: string; content: string; metadata?: Record<string, unknown>; createdAt: string; updatedAt: string; }
export abstract class Memory {
  abstract add(item: Omit<MemoryItem, 'createdAt' | 'updatedAt'>): Promise<void>;
  abstract search(query: string, topK?: number): Promise<MemoryItem[]>;
  abstract getAll(): Promise<MemoryItem[]>;
  abstract extractFromConversation(messages: any[]): Promise<MemoryItem[]>;
  abstract delete(key: string): Promise<void>;
}
