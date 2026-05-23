// src/core/adaptive-pipeline.ts
import { DefaultStepPipeline, parseToolCallFromText, shouldUseNativeTools } from './default-step-pipeline';
import { AgentPlan, PlanStep } from './step-pipeline';
import type { StepResult } from './step-pipeline';
import type { Message, ToolCall } from '../types/message';
import type { AgentConfig } from '../types/config';
import { ModelConfigStore } from '../storage/model-config-store';
import { sessionControlStore } from '../storage/session-control-store';
import { zodToJsonSchema } from '../utils/schema';
import { clearRuntimeSnapshot, saveRuntimeSnapshot } from '../storage/session-runtime-store';
import { buildWorkModeGuidance, routeLocalIntent, type LocalIntent } from './local-intent-router';

const PLANNING_PROMPT = `Analyze the user's request carefully.

If the request is simple (can be answered directly or needs just one quick tool call),
just answer directly in natural language.

If the request requires multiple steps or multiple tool calls, first create a structured plan.
Wrap your plan in [PLAN]...[/PLAN] tags:

[PLAN]
{
  "goal": "Overall goal description",
  "steps": [
    {
      "stepId": 1,
      "description": "What this step does",
      "tool": "tool_name",
      "args": {"key": "value"}
    }
  ]
}
[/PLAN]

Available tools and their purposes:
`;

export class AdaptivePipeline extends DefaultStepPipeline {
  private plan: AgentPlan | null = null;
  private currentStepIndex = 0;
  private mode: 'planning' | 'executing' | 'react' | 'done' = 'planning';
  private stepTimings: Map<number, number> = new Map();
  private lastInput = '';
  private runtimeStatus: 'idle' | 'running' | 'paused' | 'done' | 'aborted' = 'idle';

  constructor(
    config: AgentConfig,
    sessionId: string,
    modelConfigStore?: ModelConfigStore
  ) {
    super(config, sessionId, modelConfigStore);
  }

