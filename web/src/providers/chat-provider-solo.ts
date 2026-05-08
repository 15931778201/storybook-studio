
import OpenAI from 'openai'; import { loadModelConfig } from '../types/models';
export async function sendMessageSolo(messages: any[], onChunk: (chunk: string) => void) {
  const cfg = loadModelConfig();
  const client = new OpenAI({ apiKey: cfg.apiKey || 'ollama', baseURL: cfg.baseURL || 'http://localhost:11434/v1', dangerouslyAllowBrowser: true });
  const stream = await client.chat.completions.create({ model: cfg.model, messages: messages.map(m=>({role:m.role, content:m.content})), stream: true });
  for await (const chunk of stream) { const text = chunk.choices[0]?.delta?.content; if (text) onChunk(text); }
}
