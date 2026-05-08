// src/core/agent-loop.ts
import { DefaultStepPipeline } from './default-step-pipeline';
import type { AgentConfig } from '../types/config';
import type { Message } from '../types/message';
import type { StepPipeline } from './step-pipeline';

export class AgentLoop {
  private pipeline: StepPipeline;
  private maxIterations: number;

  constructor(
    private config: AgentConfig,
    private sessionId: string = 'default',
    pipeline?: StepPipeline
  ) {
    // 优先使用注入的管道，否则自动创建优化的 DefaultStepPipeline
    if (pipeline) {
      this.pipeline = pipeline;
    } else {
      // 从 config 中获取 modelConfigStore（需确保已在 config 中提供）
      const modelConfigStore = (config as any).modelConfigStore;
      if (!modelConfigStore) {
        throw new Error('AgentLoop 需要 modelConfigStore，请通过 config.modelConfigStore 传入');
      }
      this.pipeline = new DefaultStepPipeline(config, sessionId, modelConfigStore);
    }
    this.maxIterations = config.maxIterations;
  }

  async run(userInput: string, signal?: AbortSignal): Promise<string> {
    const messages: Message[] = [{ role: 'user', content: userInput }];

    for (let iter = 1; iter <= this.maxIterations; iter++) {
      if (signal?.aborted) return '任务已被取消。';

      const result = await this.pipeline.executeStep(messages, userInput, iter);
      if (result.done) {
        return result.finalOutput ?? '任务完成。';
      }
    }

    return `⚠️ 达到最大迭代次数 (${this.maxIterations})，任务未完成。`;
  }
}