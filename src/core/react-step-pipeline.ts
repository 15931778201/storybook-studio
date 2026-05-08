import { StepPipeline, StepResult } from './step-pipeline';
import { AgentEventBus } from './events';
import { retryWithBackoff } from '../utils/retry';
import { tokenCount } from '../context/token-counter';
import { REACT_SYSTEM_PROMPT } from '../context/system-prompt';
import type { Message, ToolCall } from '../types/message';
import type { AgentConfig } from '../types/config';
import OpenAI from 'openai';

export class ReactStepPipeline extends StepPipeline {
  private openai: OpenAI;
  private eventBus = AgentEventBus.getInstance();

  constructor(config: AgentConfig, sessionId: string) {
    super(config, sessionId);
    this.openai = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
      timeout: 120000,
      maxRetries: 2,
    });
  }

  async executeStep(messages: Message[], userInput: string, iteration: number): Promise<StepResult> {
    // 1. 注入 ReAct 系统提示（仅在首轮）
    if (iteration === 1) {
      messages.unshift({ role: 'system', content: REACT_SYSTEM_PROMPT });
    }

    // 2. 上下文预处理（压缩、记忆等）
    let processed = await this.config.contextMgr.compress(messages);
    const memories = await this.config.memory.getAll();
    processed = this.config.contextMgr.injectSystemPrompt(processed, memories, '');
    console.log(`📝 [ReAct] 消息数: ${processed.length}, Tokens: ${tokenCount(processed)}`);

    // 3. 调用模型（不带工具定义，让模型输出文本，我们自行解析 Action）
    try {
      const response = await retryWithBackoff(() =>
        this.openai.chat.completions.create({
          model: this.config.model,
          messages: processed as any,
          temperature: 0.1,
        }),
        { maxRetries: 2 }
      );
      const content = response.choices[0].message.content || '';
      console.log(`🤖 [ReAct] 模型响应: ${content.slice(0, 180)}...`);

      // 4. 解析模型输出
      const parsed = this.parseReActOutput(content);
      if (parsed.finalAnswer) {
        this.eventBus.emit(`message-${this.sessionId}`, { type: 'final', content: parsed.finalAnswer });
        return { done: true, finalOutput: parsed.finalAnswer };
      }

      if (parsed.action) {
        // 将模型思考内容作为助手消息追加（可选用于展示思考链）
        messages.push({ role: 'assistant', content });
        // 执行工具
        const toolResult = await this.executeAction(parsed.action.name, parsed.action.args);
        // 将结果作为 Observation 追加到消息
        messages.push({ role: 'user', content: `Observation: ${toolResult.output}` });
        // 继续循环（不结束）
        return { done: false };
      }

      // 无有效解析，返回空让循环继续（防止死循环可加限制）
      console.warn('⚠️ [ReAct] 无法解析模型输出，将原样反馈');
      messages.push({ role: 'assistant', content });
      return { done: false };
    } catch (err: any) {
      console.error('❌ [ReAct] API 错误:', err.message);
      this.eventBus.emit(`message-${this.sessionId}`, { type: 'error', content: `API 错误: ${err.message}` });
      return { done: true, finalOutput: `❌ 发生错误: ${err.message}` };
    }
  }

  private parseReActOutput(text: string): { finalAnswer?: string; action?: { name: string; args: any } } {
    const finalMatch = text.match(/Final\s+Answer\s*:\s*(.*)/is);
    if (finalMatch) {
      return { finalAnswer: finalMatch[1].trim() };
    }

    // 匹配 Action: tool_name{...} 或 tool_name[...]
    const actionMatch = text.match(/Action\s*:\s*(\w+)\s*(\{.*?\}|\[.*?\])/s);
    if (actionMatch) {
      const name = actionMatch[1];
      let args = {};
      try {
        args = JSON.parse(actionMatch[2]);
      } catch {
        // 降级：把整个括号内容作为参数原始字符串
        args = { raw: actionMatch[2] };
      }
      return { action: { name, args } };
    }
    return {};
  }

  private async executeAction(toolName: string, args: any): Promise<{ output: string }> {
    console.log(`⚙️ [ReAct] 执行动作: ${toolName} ${JSON.stringify(args)}`);
    this.eventBus.emit(`message-${this.sessionId}`, { type: 'tool-start', toolName, args: JSON.stringify(args) });

    const tool = this.config.tools.find((t: any) => t.name === toolName);
    if (!tool) {
      const output = `错误：未找到工具 ${toolName}`;
      this.eventBus.emit(`message-${this.sessionId}`, { type: 'tool-end', toolName, status: 'error', result: output });
      return { output };
    }

    try {
      const result = await tool.execute(args);
      this.eventBus.emit(`message-${this.sessionId}`, { type: 'tool-end', toolName, status: result.success ? 'done' : 'error', result: result.output });
      return { output: result.output };
    } catch (err: any) {
      const output = `工具执行失败: ${err.message}`;
      this.eventBus.emit(`message-${this.sessionId}`, { type: 'tool-end', toolName, status: 'error', result: output });
      return { output };
    }
  }
}