// src/core/default-step-pipeline.ts
import OpenAI from 'openai';
import { StepPipeline, StepResult } from './step-pipeline';
import { AgentEventBus } from './events';
import { tokenCount } from '../context/token-counter';
import { retryWithBackoff } from '../utils/retry';
import { ModelConfigStore } from '../storage/model-config-store';
import { zodToJsonSchema } from '../utils/schema';
import type { AgentConfig } from '../types/config';
import type { Message, ToolCall } from '../types/message';
import type { ConfirmRequest } from '../types/confirm';
import { RoleProfile } from '../types/role';
import { buildSystemPrompt } from '../context/system-prompt';

// 判断两个工具调用结果是否相似（用于检测重复调用）
function outputSimilar(a: string, b: string): boolean {
  const sampleA = a.slice(0, 200).trim();
  const sampleB = b.slice(0, 200).trim();
  return sampleA === sampleB && sampleA.length > 0;
}

// 判断工具结果是否已足够回答简单查询（启发式提前终止）
function isSufficientForQuery(query: string, output: string): boolean {
  const simplePatterns = ['日期', '时间', '星期', '今天', '版本', '列表', '列出', '查看'];
  const isSimple = simplePatterns.some(p => query.includes(p));
  return isSimple && output.length > 10 && output.length < 500;
}

// 从模型纯文本回复中解析工具调用意图
export function parseToolCallFromText(text: string): { name: string; arguments: string } | null {
  const match = text.match(/\[TOOL_CALL\]\s*([\s\S]*?)\s*\[\/TOOL_CALL\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim());
    if (parsed.name) {
      return { name: parsed.name, arguments: JSON.stringify(parsed.arguments || {}) };
    }
  } catch {}
  return null;
}