  async executeStep(
    messages: Message[],
    userInput: string,
    iteration: number
  ): Promise<StepResult> {
    const currentRole = (this.config as any).roleProfile;
    messages = this.injectRole(messages, currentRole || null);
    messages = await this.prepareContext(messages, userInput);
    this.lastInput = userInput;
    const isVision = messages.some(m => m.imageBase64);

    const budget = this.config.contextMgr?.options?.maxTokens ?? 24000;
    if (tokenCount(messages) > budget) {
      messages = messages.slice(-40);
    }
    const apiMessages = isVision ? this.buildVisionMessages(messages) : messages;
    const allTools = this.collectAllTools();
    const toolsDef = allTools.map((t: any) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: zodToJsonSchema(t.parameters),
      },
    }));

    if (iteration === 1) {
      const localIntent = routeLocalIntent(userInput);
      if (localIntent.kind === 'workspace_overview') {
        return this.handleWorkspaceOverviewRequest(messages);
      }
      if (localIntent.kind === 'role_switch') {
        return this.handleRoleSwitchFallback(messages, localIntent);
      }
      if (isToolBackedWorkMode(localIntent)) {
        return this.handleLocalWorkMode(localIntent, apiMessages, messages, toolsDef);
      }
      return this.handleFirstIteration(apiMessages, messages, userInput, toolsDef, allTools);
    }

    if (this.mode === 'executing' && this.plan) {
      return this.handlePlanExecution(messages, userInput, toolsDef, allTools);
    }

    if (this.mode === 'react') {
      return this.handleReactIteration(apiMessages, messages, toolsDef);
    }

    return { done: false };
  }

  private async handleFirstIteration(
    apiMessages: Message[],
    messages: Message[],
    userInput: string,
    toolsDef: any[],
    allTools: any[]
  ): Promise<StepResult> {
    console.log(`📋 [迭代 1] 自适应判断：尝试生成计划或直接回答`);

    // 用规划 prompt 调用模型（不传 tools 参数，避免 native tool calling）
    const toolDescriptions = allTools
      .map((t: any) => `- ${t.name}: ${t.description}`)
      .join('\n');
    const planMsg: Message = {
      role: 'system',
      content: PLANNING_PROMPT + toolDescriptions,
    };
    const planMessages = [planMsg, ...apiMessages];

    let response;
    try {
      response = await this.callModel(planMessages, []);
    } catch (err: any) {
      console.error(`❌ 规划阶段 API 错误:`, err.message);
      const errorMsg = `❌ 模型服务异常\n📋 错误详情: ${err.message}`;
      this.eventBus.emit(`message-${this.sessionId}`, { type: 'error', content: errorMsg });
      return { done: true, finalOutput: errorMsg };
    }

    const choice = response.choices[0];
    const assistantMsg = choice.message;
    const fullContent = assistantMsg.content || '';

    // 1) 尝试解析 JSON 计划
    const planJson = this.parsePlanFromText(fullContent);
    if (planJson) {
      console.log(`📋 生成计划: ${planJson.goal} (${planJson.steps.length} 步)`);
      this.plan = planJson;
      this.currentStepIndex = 0;
      this.mode = 'executing';
      this.persistRuntime(messages, 'planning');

      this.eventBus.emit(`message-${this.sessionId}`, {
        type: 'plan',
        goal: planJson.goal,
        steps: planJson.steps.map((s: PlanStep) => ({
          stepId: s.stepId,
          description: s.description,
          tool: s.tool,
          status: 'pending',
        })),
      });
      return { done: false };
    }

    // 2) 解析文本工具调用 [TOOL_CALL]（ReAct 向后兼容）
    const textToolCall = parseToolCallFromText(fullContent);
    if (textToolCall) {
      console.log(`📝 文本工具调用模式: ${textToolCall.name}`);
      this.mode = 'react';
      this.persistRuntime(messages, 'react');
      const fakeToolCall: ToolCall = {
        id: `text_tc_${Date.now()}`,
        type: 'function',
        function: { name: textToolCall.name, arguments: textToolCall.arguments },
      };
      messages.push({
        role: 'assistant',
        content: fullContent.replace(/\[TOOL_CALL\][\s\S]*?\[\/TOOL_CALL\]/g, '').trim(),
        tool_calls: [fakeToolCall],
      });
      const shouldStop = await this.executeSingleToolCall(fakeToolCall, messages);
      if (shouldStop) {
        return { done: true, finalOutput: (messages[messages.length - 1] as any).content };
      }
      return { done: false };
    }

    // 3) 原生 tool_calls（ReAct）
    if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
      console.log(`🛠 原生工具调用模式: ${assistantMsg.tool_calls.length} 个`);
      this.mode = 'react';
      this.persistRuntime(messages, 'react');
      const toolCalls = this.parseToolCalls(assistantMsg.tool_calls);
      messages.push({
        role: 'assistant',
        content: fullContent,
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        const shouldStop = await this.executeSingleToolCall(tc, messages);
        if (shouldStop) {
          return { done: true, finalOutput: (messages[messages.length - 1] as any).content };
        }
      }
      return { done: false };
    }

    // 4) 纯文本回答
    console.log(`💬 直接回答模式`);
    this.eventBus.emit(`message-${this.sessionId}`, {
      type: 'final',
      content: fullContent,
    });
    this.persistRuntime(messages, 'done', fullContent);
    return { done: true, finalOutput: fullContent };
  }

  private async handlePlanExecution(
    messages: Message[],
    userInput: string,
    toolsDef: any[],
    allTools: any[]
  ): Promise<StepResult> {
    if (!this.plan || this.currentStepIndex >= this.plan.steps.length) {
      this.mode = 'done';
      const summary = `✅ 计划全部完成: ${this.plan?.goal || ''}`;
      this.eventBus.emit(`message-${this.sessionId}`, { type: 'final', content: summary });
      return { done: true, finalOutput: summary };
    }

    const step = this.plan.steps[this.currentStepIndex];
    console.log(`📋 [步骤 ${step.stepId}/${this.plan.steps.length}] ${step.description}`);

    const control = sessionControlStore.consumeIfMatches(this.sessionId, step.stepId);
    if (control?.action === 'pause') {
      this.persistRuntime(messages, 'paused');
      this.eventBus.emit(`message-${this.sessionId}`, {
        type: 'plan-step-update',
        stepId: step.stepId,
        status: 'pending',
        resultSummary: '已暂停，等待继续',
      });
      return { done: false };
    }
    if (sessionControlStore.matchesPause(this.sessionId, { stepId: step.stepId, scope: 'step' })
      || sessionControlStore.matchesPause(this.sessionId, { stepId: step.stepId, scope: 'session' })) {
      this.persistRuntime(messages, 'paused');
      this.eventBus.emit(`message-${this.sessionId}`, {
        type: 'plan-step-update',
        stepId: step.stepId,
        status: 'pending',
        resultSummary: '已暂停，等待继续',
      });
      return { done: false };
    }
    if (control?.action === 'skip') {
      this.eventBus.emit(`message-${this.sessionId}`, {
        type: 'plan-step-update',
        stepId: step.stepId,
        status: 'done',
        resultSummary: '已按用户指令跳过',
      });
      this.currentStepIndex++;
      return { done: false };
    }
    if (control?.action === 'retry') {
      this.eventBus.emit(`message-${this.sessionId}`, {
        type: 'plan-step-update',
        stepId: step.stepId,
        status: 'pending',
        resultSummary: '已按用户指令重试',
      });
    }

    // 更新步骤状态为 running
    this.persistRuntime(messages, 'executing');
    this.eventBus.emit(`message-${this.sessionId}`, {
      type: 'plan-step-update',
      stepId: step.stepId,
      status: 'running',
    });

    this.stepTimings.set(step.stepId, Date.now());

    // 构造执行 prompt：告诉模型执行哪一步
    const execPrompt: Message = {
      role: 'system',
      content: `You are executing step ${step.stepId} of the plan.\n\nDescription: ${step.description}\nTool: ${step.tool}\nArgs: ${JSON.stringify(step.args)}\n\nCall the specified tool with the provided arguments. After seeing the result, if the step is complete, respond with "[STEP_DONE]" followed by a brief summary of what happened.`,
    };
    const execMessages = [...messages, execPrompt];

    try {
      const response = await this.callModel(execMessages, toolsDef);
      const choice = response.choices[0];
      const assistantMsg = choice.message;

      let stepSuccess = true;

      // 原生工具调用
      if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
        const toolCalls = this.parseToolCalls(assistantMsg.tool_calls);
        messages.push({
          role: 'assistant',
          content: assistantMsg.content || '',
          tool_calls: toolCalls,
        });

        for (const tc of toolCalls) {
          const shouldStop = await this.executeSingleToolCall(tc, messages);
          if (shouldStop) break;
        }
      } else {
        // 文本工具调用 [TOOL_CALL]
        const textContent = assistantMsg.content || '';
        const textToolCall = parseToolCallFromText(textContent);
        if (textToolCall) {
          const fakeToolCall: ToolCall = {
            id: `exec_tc_${Date.now()}`,
            type: 'function',
            function: { name: textToolCall.name, arguments: textToolCall.arguments },
          };
          messages.push({
            role: 'assistant',
            content: textContent.replace(/\[TOOL_CALL\][\s\S]*?\[\/TOOL_CALL\]/g, '').trim(),
            tool_calls: [fakeToolCall],
          });
          const shouldStop = await this.executeSingleToolCall(fakeToolCall, messages);
          if (shouldStop) stepSuccess = false;
        } else if (!textContent.includes('[STEP_DONE]')) {
          // 模型没有调工具也没有标记完成 → 重试
          console.warn(`⚠️ 步骤 ${step.stepId} 未执行工具也未标记完成，尝试再次执行`);
        }
      }

      const duration = Date.now() - (this.stepTimings.get(step.stepId) || Date.now());

      if (sessionControlStore.matchesPause(this.sessionId, { stepId: step.stepId, scope: 'step' })
        || sessionControlStore.matchesPause(this.sessionId, { stepId: step.stepId, scope: 'session' })
        || sessionControlStore.matchesPause(this.sessionId, { stepId: step.stepId, scope: 'verification' })) {
        this.persistRuntime(messages, 'paused');
        this.eventBus.emit(`message-${this.sessionId}`, {
          type: 'plan-step-update',
          stepId: step.stepId,
          status: 'pending',
          resultSummary: '已暂停，等待继续',
        });
        return { done: false };
      }

      if (stepSuccess) {
      this.eventBus.emit(`message-${this.sessionId}`, {
        type: 'plan-step-update',
        stepId: step.stepId,
        status: 'done',
        duration,
      });
      this.currentStepIndex++;
      this.persistRuntime(messages, 'executing');
      return { done: false };
    }

      // 步骤失败 → 重规划
      return this.handleReplan(messages, step, userInput, toolsDef);
    } catch (err: any) {
      console.error(`❌ 步骤 ${step.stepId} 执行出错:`, err.message);
      return this.handleReplan(messages, step, userInput, toolsDef);
    }
  }

  private async handleReplan(
    messages: Message[],
    failedStep: PlanStep,
    userInput: string,
    toolsDef: any[]
  ): Promise<StepResult> {
    console.log(`🔄 步骤 ${failedStep.stepId} 失败，重新规划剩余步骤`);

    this.eventBus.emit(`message-${this.sessionId}`, {
      type: 'plan-step-update',
      stepId: failedStep.stepId,
      status: 'error',
    });

    this.eventBus.emit(`message-${this.sessionId}`, {
      type: 'replan',
      failedStepId: failedStep.stepId,
      reason: `步骤 "${failedStep.description}" 执行失败`,
      remainingSteps: (this.plan?.steps || []).slice(this.currentStepIndex).map(s => s.description),
    });

    // 让模型重新规划剩余步骤
    const remainingSteps = (this.plan?.steps || []).slice(this.currentStepIndex);
    const replanPrompt: Message = {
      role: 'system',
      content: `Step "${failedStep.description}" failed. Please replan the remaining work:\n${remainingSteps.map((s: PlanStep) => `- ${s.description} (${s.tool})`).join('\n')}\n\nOutput a new plan in [PLAN]...[/PLAN] format, or answer directly if the goal is already achieved.`,
    };

    try {
      const response = await this.callModel([replanPrompt, ...messages], []);
      const fullContent = response.choices[0]?.message?.content || '';
      const newPlan = this.parsePlanFromText(fullContent);

      if (newPlan) {
        this.plan = newPlan;
        this.currentStepIndex = 0;
        console.log(`📋 重新规划: ${newPlan.goal} (${newPlan.steps.length} 步)`);

        this.eventBus.emit(`message-${this.sessionId}`, {
          type: 'plan',
          goal: newPlan.goal,
          steps: newPlan.steps.map((s: PlanStep) => ({
            stepId: s.stepId,
            description: s.description,
            tool: s.tool,
            status: 'pending',
          })),
        });
        return { done: false };
      }

      // 重规划失败，直接返回错误
      const errorMsg = `❌ 步骤 "${failedStep.description}" 执行失败且无法重新规划。${fullContent}`;
      this.eventBus.emit(`message-${this.sessionId}`, { type: 'error', content: errorMsg });
      this.mode = 'done';
      this.persistRuntime(messages, 'done', errorMsg);
      return { done: true, finalOutput: errorMsg };
    } catch (err: any) {
      const errorMsg = `❌ 重规划失败: ${err.message}`;
      this.eventBus.emit(`message-${this.sessionId}`, { type: 'error', content: errorMsg });
      this.mode = 'done';
      this.persistRuntime(messages, 'done', errorMsg);
      return { done: true, finalOutput: errorMsg };
    }
  }

  private async handleReactIteration(
    apiMessages: Message[],
    messages: Message[],
    toolsDef: any[]
  ): Promise<StepResult> {
    console.log(`🔄 [ReAct] 继续迭代`);
    let response;
    try {
      response = await this.callModel(apiMessages, toolsDef);
    } catch (err: any) {
      const toolResults = messages.filter(m => m.role === 'tool' && m.content).map(m => m.content);
      if (toolResults.length > 0) {
        const fallbackOutput = toolResults.join('\n');
        this.eventBus.emit(`message-${this.sessionId}`, { type: 'final', content: fallbackOutput });
        this.persistRuntime(messages, 'done', fallbackOutput);
        return { done: true, finalOutput: fallbackOutput };
      }
      const errorMsg = `❌ 模型服务异常\n📋 错误详情: ${err.message}`;
      this.eventBus.emit(`message-${this.sessionId}`, { type: 'error', content: errorMsg });
      this.persistRuntime(messages, 'done', errorMsg);
      return { done: true, finalOutput: errorMsg };
    }

    const assistantMsg = response.choices[0].message;

    if (assistantMsg.content && !assistantMsg.tool_calls) {
      const textToolCall = parseToolCallFromText(assistantMsg.content);
      if (textToolCall) {
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
      this.persistRuntime(messages, 'done', assistantMsg.content);
      return { done: true, finalOutput: assistantMsg.content };
    }

    if (assistantMsg.tool_calls) {
      const toolCalls = this.parseToolCalls(assistantMsg.tool_calls);
      messages.push({
        role: 'assistant',
        content: assistantMsg.content || '',
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        const shouldStop = await this.executeSingleToolCall(tc, messages);
        if (shouldStop) {
          return { done: true, finalOutput: (messages[messages.length - 1] as any).content };
        }
      }
      return { done: false };
    }

    return { done: false };
  }

  private parsePlanFromText(text: string): AgentPlan | null {
    const match = text.match(/\[PLAN\]\s*([\s\S]*?)\s*\[\/PLAN\]/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.goal && Array.isArray(parsed.steps)) {
        return {
          goal: parsed.goal,
          steps: parsed.steps.map((s: any) => ({
            stepId: s.stepId || s.step_id || 0,
            description: s.description || '',
            tool: s.tool || s.toolName || '',
            args: s.args || {},
            dependsOn: s.dependsOn || s.depends_on || [],
          })),
        };
      }
    } catch {}
    return null;
  }

  public hydrateRuntimeState(snapshot: any) {
    if (!snapshot) return;
    this.plan = snapshot.plan || null;
    this.currentStepIndex = snapshot.currentStepIndex || 0;
    this.mode = snapshot.mode || 'planning';
    this.lastInput = snapshot.lastInput || '';
    this.runtimeStatus = snapshot.status || 'running';
    this.runtimeData = snapshot.runtimeData || {};
  }

  public snapshotRuntime(messages?: Message[], finalOutput?: string) {
    return {
      sessionId: this.sessionId,
      status: this.runtimeStatus === 'idle'
        ? (this.mode === 'done' ? 'done' : 'running')
        : this.runtimeStatus,
      mode: this.mode,
      phase: this.mode,
      currentStepIndex: this.currentStepIndex,
      lastInput: this.lastInput,
      finalOutput,
      plan: this.plan,
      messages,
      runtimeData: this.runtimeData,
      updatedAt: new Date().toISOString(),
    };
  }

  private persistRuntime(messages?: Message[], phase?: string, finalOutput?: string) {
    this.runtimeStatus = phase === 'paused' ? 'paused' : phase === 'done' ? 'done' : 'running';
    saveRuntimeSnapshot({
      ...this.snapshotRuntime(messages, finalOutput),
      phase,
      status: this.runtimeStatus,
    });
    if (phase === 'done') {
      clearRuntimeSnapshot(this.sessionId);
    }
  }

  private async handleWorkspaceOverviewRequest(messages: Message[]): Promise<StepResult> {
    console.log(`🧭 工作区概览模式：按本地项目元信息生成回答`);
    const sections = await this.collectWorkspaceOverviewSections();
    const finalOutput = buildWorkspaceOverviewAnswer(sections);
    this.eventBus.emit(`message-${this.sessionId}`, {
      type: 'final',
      content: finalOutput,
    });
    this.mode = 'done';
    this.persistRuntime(messages, 'done', finalOutput);
    return { done: true, finalOutput };
  }

  private async handleRoleSwitchFallback(messages: Message[], intent: LocalIntent): Promise<StepResult> {
    const target = intent.target || '目标角色';
    const finalOutput = `已识别到角色切换请求：${target}。请使用前端本地角色状态完成切换；新版前端会直接切换并显示当前角色。`;
    this.eventBus.emit(`message-${this.sessionId}`, {
      type: 'final',
      content: finalOutput,
    });
    this.mode = 'done';
    this.persistRuntime(messages, 'done', finalOutput);
    return { done: true, finalOutput };
  }

  private async handleLocalWorkMode(
    intent: LocalIntent,
    apiMessages: Message[],
    messages: Message[],
    toolsDef: any[],
  ): Promise<StepResult> {
    const guidance = buildWorkModeGuidance(intent);
    if (guidance) {
      this.eventBus.emit(`message-${this.sessionId}`, {
        type: 'stream',
        content: `${guidance}\n\n`,
      });
      const workModeMessage: Message = {
        role: 'system',
        content: `[WORK_MODE]\n${guidance}\n[/WORK_MODE]`,
      };
      messages.unshift(workModeMessage);
      apiMessages.unshift(workModeMessage);
    }
    this.mode = 'react';
    this.persistRuntime(messages, 'react');
    return this.handleReactIteration(apiMessages, messages, toolsDef);
  }

  private async collectWorkspaceOverviewSections(): Promise<Record<string, string>> {
    const commands: Record<string, string> = {
      meta: 'cat package.json && printf "\\n--- tsconfig.json ---\\n" && cat tsconfig.json && printf "\\n--- README.md ---\\n" && cat README.md',
      tree: "find . -maxdepth 2 -type d ! -path './node_modules/*' ! -path './.git/*' ! -path './.agent/node_modules/*' | sort",
      git: 'git log --oneline -10 && printf "\\n--- branches ---\\n" && git branch -a',
      entries: 'for f in src/index.ts server/main.ts server/api.ts web/src/App.tsx; do echo "--- $f ---"; sed -n "1,30p" "$f"; done',
      opencode: 'ls -la .opencode/',
      agent: 'ls -la .agent/',
      agentsMd: 'cat AGENTS.md 2>/dev/null',
    };

    const entries = await Promise.all(
      Object.entries(commands).map(async ([key, command]) => [key, await this.runOverviewCommand(command)] as const),
    );
    return Object.fromEntries(entries);
  }

  private async runOverviewCommand(command: string): Promise<string> {
    const bash = this.collectAllTools().find((tool: any) => tool.name === 'bash');
    if (!bash) return '(bash tool unavailable)';
    try {
      const result = await bash.execute({ command, timeout: 30 });
      return result.output || '';
    } catch (err: any) {
      return `[overview command failed] ${err?.message || String(err)}`;
    }
  }

}

