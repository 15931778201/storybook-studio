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
    this.pipeline = pipeline || new DefaultStepPipeline(config, sessionId, (config as any).modelConfigStore);
    this.maxIterations = config.maxIterations;
  }

  async run(userInput: string, signal?: AbortSignal): Promise<string> {
    const imageBase64 = (this.config as any).imageBase64 as string | undefined;
    const messages: Message[] = [{ role: 'user', content: userInput, imageBase64 }];

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