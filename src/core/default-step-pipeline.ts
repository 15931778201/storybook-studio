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
import { runCheckpointedVerification, summarizeAppliedFiles, type VerificationCheckpoint } from './auto-verification';
import { buildConfirmPreview, filterToolArgsByDecision } from './confirm-selection';
import { buildPatchArgsForWrite, shouldPromoteWriteToPatch } from './write-protocol';
import { buildFinalAnswerFromSummary } from './final-answer';
import fs from 'fs';
import { resolveWorkspacePath } from '../tools/workspace';
import { sessionControlStore } from '../storage/session-control-store';
import { appendAuditLog } from '../utils/logger';
import { BashTool } from '../tools/bash';

// 判断两个工具调用结果是否相似（用于检测重复调用）
function outputSimilar(a: string, b: string): boolean {
  const normalize = (s: string) => s.slice(0, 200).trim().replace(/\s+/g, ' ');
  return normalize(a) === normalize(b) && a.length > 10;
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
  protected eventBus = AgentEventBus.getInstance();
  protected modelConfigStore: ModelConfigStore | null;
  protected skillManager: any;
  protected knowledgeBase: any;
  protected runtimeData: Record<string, unknown> = {};
  // 性能优化相关
  protected retrievalCache: Map<string, string> = new Map();
  protected lastToolCalls: Map<string, { args: string; output: string }> = new Map();

  constructor(
    config: AgentConfig,
    sessionId: string,
    modelConfigStore?: ModelConfigStore
  ) {
    super(config, sessionId);
    this.modelConfigStore = modelConfigStore || null;
    this.skillManager = (config as any).skillManager || null;
    this.knowledgeBase = (config as any).knowledgeBase || null;
  }
  // 如果消息中包含图片，构建 Vision 格式
  protected buildVisionMessages(messages: Message[]): any[] {
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

    // Token 预算：按 contextMgr maxTokens 动态计算，保留最近 40 条消息
    const budget = this.config.contextMgr?.options?.maxTokens ?? 24000;
    if (tokenCount(messages) > budget) {
      messages = messages.slice(-40);
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
          content: assistantMsg.content.replace(/\[TOOL_CALL\][\s\S]*?\[\/TOOL_CALL\]/g, '').trim(),
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
  protected injectRole(messages: Message[], role: RoleProfile | null): Message[] {
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
  protected async prepareContext(messages: Message[], userInput: string): Promise<Message[]> {
    // 压缩历史
    const memories = await this.config.memory.getAll();
    messages = await this.config.contextMgr.compress(messages);

    const fullSystemPrompt = buildSystemPrompt(
      '你是一个高效的 AI 编程助手',  // basePrompt
      memories,
      ''  // projectContext
    );
    messages = [{ role: 'system', content: fullSystemPrompt }, ...messages];
    // 并行获取技能和知识，并缓存结果
    const [skillCtx, ragCtx] = await Promise.all([
      this.getCachedOrFetch('skill', userInput, () =>
        this.skillManager
          ? withTimeout(this.skillManager.searchRelevantSkills(userInput, 2), 1500, '')
          : Promise.resolve('')
      ),
      this.getCachedOrFetch('rag', userInput, () =>
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

    const workspaceRoot = this.resolveWorkspaceRoot();
    const contextSnippets = await this.getWorkspaceContextSnippets(userInput, workspaceRoot);
    if (contextSnippets.length > 0) {
      messages.unshift({ role: 'system', content: contextSnippets.join('\n\n') });
    }
    return messages;
  }

  protected resolveWorkspaceRoot() {
    const policyOptions = (this.config.policy as any)?.options || {};
    return policyOptions.workspaceRoot || '.';
  }

  protected async getWorkspaceContextSnippets(userInput: string, workspaceRoot: string): Promise<string[]> {
    const snippets: string[] = [];
    const tools = this.collectAllTools();
    const repoMap = tools.find((tool) => tool.name === 'repo_map');
    const fileTree = tools.find((tool) => tool.name === 'file_tree_summary');
    const gitContext = tools.find((tool) => tool.name === 'git_context');

    if (repoMap) {
      const result = await repoMap.execute({ path: '.', maxFiles: 30, maxDepth: 3 });
      if (result.success && result.output) snippets.push(`🗺️ 项目地图\n${result.output}`);
    }
    if (fileTree) {
      const result = await fileTree.execute({ path: '.', maxDepth: 3, maxEntries: 80 });
      if (result.success && result.output) snippets.push(`🌲 文件树摘要\n${result.output}`);
    }
    if (gitContext) {
      const result = await gitContext.execute({ commits: 3, diffLines: 120 });
      if (result.success && result.output) snippets.push(`🧾 最近变更\n${result.output}`);
    }
    return snippets;
  }
  

  // --- 缓存检索结果，避免同一会话重复调用 ---
  protected async getCachedOrFetch(
    cacheKey: string,
    userInput: string,
    fetcher: () => Promise<string>
  ): Promise<string> {
    // 使用用户输入的哈希值作为缓存键的一部分，确保不同问题有不同的缓存
    const inputHash = this.hashString(userInput);
    const fullCacheKey = `${cacheKey}:${inputHash}`;
    const cached = this.retrievalCache.get(fullCacheKey);
    if (cached !== undefined) return cached;
    try {
      const result = await fetcher();
      this.retrievalCache.set(fullCacheKey, result);
      return result;
    } catch {
      return '';
    }
  }

  // --- 简单的字符串哈希函数 ---
  protected hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString();
  }

  // --- 收集所有工具（内置 + MCP）---
  protected collectAllTools(): any[] {
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

  // --- 模型调用（使用 this.config 中的模型配置）---
  protected async callModel(messages: Message[], toolsDef: any[]) {
    console.log(`📡 模型: ${this.config.model}, baseURL: ${this.config.baseURL}, tools: ${toolsDef.length}个, messages: ${messages.length}条`);

    const openai = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
      timeout: 60_000,
      maxRetries: 1,
    });

    const baseParams: any = {
      model: this.config.model,
      messages: messages as any,
      temperature: Math.min(this.config.temperature ?? 0.7, 0.5),
      max_tokens: this.config.maxTokens || 4096,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      stream: true,
    };

    const nativeTools = shouldUseNativeTools({
      model: this.config.model,
      baseURL: this.config.baseURL,
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
      let inToolCall = false;
      let toolCallBuffer = '';

      let finishReason = '';
      for await (const chunk of stream as any as AsyncIterable<any>) {
        const choice = chunk.choices?.[0];
        if (!choice) continue;
        const delta = choice.delta;
        if (choice.finish_reason) {
          finishReason = choice.finish_reason;
        }

        // 过滤 [TOOL_CALL]...[/TOOL_CALL] 标记，不推送到前端
        if (delta?.content) {
          let text = delta.content;
          // 处理跨 chunk 的 [TOOL_CALL] 标记
          if (inToolCall) {
            toolCallBuffer += text;
            const endIdx = toolCallBuffer.indexOf('[/TOOL_CALL]');
            if (endIdx !== -1) {
              inToolCall = false;
              const cleanText = toolCallBuffer.slice(endIdx + '[/TOOL_CALL]'.length);
              toolCallBuffer = '';
              if (cleanText) {
                fullContent += cleanText;
                this.eventBus.emit(`message-${this.sessionId}`, { type: 'stream', content: cleanText });
              }
            }
          } else {
            const startIdx = text.indexOf('[TOOL_CALL]');
            if (startIdx !== -1) {
              const beforeTag = text.slice(0, startIdx);
              if (beforeTag) {
                fullContent += beforeTag;
                this.eventBus.emit(`message-${this.sessionId}`, { type: 'stream', content: beforeTag });
              }
              const afterStart = text.slice(startIdx);
              const endIdx = afterStart.indexOf('[/TOOL_CALL]');
              if (endIdx !== -1) {
                const afterTag = afterStart.slice(endIdx + '[/TOOL_CALL]'.length);
                if (afterTag) {
                  fullContent += afterTag;
                  this.eventBus.emit(`message-${this.sessionId}`, { type: 'stream', content: afterTag });
                }
              } else {
                inToolCall = true;
                toolCallBuffer = afterStart;
              }
            } else {
              fullContent += text;
              this.eventBus.emit(`message-${this.sessionId}`, { type: 'stream', content: text });
            }
          }
        }

        // 收集工具调用（流式拼接）
        if (delta?.tool_calls) {
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

      if (finishReason === 'length') {
        const appendix = '\n\n> ⚠️ 回复已达到最大 Token 限制，内容可能不完整。请在设置中增加"最大输出 Token"数值后重试。';
        fullContent += appendix;
        this.eventBus.emit(`message-${this.sessionId}`, {
          type: 'stream',
          content: appendix,
        });
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
        console.warn(`⚠️ 流式调用失败，降级到非流式文本工具模式: model=${this.config.model}, status=${err.status}, message=${err.message}`);
        const messagesWithTools = this.injectTextToolInstructions(baseParams.messages, toolsDef);
        const fallbackParams: any = { ...baseParams, messages: messagesWithTools };
        delete fallbackParams.stream;
        const fallbackResponse = await openai.chat.completions.create(fallbackParams);
        // 清理回复中的 [TOOL_CALL] 标记
        const stripped = (fallbackResponse.choices?.[0]?.message?.content || '').replace(/\[TOOL_CALL\][\s\S]*?\[\/TOOL_CALL\]/g, '').trim();
        if (stripped) {
          fallbackResponse.choices[0].message.content = stripped;
        }
        return fallbackResponse;
      }
      throw err;
    }
  }

  protected injectTextToolInstructions(messages: any[], toolsDef: any[]): any[] {
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
  protected parseToolCalls(rawCalls: any[]): ToolCall[] {
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
  protected async executeSingleToolCall(
    tc: ToolCall,
    messages: Message[],
    options: {
      suppressVerification?: boolean;
      repairDepth?: number;
      changeCollector?: Array<{ kind: 'initial' | 'repair'; toolName: string; changedFiles: string[]; diff?: string }>;
      changeKind?: 'initial' | 'repair';
    } = {},
  ): Promise<boolean> {
    let args: any;
    try {
      args = JSON.parse(tc.function.arguments);
    } catch {
      this.addToolMessage(messages, tc.id, '参数解析失败');
      return false;
    }

    const allTools = this.collectAllTools();
    let tool = allTools.find((t: any) => t.name === tc.function.name);

    if (tool?.name === 'write_file') {
      const promoted = this.promoteWriteToPatch(allTools, args, tool);
      if (promoted) {
        tool = promoted.tool;
        args = promoted.args;
      }
    }
    if (tool?.name === 'edit_file') {
      const promoted = this.promoteEditToPatch(allTools, args, tool);
      if (promoted) {
        tool = promoted.tool;
        args = promoted.args;
      }
    }
    if (tool?.name === 'apply_patch') {
      const checkpoint = (this as any).getRuntimeData?.('applyPatchCheckpoint');
      if (
        checkpoint
        && Array.isArray(args?.patches)
        && JSON.stringify(checkpoint.patches) === JSON.stringify(args.patches)
        && args.checkpoint == null
      ) {
        args = {
          ...args,
          checkpoint,
        };
      }
    }

    // 发送 tool-start 事件
    this.eventBus.emit(`message-${this.sessionId}`, {
      type: 'tool-start',
      toolName: tool?.name || tc.function.name,
      args: tc.function.arguments,
      stepId: this.resolveCurrentPlanStepId(),
    });

    const currentStepId = this.resolveCurrentPlanStepId();
    if (sessionControlStore.matchesPause(this.sessionId, {
      stepId: currentStepId,
      scope: 'tool',
      toolName: tool?.name || tc.function.name,
    }) || sessionControlStore.matchesPause(this.sessionId, {
      stepId: currentStepId,
      scope: 'session',
    })) {
      appendAuditLog({
        sessionId: this.sessionId,
        toolName: tool?.name || tc.function.name,
        action: 'paused',
        status: 'paused',
        reason: '工具级暂停',
        args,
        timestamp: new Date().toISOString(),
      });
      this.eventBus.emit(`message-${this.sessionId}`, {
        type: 'tool-end',
        toolName: tool?.name || tc.function.name,
        stepId: currentStepId,
        status: 'paused',
        result: '已在工具执行前暂停',
      });
      return false;
    }

    if (!tool) {
      const msg = `未找到工具 ${tc.function.name}`;
      this.addToolMessage(messages, tc.id, msg);
      this.eventBus.emit(`message-${this.sessionId}`, {
        type: 'tool-end',
        toolName: tc.function.name,
        stepId: currentStepId,
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
        stepId: currentStepId,
        status: 'error',
        result: err.message,
      });
      return false;
    }

    if (!policyResult.allowed) {
      const reason = policyResult.reason || '被策略拦截';
      appendAuditLog({
        sessionId: this.sessionId,
        toolName: tool.name,
        action: 'denied',
        status: 'denied',
        reason,
        args,
        timestamp: new Date().toISOString(),
      });
      this.addToolMessage(messages, tc.id, reason);
      this.eventBus.emit(`message-${this.sessionId}`, {
        type: 'tool-end',
        toolName: tool.name,
        stepId: currentStepId,
        status: 'denied',
        result: reason,
      });
      return false;
    }

    // 需要确认
    if (policyResult.needApproval && policyResult.diff) {
      const preview = buildConfirmPreview(tool.name, args, policyResult.diff);
      const decision = await this.waitForConfirmation({
        sessionId: this.sessionId,
        toolCallId: tc.id,
        toolName: tool.name,
        args,
        diff: policyResult.diff,
        files: preview.files,
        summary: preview.summary,
      });
      const filteredArgs = filterToolArgsByDecision(tool.name, args, decision);
      if (!decision.approved || !filteredArgs) {
        const denyMsg = '用户拒绝了修改';
        appendAuditLog({
          sessionId: this.sessionId,
          toolName: tool.name,
          action: 'denied',
          status: 'denied',
          reason: denyMsg,
          args,
          timestamp: new Date().toISOString(),
        });
        this.addToolMessage(messages, tc.id, denyMsg);
        this.eventBus.emit(`message-${this.sessionId}`, {
          type: 'tool-end',
          toolName: tool.name,
          stepId: currentStepId,
          status: 'denied',
          result: denyMsg,
        });
        return false;
      }
      args = filteredArgs;
      
      // 如果工具结果包含stagedIds，说明是staged write模式，需要提交暂存的操作
      // 注意：这里我们会在执行工具后处理stagedIds
    }

    // 执行工具
    try {
      const result = await tool.execute(args);
      appendAuditLog({
        sessionId: this.sessionId,
        toolName: tool.name,
        action: 'allowed',
        status: result.success ? 'done' : 'error',
        args,
        output: result.output,
        timestamp: new Date().toISOString(),
      });
      console.log(`✅ ${tool.name}: ${result.output.slice(0, 50)}`);
      await this.config.policy.postExecute(tool, args, result);
      
      // 检查是否是staged write模式的结果
      if (result.success && result.metadata?.stagedIds && result.metadata.pendingConfirmation) {
        // 这是staged write的暂存结果，等待用户确认后再提交
        // 用户已经通过上面的确认流程批准了操作，现在提交暂存的操作
        const stagedIds = result.metadata.stagedIds as string[];
        const commitResults = [];
        
        for (const stagedId of stagedIds) {
          try {
            const commitResult = await (this.config.policy as any).handleStagedWriteConfirmation(stagedId, true);
            commitResults.push(commitResult);
          } catch (err: any) {
            console.error(`提交暂存操作失败: ${stagedId}`, err);
            commitResults.push(false);
          }
        }
        
        // 如果有任何提交失败，标记为错误
        if (commitResults.some(r => !r)) {
          const errorMsg = `部分暂存操作提交失败`;
          this.addToolMessage(messages, tc.id, errorMsg);
          this.eventBus.emit(`message-${this.sessionId}`, {
            type: 'tool-end',
            toolName: tool.name,
            stepId: currentStepId,
            status: 'error',
            result: errorMsg,
          });
          return false;
        }
        
        // 更新结果，移除pending状态
        result.metadata.pendingConfirmation = false;
        result.metadata.committed = true;
      }
      
      const currentChange = buildAppliedChange(tool.name, result.metadata, options.changeKind ?? 'initial');
      if (currentChange && options.changeCollector) {
        options.changeCollector.push(currentChange);
      }
      if (tool.name === 'apply_patch') {
        const checkpoint = result.metadata?.checkpoint;
        if (checkpoint) {
          (this as any).setRuntimeData?.('applyPatchCheckpoint', checkpoint);
        } else {
          (this as any).clearRuntimeData?.('applyPatchCheckpoint');
        }
      }

      if (sessionControlStore.matchesPause(this.sessionId, {
        stepId: currentStepId,
        scope: 'verification',
      }) || sessionControlStore.matchesPause(this.sessionId, {
        stepId: currentStepId,
        scope: 'session',
      })) {
        appendAuditLog({
          sessionId: this.sessionId,
          toolName: tool.name,
          action: 'paused',
          status: 'paused',
          args,
          output: result.output,
          timestamp: new Date().toISOString(),
        });
        return false;
      }

      this.addToolMessage(messages, tc.id, result.output);
      this.eventBus.emit(`message-${this.sessionId}`, {
        type: 'tool-end',
        toolName: tool.name,
        stepId: currentStepId,
        status: result.success ? 'done' : 'error',
        result: result.output,
      });

      const userMsg = messages.find(m => m.role === 'user');

      if (result.success && ['write_file', 'edit_file', 'apply_patch'].includes(tool.name) && !options.suppressVerification) {
        const changedFiles = summarizeAppliedFiles(((result.metadata?.changedFiles as string[] | undefined) || []).filter(Boolean));
        let verification = await this.runVerification(changedFiles);
        const initialChanges = currentChange ? [currentChange] : [];
        this.eventBus.emit(`message-${this.sessionId}`, {
          type: 'test-result',
          summary: verification.incomplete ? '自动测试已暂停' : verification.passed ? '自动测试通过' : '自动测试失败',
          command: verification.commands.join(' && '),
          output: verification.output,
        });

        if (verification.incomplete) {
          appendAuditLog({
            sessionId: this.sessionId,
            toolName: tool.name,
            action: 'paused',
            status: 'paused',
            args,
            output: verification.output,
            timestamp: new Date().toISOString(),
          });
          return false;
        }

        let repairSummary: { attempted: boolean; success: boolean; changes: Array<{ kind: 'initial' | 'repair'; toolName: string; changedFiles: string[]; diff?: string }> } | undefined;
        if (!verification.passed) {
          const repaired = await this.attemptAutoRepair(messages, changedFiles, verification, options.repairDepth ?? 0);
          if (repaired.attempted) {
            verification = repaired.verification;
            repairSummary = {
              attempted: true,
              success: repaired.verification.passed,
              changes: repaired.changes,
            };
            this.eventBus.emit(`message-${this.sessionId}`, {
              type: 'test-result',
              summary: verification.passed ? '自动修复后二次测试通过' : '自动修复后二次测试失败',
              command: verification.commands.join(' && '),
              output: verification.output,
            });
          }
        }

        this.eventBus.emit(`message-${this.sessionId}`, {
          type: 'summary-ready',
          summary: {
            appliedFiles: changedFiles,
            changes: initialChanges,
            repair: repairSummary,
            verification,
          },
        });
        const finalSummary = {
          appliedFiles: changedFiles,
          changes: initialChanges,
          repair: repairSummary,
          verification,
        };
        const finalAnswer = buildFinalAnswerFromSummary(finalSummary, userMsg?.content || '');
        messages.push({
          role: 'assistant',
          content: finalAnswer,
        } as any);
        this.eventBus.emit(`message-${this.sessionId}`, {
          type: 'final',
          content: finalAnswer,
        });
        return true;
      }

      if (!result.success && ['write_file', 'edit_file', 'apply_patch'].includes(tool.name) && !options.suppressVerification) {
        const failureSummary = {
          appliedFiles: [],
          changes: currentChange ? [currentChange] : [],
          failure: {
            rollbackPerformed: Boolean(result.metadata?.rollbackPerformed),
            rolledBackFiles: ((result.metadata?.rolledBackFiles as string[] | undefined) || []),
            conflict: result.metadata?.conflict,
          },
          verification: {
            commands: [] as string[],
            passed: false,
            output: '未执行测试',
          },
        };
        this.eventBus.emit(`message-${this.sessionId}`, {
          type: 'summary-ready',
          summary: failureSummary,
        });
        const finalAnswer = buildFinalAnswerFromSummary(failureSummary, userMsg?.content || '');
        messages.push({
          role: 'assistant',
          content: finalAnswer,
        } as any);
        this.eventBus.emit(`message-${this.sessionId}`, {
          type: 'final',
          content: finalAnswer,
        });
        return true;
      }

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
      if (isSufficientForQuery(userMsg?.content || '', result.output)) {
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
        stepId: currentStepId,
        status: 'error',
        result: err.message,
      });
      return false;
    }
  }

  protected addToolMessage(messages: Message[], toolCallId: string, content: string) {
    messages.push({ role: 'tool', content, tool_call_id: toolCallId } as any);
  }

  protected async runVerification(changedFiles: string[]) {
    const workspaceRoot = (this.config.policy as any)?.options?.workspaceRoot;
    const commands = (await import('./auto-verification')).recommendVerificationCommands(changedFiles);
    const bash = new BashTool({ workspaceRoot });
    const pipeline = this as any;
    const checkpoint = pipeline.getRuntimeData?.('verificationCheckpoint') as VerificationCheckpoint | undefined;

    const result = await runCheckpointedVerification(
      commands,
      (command) => bash.execute({ command, timeout: 120000 }),
      {
        sessionId: this.sessionId,
        resumeFrom: checkpoint,
        onCheckpoint: (value) => {
          if (value) {
            pipeline.setRuntimeData?.('verificationCheckpoint', value);
          } else {
            pipeline.clearRuntimeData?.('verificationCheckpoint');
          }
        },
        shouldPause: () => {
          const currentStepId = this.resolveCurrentPlanStepId();
          return sessionControlStore.matchesPause(this.sessionId, {
            stepId: currentStepId,
            scope: 'verification',
          }) || sessionControlStore.matchesPause(this.sessionId, {
            stepId: currentStepId,
            scope: 'session',
          });
        },
      },
    );

    return result;
  }

  protected resolveCurrentPlanStepId(): number | undefined {
    const pipeline = this as any;
    if (typeof pipeline.currentStepIndex !== 'number' || !Array.isArray(pipeline.plan?.steps)) {
      return undefined;
    }
    return pipeline.plan.steps[pipeline.currentStepIndex]?.stepId;
  }

  public setRuntimeData(key: string, value: unknown) {
    this.runtimeData[key] = value;
  }

  public getRuntimeData<T = unknown>(key: string): T | undefined {
    return this.runtimeData[key] as T | undefined;
  }

  public clearRuntimeData(key: string) {
    delete this.runtimeData[key];
  }

  protected promoteWriteToPatch(allTools: any[], args: Record<string, any>, writeTool: any) {
    if (typeof args.filePath !== 'string' || typeof args.content !== 'string') return null;
    const resolvePath = typeof writeTool.resolvePath === 'function'
      ? writeTool.resolvePath.bind(writeTool)
      : null;
    if (!resolvePath) return null;

    const fullPath = resolvePath(args.filePath);
    if (!fs.existsSync(fullPath)) return null;

    const before = fs.readFileSync(fullPath, 'utf8');
    if (!shouldPromoteWriteToPatch(before, args.content)) return null;

    const applyPatchTool = allTools.find((candidate: any) => candidate.name === 'apply_patch');
    if (!applyPatchTool) return null;

    return {
      tool: applyPatchTool,
      args: buildPatchArgsForWrite(args.filePath, before, args.content),
    };
  }

  protected promoteEditToPatch(allTools: any[], args: Record<string, any>, editTool: any) {
    if (typeof args.filePath !== 'string' || typeof args.search !== 'string' || typeof args.replace !== 'string' || args.isRegex) return null;
    const resolvePath = typeof editTool.options?.workspaceRoot !== 'undefined'
      ? (filePath: string) => resolveWorkspacePath((editTool as any).options?.workspaceRoot, filePath)
      : null;
    const fullPath = resolvePath ? resolvePath(args.filePath) : resolveWorkspacePath(undefined, args.filePath);
    if (!fs.existsSync(fullPath)) return null;
    const before = fs.readFileSync(fullPath, 'utf8');
    if (!before.includes(args.search)) return null;

    const applyPatchTool = allTools.find((candidate: any) => candidate.name === 'apply_patch');
    if (!applyPatchTool) return null;

    return {
      tool: applyPatchTool,
      args: {
        patches: [
          {
            filePath: args.filePath,
            search: args.search,
            replace: args.replace,
          },
        ],
      },
    };
  }

  protected async attemptAutoRepair(
    messages: Message[],
    changedFiles: string[],
    verification: { commands: string[]; passed: boolean; output: string },
    repairDepth: number,
  ): Promise<{
    attempted: boolean;
    verification: { commands: string[]; passed: boolean; output: string };
    changes: Array<{ kind: 'initial' | 'repair'; toolName: string; changedFiles: string[]; diff?: string }>;
  }> {
    if (repairDepth >= 1) {
      this.eventBus.emit(`message-${this.sessionId}`, {
        type: 'repair-skipped',
        output: '已达到自动修复重试上限',
      });
      return { attempted: false, verification, changes: [] };
    }

    this.eventBus.emit(`message-${this.sessionId}`, {
      type: 'repair-start',
      command: verification.commands.join(' && '),
      changedFiles,
      output: verification.output,
    });

    const allTools = this.collectAllTools();
    const toolsDef = allTools.map((t: any) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: zodToJsonSchema(t.parameters),
      },
    }));

    const repairPrompt: Message = {
      role: 'system',
      content: [
        '你正在执行自动修复流程。',
        `失败的验证命令: ${verification.commands.join(' && ') || 'unknown'}`,
        `相关文件: ${changedFiles.join(', ') || 'unknown'}`,
        '请只通过代码工具修复失败原因，然后停止继续说明。',
        `失败输出:\n${verification.output}`,
      ].join('\n\n'),
    };

    let response;
    try {
      response = await this.callModel([repairPrompt, ...messages], toolsDef);
    } catch (err: any) {
      this.eventBus.emit(`message-${this.sessionId}`, {
        type: 'repair-skipped',
        output: `自动修复调用失败: ${err.message}`,
      });
      return { attempted: false, verification, changes: [] };
    }

    const assistantMsg = response.choices?.[0]?.message;
    let repairToolCalls: ToolCall[] = [];
    if (assistantMsg?.tool_calls?.length) {
      repairToolCalls = this.parseToolCalls(assistantMsg.tool_calls);
    } else if (assistantMsg?.content) {
      const textToolCall = parseToolCallFromText(assistantMsg.content);
      if (textToolCall) {
        repairToolCalls = [{
          id: `repair_tc_${Date.now()}`,
          type: 'function',
          function: {
            name: textToolCall.name,
            arguments: textToolCall.arguments,
          },
        }];
      }
    }

    if (repairToolCalls.length === 0) {
      this.eventBus.emit(`message-${this.sessionId}`, {
        type: 'repair-skipped',
        output: assistantMsg?.content || '模型未给出可执行的修复工具调用',
      });
      return { attempted: false, verification, changes: [] };
    }

    const repairChanges: Array<{ kind: 'initial' | 'repair'; toolName: string; changedFiles: string[]; diff?: string }> = [];
    for (const repairCall of repairToolCalls) {
      await this.executeSingleToolCall(repairCall, messages, {
        suppressVerification: true,
        repairDepth: repairDepth + 1,
        changeCollector: repairChanges,
        changeKind: 'repair',
      });
    }

    const rerunVerification = await this.runVerification(changedFiles);

    this.eventBus.emit(`message-${this.sessionId}`, {
      type: 'repair-end',
      success: rerunVerification.passed,
      output: verification.output,
      rerunOutput: rerunVerification.output,
    });

    return {
      attempted: true,
      verification: rerunVerification,
      changes: repairChanges,
    };
  }

  protected waitForConfirmation(request: ConfirmRequest): Promise<{ approved: boolean; selectedFiles?: Record<string, boolean> }> {
    const CONFIRM_TIMEOUT = 30000;
    return new Promise((resolve) => {
      const timeoutHandle = setTimeout(() => {
        this.eventBus.off('confirm-response', handler);
        console.warn(`⚠️ 确认超时，自动拒绝: ${request.toolName}`);
        resolve({ approved: false });
      }, CONFIRM_TIMEOUT);

      const handler = (data: { sessionId: string; approved: boolean; selectedFiles?: Record<string, boolean> }) => {
        if (data.sessionId === this.sessionId) {
          clearTimeout(timeoutHandle);
          this.eventBus.off('confirm-response', handler);
          resolve({ approved: data.approved, selectedFiles: data.selectedFiles });
        }
      };

      this.eventBus.on('confirm-response', handler);
      this.eventBus.emit('confirm-request', request);
    });
  }
}

function buildAppliedChange(
  toolName: string,
  metadata: Record<string, unknown> | undefined,
  kind: 'initial' | 'repair',
) {
  const changedFiles = ((metadata?.changedFiles as string[] | undefined) || []).filter(Boolean);
  if (changedFiles.length === 0) return null;
  return {
    kind,
    toolName,
    changedFiles,
    diff: typeof metadata?.diff === 'string' && metadata.diff.trim() ? metadata.diff : undefined,
  };
}
