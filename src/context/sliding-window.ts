
import { ContextManager, ContextManagerOptions } from '../core/context-manager';
import { tokenCount } from './token-counter';
import OpenAI from 'openai';
export class SlidingWindowContextManager extends ContextManager {
  private summaryModel: OpenAI;
  constructor(options: ContextManagerOptions) {
    super(options);
    this.summaryModel = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL, timeout: 30000 });
  }
  async compress(messages: any[]): Promise<any[]> {
    if (tokenCount(messages) <= this.options.maxTokens * this.options.compressionThreshold) return messages;
    const keep = this.options.keepRecentTurns * 2;
    const toCompress = messages.slice(0, -keep), recent = messages.slice(-keep);
    let summary: string;
    try { summary = await this.generateSummary(toCompress); } catch { return recent; }
    return [{ role: 'system', content: `[历史摘要]\n${summary}\n\n--- 最近对话 ---` }, ...recent];
  }
  async generateSummary(messages: any[]): Promise<string> {
    const res = await this.summaryModel.chat.completions.create({
      model: 'gpt-4o-mini', messages: [{ role: 'user', content: `压缩以下对话历史，保留重要决策、文件修改、未解决问题。不超过300字。\n${JSON.stringify(messages)}` }], max_tokens: 400, temperature: 0.1
    });
    return res.choices[0].message.content || '无摘要';
  }
  checkThreshold(messages: any[]): boolean { return tokenCount(messages) > this.options.maxTokens * this.options.compressionThreshold; }
  injectSystemPrompt(messages: any[], memories: any[], projectContext: string): any[] {
    const memStr = memories.map((m: any) => `- ${m.key}: ${m.content}`).join('\n');
    const system = [projectContext ? `项目: ${projectContext}` : '', memStr ? `偏好:\n${memStr}` : ''].filter(Boolean).join('\n\n');
    return system ? [{ role: 'system', content: system }, ...messages] : messages;
  }
}
