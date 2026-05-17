// src/core/step-pipeline.ts
import type { Message } from '../types/message';
import type { AgentConfig } from '../types/config';

export interface StepResult {
  /** 是否应该终止循环 */
  done: boolean;
  /** 终止时要返回给用户的最终消息 */
  finalOutput?: string;
}

export interface PlanStep {
  stepId: number;
  description: string;
  tool: string;
  args: Record<string, any>;
  dependsOn?: number[];
}

export interface AgentPlan {
  goal: string;
  steps: PlanStep[];
}

export abstract class StepPipeline {
  protected config: AgentConfig;
  protected sessionId: string;

  constructor(config: AgentConfig, sessionId: string) {
    this.config = config;
    this.sessionId = sessionId;
  }

  /** 执行一次完整的迭代，返回结果告诉 Runner 是否该停止 */
  abstract executeStep(messages: Message[], userInput: string, iteration: number): Promise<StepResult>;
}