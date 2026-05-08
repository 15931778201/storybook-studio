
import { Memory, MemoryItem } from '../core/memory';
import fs from 'fs';
export class FileMemory extends Memory {
  private cache: MemoryItem[] = [];
  private filePath: string;
  constructor(options: { path: string }) { super(); this.filePath = options.path; this.load(); }
  private load() { try { if (fs.existsSync(this.filePath)) this.cache = JSON.parse(fs.readFileSync(this.filePath, 'utf-8')); } catch { this.cache = []; } }
  private save() { fs.writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2)); }
  async add(item: Omit<MemoryItem, 'createdAt' | 'updatedAt'>) { const now = new Date().toISOString(); this.cache.push({ ...item, createdAt: now, updatedAt: now }); this.save(); }
  async getAll() { return this.cache; }
  async search(query: string, topK = 5) { return this.cache.filter(i => i.content.includes(query)).slice(0, topK); }
  async extractFromConversation(messages: any[]) { return []; }
  async delete(key: string) { this.cache = this.cache.filter(i => i.key !== key); this.save(); }
}