import { tokenCount } from '../context/token-counter';

export function isWorkspaceOverviewRequest(input: string): boolean {
  return routeLocalIntent(input).kind === 'workspace_overview';
}

function isToolBackedWorkMode(intent: LocalIntent) {
  return intent.kind === 'bugfix'
    || intent.kind === 'optimization'
    || intent.kind === 'feature'
    || intent.kind === 'qa';
}

function pickMatch(text: string, pattern: RegExp): string | undefined {
  return text.match(pattern)?.[1]?.trim();
}

function extractPackageInfo(meta: string) {
  const packageJson = pickMatch(meta, /({[\s\S]*?})\s*(?:--- tsconfig\.json ---|$)/);
  if (!packageJson) return { name: '当前项目', version: '', description: '' };
  try {
    const parsed = JSON.parse(packageJson);
    return {
      name: parsed.name || '当前项目',
      version: parsed.version || '',
      description: parsed.description || '',
      scripts: parsed.scripts ? Object.keys(parsed.scripts) : [],
      dependencies: parsed.dependencies ? Object.keys(parsed.dependencies).slice(0, 12) : [],
    };
  } catch {
    return { name: '当前项目', version: '', description: '' };
  }
}

function extractReadmeAttention(meta: string): string[] {
  const readme = meta.split('--- README.md ---').pop() || meta;
  const marker = readme.match(/## 当前注意事项\s*([\s\S]*?)(?:\n## |\n# |$)/);
  if (!marker) return [];
  return marker[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .slice(0, 8);
}

function listDirs(tree: string, prefix: string) {
  return tree
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.replace(/^\.\//, '').replace(/\/$/, ''))
    .slice(0, 8);
}

function buildWorkspaceOverviewAnswer(sections: Record<string, string>): string {
  const pkg = extractPackageInfo(sections.meta || '');
  const srcDirs = listDirs(sections.tree || '', './src/');
  const serverDirs = listDirs(sections.tree || '', './server/');
  const webDirs = listDirs(sections.tree || '', './web/');
  const gitLines = (sections.git || '').split('\n').filter(Boolean).slice(0, 12);
  const attention = extractReadmeAttention(sections.meta || '');
  const techStack = [
    'TypeScript',
    'Bun',
    (sections.meta || '').includes('"hono"') ? 'Hono' : '',
    (sections.meta || '').includes('"openai"') ? 'OpenAI SDK' : '',
    (sections.tree || '').includes('./web') ? 'React Web UI' : '',
    (sections.tree || '').includes('./.agent') ? '.agent 运行态数据' : '',
  ].filter(Boolean);

  return `### 1. 项目定位 + 技术栈

**${pkg.name}**${pkg.version ? ` v${pkg.version}` : ''}：${pkg.description || '当前工作区项目'}。

技术栈：**${techStack.join(' / ') || 'TypeScript'}**。从入口文件看，后端由 **server/main.ts + server/api.ts** 启动 Hono API，核心 Agent 能力从 **src/index.ts** 导出，前端由 **web/src/App.tsx** 承载。

### 2. Mermaid 图表：系统架构总览图

\`\`\`mermaid
flowchart LR
  User["用户"] --> WebUI["React Web UI"]
  WebUI -->|"SSE /api/stream/:sessionId"| Hono["Hono API Server"]
  Hono --> Loop["AgentLoop"]
  Loop --> Pipeline["DefaultStepPipeline / AdaptivePipeline"]
  subgraph Pipeline [每轮迭代]
    Ctx["上下文准备"] --> Retrieve["Skills + RAG 检索"] --> LLM["LLM 调用"] --> Tools["工具执行"]
  end
  Tools --> Policy["DiffUndoPolicy"]
  Policy --> WebUI
\`\`\`

### 3. Mermaid 图表：核心模块依赖图

\`\`\`mermaid
flowchart LR
  Index["src/index.ts"] --> Core["src/core"]
  Index --> Tools["src/tools"]
  Index --> Skills["src/skills"]
  Index --> Rag["src/rag"]
  Index --> Vector["src/vector"]
  Index --> Storage["src/storage"]
  Index --> Policy["src/policy"]
  Index --> Cron["src/cron"]
  Index --> Queue["src/queue"]
  Index --> IM["src/im"]
  Core --> AgentLoop["AgentLoop"]
  Core --> PipelineCore["AdaptivePipeline / DefaultStepPipeline"]
  PipelineCore --> Tools
  PipelineCore --> Policy
  Skills --> Vector
  Rag --> Vector
  Storage --> PipelineCore
\`\`\`

### 4. Mermaid 图表：目录结构 Mindmap

\`\`\`mermaid
mindmap
  root((${pkg.name}))
    src
${srcDirs.map((dir) => `      ${dir.replace('src/', '')}`).join('\n') || '      core\n      tools'}
    server
${serverDirs.map((dir) => `      ${dir.replace('server/', '')}`).join('\n') || '      routes'}
    web
${webDirs.map((dir) => `      ${dir.replace('web/', '')}`).join('\n') || '      src'}
    tests
    docs
    .agent
    .opencode
\`\`\`

### 5. API 路由表格

| 路由 | 说明 |
|------|------|
| \`GET /health\` | 服务健康检查 |
| \`GET /api/stream/:sessionId\` | SSE 对话流 |
| \`POST /api/confirm\` | 工具确认回调 |
| \`GET/PUT/POST /api/model-config\` | 模型配置 |
| \`GET /api/skills\` | 技能列表与详情 |
| \`GET/POST/PUT/DELETE /api/knowledge\` | 知识库管理 |
| \`GET/POST/PUT/DELETE /api/cron\` | 定时任务 |
| \`POST /api/agents/async\` | 异步 Agent 任务 |
| \`GET /api/tools/workspace-context\` | 工作区上下文 |
| \`/im/*\` | IM 网关 |

### 6. 最近 git 活动

\`\`\`text
${gitLines.join('\n') || '未读取到 git 信息'}
\`\`\`

### 7. 注意事项（来自 README 已知问题）

${attention.length ? attention.join('\n') : '- README 未提供明确的“当前注意事项”段落。'}

已按工作区本地信息读取：package/tsconfig/README、目录结构、git、入口文件、.opencode、.agent 和 AGENTS.md。`;
}
