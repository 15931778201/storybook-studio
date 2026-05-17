// src/core/adaptive-pipeline.ts
import { DefaultStepPipeline, parseToolCallFromText, shouldUseNativeTools } from './default-step-pipeline';
import { AgentPlan, PlanStep } from './step-pipeline';
import type { StepResult } from './step-pipeline';
import type { Message, ToolCall } from '../types/message';
import type { AgentConfig } from '../types/config';
import { ModelConfigStore } from '../storage/model-config-store';
import { zodToJsonSchema } from '../utils/schema';

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

    // 更新步骤状态为 running
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

      if (stepSuccess) {
        this.eventBus.emit(`message-${this.sessionId}`, {
          type: 'plan-step-update',
          stepId: step.stepId,
          status: 'done',
          duration,
        });
        this.currentStepIndex++;
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
      return { done: true, finalOutput: errorMsg };
    } catch (err: any) {
      const errorMsg = `❌ 重规划失败: ${err.message}`;
      this.eventBus.emit(`message-${this.sessionId}`, { type: 'error', content: errorMsg });
      this.mode = 'done';
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
        return { done: true, finalOutput: fallbackOutput };
      }
      const errorMsg = `❌ 模型服务异常\n📋 错误详情: ${err.message}`;
      this.eventBus.emit(`message-${this.sessionId}`, { type: 'error', content: errorMsg });
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
}

import { tokenCount } from '../context/token-counter';
