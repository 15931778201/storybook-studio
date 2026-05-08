// src/llm/openai-pool.ts
import OpenAI from 'openai';

class OpenAIPool {
  private clients: Map<string, OpenAI> = new Map();

  getClient(apiKey: string, baseURL?: string): OpenAI {
    const key = `${apiKey}:${baseURL}`;
    if (!this.clients.has(key)) {
      this.clients.set(key, new OpenAI({
        apiKey,
        baseURL,
        timeout: 60000,
        maxRetries: 2,
        // 连接复用
        httpAgent: new (require('undici').Agent)({ keepAliveTimeout: 10_000, connections: 20 }),
      }));
    }
    return this.clients.get(key)!;
  }
}

export const llmPool = new OpenAIPool();