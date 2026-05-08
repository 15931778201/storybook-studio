
import Redis from 'ioredis';
export class RedisSessionStore {
  constructor(private redis = new Redis()) {}
  async saveMessages(sessionId: string, messages: any[]) { await this.redis.setex('session:'+sessionId+':messages', 3600, JSON.stringify(messages)); }
  async getMessages(sessionId: string): Promise<any[]> { const d = await this.redis.get('session:'+sessionId+':messages'); return d ? JSON.parse(d) : []; }
  async appendMessage(sessionId: string, msg: any) { const msgs = await this.getMessages(sessionId); msgs.push(msg); await this.saveMessages(sessionId, msgs); }
}