export function shouldUseNativeTools(config: { model?: string; baseURL?: string; nativeTools?: boolean }): boolean {
  if (config.nativeTools === false) return false;
  const model = (config.model || '').toLowerCase();
  const baseURL = (config.baseURL || '').toLowerCase();

  // OpenRouter free/community routes often proxy models that either ignore tools or fail
  // with provider-side 400/500 errors. Text tool mode avoids one doomed round trip.
  if (baseURL.includes('openrouter.ai') && (model.endsWith(':free') || model.includes('/nemotron'))) {
    return false;
  }

  return true;
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeoutHandle = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

export function getModelErrorType(err: any): string {
  const errStatus = err.status || err.code || '';
  if (errStatus === 'ECONNABORTED' || err.message?.includes('timeout') || err.message?.includes('超时')) {
    return '请求超时';
  }
  if (String(errStatus) === '429') return '请求过于频繁，被限流';
  if (String(errStatus) === '403') return '请求被拒绝，请检查API Key权限';
  if (/^5\d{2}$/.test(String(errStatus))) return '模型服务端错误';
  if (String(errStatus) === '400') return '请求参数错误（可能是工具调用参数有误）';
  return '模型服务异常';
}

export function buildModelErrorMessage(err: any): string {
  return `❌ ${getModelErrorType(err)}\n📋 错误详情: ${err.message}`;
}

export class DefaultStepPipeline extends StepPipeline {
  private eventBus = AgentEventBus.getInstance();
  private modelConfigStore: ModelConfigStore;
  private skillManager: any;
  private knowledgeBase: any;
  // 性能优化相关
  private retrievalCache: Map<string, string> = new Map();
  private lastToolCalls: Map<string, { args: string; output: string }> = new Map();

  constructor(
    config: AgentConfig,
    sessionId: string,
    modelConfigStore: ModelConfigStore
  ) {
    super(config, sessionId);
    this.modelConfigStore = modelConfigStore;
    this.skillManager = (config as any).skillManager || null;
    this.knowledgeBase = (config as any).knowledgeBase || null;
  }
  // 如果消息中包含图片，构建 Vision 格式
  private buildVisionMessages(messages: Message[]): any[] {
    return messages.map(msg => {
      if (msg.role === 'user' && msg.imageBase64) {
        return {
          role: 'user',
          content: [
            { type: 'text', text: msg.content },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${msg.imageBase64}`,
                detail: 'auto',
              },
            },
          ],
        };
      }
      return msg;
    });
  }
  async executeStep(
    messages: Message[],
    userInput: string,
    iteration: number
  ): Promise<StepResult> {
    // ========== 0. 角色注入（每次请求时重新注入，保证角色切换即时生效）==========
    const currentRole = (this.config as any).roleProfile as RoleProfile | undefined;
    messages = this.injectRole(messages, currentRole || null);

    // ========== 1. 上下文预处理（并行技能+RAG检索，带缓存） ==========
    messages = await this.prepareContext(messages, userInput);
    const isVision = messages.some(m => m.imageBase64);

    // Token 预算：超过 8000 token 时强制截断
    if (tokenCount(messages) > 8000) {
      messages = messages.slice(-20);
    }
    const apiMessages = isVision
      ? this.buildVisionMessages(messages)
      : messages;
    // ========== 2. 构建工具定义 ==========
    const allTools = this.collectAllTools();
    const toolsDef = allTools.map((t: any) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: zodToJsonSchema(t.parameters),
      },
    }));

    // ========== 3. 调用模型（带重试，优化超时与重试间隔） ==========
    let response;
    try {
      console.log(`🤖 [迭代 ${iteration}] 调用模型...`);
      response = await retryWithBackoff(
        () => this.callModel(apiMessages, toolsDef),
        { maxRetries: 3, initialDelayMs: 1000, retryableErrors: ['timeout', '500', '429', '502', '503'] }
      );
      console.log(`✅ [迭代 ${iteration}] 模型响应成功`);
    } catch (err: any) {
      console.error(`❌ [迭代 ${iteration}] API 错误:`, err.message);
      // 降级：如果已有工具结果，将工具结果作为最终输出返回
      const toolResults = messages.filter(m => m.role === 'tool' && m.content).map(m => m.content);
      if (toolResults.length > 0) {
        const fallbackOutput = toolResults.join('\n');
        const warnMsg = `⚠️ [迭代 ${iteration}] ${getModelErrorType(err)}，降级返回已有工具结果\n\n${fallbackOutput}`;
        console.log(warnMsg);
        this.eventBus.emit(`message-${this.sessionId}`, { type: 'final', content: warnMsg });
        return { done: true, finalOutput: fallbackOutput };
      }
      const errorMsg = buildModelErrorMessage(err);
      this.eventBus.emit(`message-${this.sessionId}`, { type: 'error', content: errorMsg });
      return { done: true, finalOutput: errorMsg };
    }

    const choice = response.choices[0];
    const assistantMsg = choice.message;

    // ========== 4. 纯文本回复 → 立即结束 ==========
    if (assistantMsg.content && !assistantMsg.tool_calls) {
      // 尝试从纯文本中解析工具调用意图（用于不支持 function calling 的模型）
      const textToolCall = parseToolCallFromText(assistantMsg.content);
      if (textToolCall) {
        console.log(`📝 从文本中解析到工具调用: ${textToolCall.name}`);
        const fakeToolCall: ToolCall = {
          id: `text_tc_${Date.now()}`,
          type: 'function',
          function: { name: textToolCall.name, arguments: textToolCall.arguments },
        };
        messages.push({
          role: 'assistant',
          content: assistantMsg.content.replace(/\[TOOL_CALL\][\s\S]*?\[\/TOOL_CALL\]/, '').trim(),
          tool_calls: [fakeToolCall],
        });
        const shouldStop = await this.executeSingleToolCall(fakeToolCall, messages);
        if (shouldStop) {
          return { done: true, finalOutput: (messages[messages.length - 1] as any).content };
        }
        return { done: false };
      }
      this.eventBus.emit(`message-${this.sessionId}`, {
        type: 'final',
        content: assistantMsg.content,
      });
      return { done: true, finalOutput: assistantMsg.content };
    }

    // ========== 5. 工具调用处理（支持并行执行无依赖工具） ==========
    if (assistantMsg.tool_calls) {
      const toolCalls = this.parseToolCalls(assistantMsg.tool_calls);
      messages.push({
        role: 'assistant',
        content: assistantMsg.content || '',
        tool_calls: toolCalls,
      });

      // 检测是否所有工具都可以并行执行（简单启发式：都不是写文件或部署类）
      const canParallel = toolCalls.every(
        (tc) => !['write_file', 'edit_file', 'bash'].includes(tc.function.name)
      );

      if (canParallel && toolCalls.length > 1) {
        // 并行执行多个工具调用
        await Promise.all(toolCalls.map((tc) => this.executeSingleToolCall(tc, messages)));
      } else {
        // 串行执行（保持原有行为）
        for (const tc of toolCalls) {
          const shouldStop = await this.executeSingleToolCall(tc, messages);
          if (shouldStop) {
            // 提前终止（工具结果已足够回答或重复调用）
            return { done: true, finalOutput: (messages[messages.length - 1] as any).content };
          }
        }
      }
      return { done: false };
    }

    return { done: false };
  }

  // --- 角色注入（保留原实现）---
  private injectRole(messages: Message[], role: RoleProfile | null): Message[] {
    if (!role) return messages;
    const rolePrompt = [
      `【当前角色】${role.title}（${role.name}）`,
      `【角色描述】${role.description}`,
      `【语气风格】${role.tone}`,
      role.thinkingFramework ? `【思考框架】${role.thinkingFramework}` : '',
      role.outputFormat ? `【输出格式】${role.outputFormat}` : '',
      role.constraints ? `【约束条件】\n${role.constraints.map((c: string) => `- ${c}`).join('\n')}` : '',
      role.customPrompt ? `【额外要求】${role.customPrompt}` : '',
      role.preferredTools ? `【偏好工具】${role.preferredTools.join(', ')}` : '',
      role.examples
        ? `【示例对话】\n${role.examples.map((e: any) => `用户: ${e.user}\n助手: ${e.assistant}`).join('\n\n')}`
        : '',
      '\n请严格遵守以上角色设定。如果用户需求与角色不符，可以告知用户并建议切换角色。',
    ]
      .filter(Boolean)
      .join('\n\n');

    return [{ role: 'system', content: rolePrompt }, ...messages];
  }

  // --- 上下文准备（优化：并行获取技能和知识，加入缓存）---
  private async prepareContext(messages: Message[], userInput: string): Promise<Message[]> {
    // 压缩历史
    const memories = await this.config.memory.getAll();
    messages = await this.config.contextMgr.compress(messages);
    messages = this.config.contextMgr.injectSystemPrompt(messages, memories, '');    // 记忆注入

    // ✅ 用 buildSystemPrompt 替代直接调 injectSystemPrompt
    const fullSystemPrompt = buildSystemPrompt(
      '你是一个高效的 AI 编程助手',  // basePrompt
      memories,
      ''  // projectContext
    );
    messages = [{ role: 'system', content: fullSystemPrompt }, ...messages];
    // 并行获取技能和知识，并缓存结果
    const [skillCtx, ragCtx] = await Promise.all([
      this.getCachedOrFetch('skill', () =>
        this.skillManager
          ? withTimeout(this.skillManager.searchRelevantSkills(userInput, 2), 1500, '')
          : Promise.resolve('')
      ),
      this.getCachedOrFetch('rag', () =>
        this.knowledgeBase
          ? withTimeout(this.knowledgeBase.retrieve(userInput, 2), 1500, '')
          : Promise.resolve('')
      ),
    ]);

    if (skillCtx) {
      messages.unshift({ role: 'system', content: `📚 相关技能:\n${skillCtx}` });
    }
    if (ragCtx) {
      messages.unshift({ role: 'system', content: `📖 相关知识:\n${ragCtx}` });
    }
    return messages;
  }
  

  // --- 缓存检索结果，避免同一会话重复调用 ---
  private async getCachedOrFetch(
    cacheKey: string,
    fetcher: () => Promise<string>
  ): Promise<string> {
    const cached = this.retrievalCache.get(cacheKey);
    if (cached !== undefined) return cached;
    try {
      const result = await fetcher();
      this.retrievalCache.set(cacheKey, result);
      return result;
    } catch {
      return '';
    }
  }

  // --- 收集所有工具（内置 + MCP）---
  private collectAllTools(): any[] {
    let tools = [...this.config.tools];
    const mcpClient = (this.config as any).mcpClient;
    if (mcpClient) {
      try {
        const mcpTools = (this.config as any)._mcpTools || [];
        tools = tools.concat(mcpTools);
      } catch {}
    }
    return tools;
  }

  // --- 模型调用（使用缓存的模型配置）---
  private async callModel(messages: Message[], toolsDef: any[]) {
    const currentConfig = this.modelConfigStore.get()!;
    console.log(`📡 模型: ${currentConfig.model}, baseURL: ${currentConfig.baseURL}, tools: ${toolsDef.length}个, messages: ${messages.length}条`);

    const openai = new OpenAI({
      apiKey: currentConfig.apiKey,
      baseURL: currentConfig.baseURL,
      timeout: 60_000,
      maxRetries: 1,
    });

    const baseParams: any = {
      model: currentConfig.model,
      messages: messages as any,
      temperature: Math.min(currentConfig.temperature, 0.5),
      max_tokens: currentConfig.maxTokens || 2000,
      top_p: currentConfig.topP ?? 1,
      frequency_penalty: currentConfig.frequencyPenalty ?? 0,
      presence_penalty: currentConfig.presencePenalty ?? 0,
      stream: true,
    };

    const nativeTools = shouldUseNativeTools({
      model: currentConfig.model,
      baseURL: currentConfig.baseURL,
      nativeTools: (this.config as any).nativeTools,
    });

    // 决定最终请求参数
    const requestParams: any = { ...baseParams };
    if (toolsDef.length > 0 && nativeTools) {
      requestParams.tools = toolsDef;
    } else if (toolsDef.length > 0) {
      requestParams.messages = this.injectTextToolInstructions(baseParams.messages, toolsDef);
    }

    try {
      const stream = await openai.chat.completions.create(requestParams);

      let fullContent = '';
      const toolCallsMap: Map<number, { id: string; function: { name: string; arguments: string } }> = new Map();

      // 处理流式响应
      for await (const chunk of stream as any as AsyncIterable<any>) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        // 流式推送文本内容
        if (delta.content) {
          fullContent += delta.content;
          this.eventBus.emit(`message-${this.sessionId}`, {
            type: 'stream',
            content: delta.content,
          });
        }

        // 收集工具调用（流式拼接）
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCallsMap.has(idx)) {
              toolCallsMap.set(idx, { id: '', function: { name: '', arguments: '' } });
            }
            const entry = toolCallsMap.get(idx)!;
            if (tc.id) entry.id = tc.id;
            if (tc.function?.name) entry.function.name += tc.function.name;
            if (tc.function?.arguments) entry.function.arguments += tc.function.arguments;
          }
        }
      }

      // 组装与原非流式返回格式一致的结果
      const toolCallsArray = toolCallsMap.size > 0
        ? Array.from(toolCallsMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([, tc]) => ({
              id: tc.id || `tc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              type: 'function' as const,
              function: { name: tc.function.name, arguments: tc.function.arguments },
            }))
        : undefined;

      return {
        choices: [{
          message: {
            content: fullContent || null,
            tool_calls: toolCallsArray,
          },
        }],
      };
    } catch (err: any) {
      // 如果是 500/400 且有 tools，降级到非流式文本工具模式
      if ((err.status === 500 || err.status === 400) && toolsDef.length > 0) {
        console.warn(`⚠️ 流式调用失败，降级到非流式文本工具模式: model=${currentConfig.model}, status=${err.status}, message=${err.message}`);
        const messagesWithTools = this.injectTextToolInstructions(baseParams.messages, toolsDef);
        const fallbackParams: any = { ...baseParams, messages: messagesWithTools };
        delete fallbackParams.stream;
        return await openai.chat.completions.create(fallbackParams);
      }
      throw err;
    }
  }

  private injectTextToolInstructions(messages: any[], toolsDef: any[]): any[] {
    const toolDesc = toolsDef
      .map((t: any) => `${t.function.name}: ${t.function.description}\n参数 JSON Schema: ${JSON.stringify(t.function.parameters)}`)
      .join('\n\n');
    const toolPrompt = `\n\n[可用工具]\n${toolDesc}\n\n如果需要调用工具，只输出以下格式，arguments 必须是合法 JSON 对象：\n[TOOL_CALL] {"name":"工具名","arguments":{}} [/TOOL_CALL]`;
    const messagesWithTools = [...messages];
    if (messagesWithTools.length > 0 && messagesWithTools[0].role === 'system') {
      messagesWithTools[0] = { ...messagesWithTools[0], content: messagesWithTools[0].content + toolPrompt };
    } else {
      messagesWithTools.unshift({ role: 'system', content: toolPrompt });
    }
    return messagesWithTools;
  }

  // --- 工具调用解析 ---
  private parseToolCalls(rawCalls: any[]): ToolCall[] {
    return rawCalls.map((tc: any) => {
      const fn = tc.function ?? { name: 'unknown', arguments: '{}' };
      return {
        id: tc.id,
        type: 'function',
        function: { name: fn.name, arguments: fn.arguments },
      };
    });
  }

  /**
   * 执行单个工具调用，返回 true 表示应该提前终止循环（例如检测到重复调用或信息足够）
   */
  private async executeSingleToolCall(tc: ToolCall, messages: Message[]): Promise<boolean> {
    let args: any;
    try {
      args = JSON.parse(tc.function.arguments);
    } catch {
      this.addToolMessage(messages, tc.id, '参数解析失败');
      return false;
    }

    const allTools = this.collectAllTools();
    const tool = allTools.find((t: any) => t.name === tc.function.name);

    // 发送 tool-start 事件
    this.eventBus.emit(`message-${this.sessionId}`, {
      type: 'tool-start',
      toolName: tool?.name || tc.function.name,
      args: tc.function.arguments,
    });

    if (!tool) {
      const msg = `未找到工具 ${tc.function.name}`;
      this.addToolMessage(messages, tc.id, msg);
      this.eventBus.emit(`message-${this.sessionId}`, {
        type: 'tool-end',
        toolName: tc.function.name,
        status: 'error',
        result: msg,
      });
      return false;
    }

    // 策略检查
    let policyResult;
    try {
      policyResult = await this.config.policy.preExecute(tool, args);
    } catch (err: any) {
      const msg = `策略检查失败: ${err.message}`;
      this.addToolMessage(messages, tc.id, msg);
      this.eventBus.emit(`message-${this.sessionId}`, {
        type: 'tool-end',
        toolName: tool.name,
        status: 'error',
        result: err.message,
      });
      return false;
    }

    if (!policyResult.allowed) {
      const reason = policyResult.reason || '被策略拦截';
      this.addToolMessage(messages, tc.id, reason);
      this.eventBus.emit(`message-${this.sessionId}`, {
        type: 'tool-end',
        toolName: tool.name,
        status: 'denied',
        result: reason,
      });
      return false;
    }

    // 需要确认
    if (policyResult.needApproval && policyResult.diff) {
      const approved = await this.waitForConfirmation({
        sessionId: this.sessionId,
        toolCallId: tc.id,
        toolName: tool.name,
        args,
        diff: policyResult.diff,
      });
      if (!approved) {
        const denyMsg = '用户拒绝了修改';
        this.addToolMessage(messages, tc.id, denyMsg);
        this.eventBus.emit(`message-${this.sessionId}`, {
          type: 'tool-end',
          toolName: tool.name,
          status: 'denied',
          result: denyMsg,
        });
        return false;
      }
    }

    // 执行工具
    try {
      const result = await tool.execute(args);
      console.log(`✅ ${tool.name}: ${result.output.slice(0, 50)}`);
      await this.config.policy.postExecute(tool, args, result);

      this.addToolMessage(messages, tc.id, result.output);
      this.eventBus.emit(`message-${this.sessionId}`, {
        type: 'tool-end',
        toolName: tool.name,
        status: result.success ? 'done' : 'error',
        result: result.output,
      });

      // ----- 重复调用检测 -----
      const callKey = `${tool.name}:${JSON.stringify(args)}`;
      const previous = this.lastToolCalls.get(callKey);
      if (previous && outputSimilar(previous.output, result.output)) {
        console.log('🛑 检测到重复工具调用，提前返回');
        // 替换最后一条消息为最终输出
        messages[messages.length - 1] = {
          role: 'assistant',
          content: result.output,
        } as any;
        this.eventBus.emit(`message-${this.sessionId}`, {
          type: 'final',
          content: result.output,
        });
        return true; // 通知外层提前终止
      }
      this.lastToolCalls.set(callKey, { args: JSON.stringify(args), output: result.output });

      // ----- 简单查询提前终止 -----
      if (isSufficientForQuery(messages[0]?.content || '', result.output)) {
        // 将工具输出包装成最终答案，避免继续循环
        messages.push({
          role: 'assistant',
          content: result.output,
        } as any);
        this.eventBus.emit(`message-${this.sessionId}`, {
          type: 'final',
          content: result.output,
        });
        return true;
      }

      return false;
    } catch (err: any) {
      console.error(`❌ 工具执行失败: ${err.message}`);
      const errMsg = `执行失败: ${err.message}`;
      this.addToolMessage(messages, tc.id, errMsg);
      this.eventBus.emit(`message-${this.sessionId}`, {
        type: 'tool-end',
        toolName: tool.name,
        status: 'error',
        result: err.message,
      });
      return false;
    }
  }

  private addToolMessage(messages: Message[], toolCallId: string, content: string) {
    messages.push({ role: 'tool', content, tool_call_id: toolCallId } as any);
  }

  private waitForConfirmation(request: ConfirmRequest): Promise<boolean> {
    const CONFIRM_TIMEOUT = 30000;
    return new Promise((resolve) => {
      const timeoutHandle = setTimeout(() => {
        this.eventBus.off('confirm-response', handler);
        console.warn(`⚠️ 确认超时，自动拒绝: ${request.toolName}`);
        resolve(false);
      }, CONFIRM_TIMEOUT);

      const handler = (data: { sessionId: string; approved: boolean }) => {
        if (data.sessionId === this.sessionId) {
          clearTimeout(timeoutHandle);
          this.eventBus.off('confirm-response', handler);
          resolve(data.approved);
        }
      };

      this.eventBus.on('confirm-response', handler);
      this.eventBus.emit('confirm-request', request);
    });
  }
}
