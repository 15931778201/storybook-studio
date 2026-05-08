// src/skills/skill-executor.ts
import { SkillStep, StepResult, SkillExecutionResult } from '../types/skill';
import { Tool } from '../core/tool';

export class SkillExecutor {
  private tools: Map<string, Tool> = new Map();

  constructor(tools: Tool[]) {
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }

  // 替换模板变量 {{variable}} → 实际值
  private resolveVariables(params: Record<string, any>, context: Record<string, any>): Record<string, any> {
    const resolved: Record<string, any> = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        resolved[key] = value.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
          return context[varName] !== undefined ? String(context[varName]) : `{{${varName}}}`;
        });
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }

  // 执行单个步骤
  private async executeStep(
    step: SkillStep,
    context: Record<string, any>
  ): Promise<StepResult> {
    const tool = this.tools.get(step.tool);
    if (!tool) {
      return {
        stepId: step.id,
        order: step.order,
        tool: step.tool,
        success: false,
        output: '',
        error: `工具 ${step.tool} 未找到`,
      };
    }

    const resolvedParams = this.resolveVariables(step.params, context);

    try {
      const result = await tool.execute(resolvedParams);
      // 将输出存入上下文，供后续步骤使用
      context[`step_${step.order}_output`] = result.output;
      context[`last_output`] = result.output;

      return {
        stepId: step.id,
        order: step.order,
        tool: step.tool,
        success: result.success ?? true,
        output: result.output,
      };
    } catch (err: any) {
      return {
        stepId: step.id,
        order: step.order,
        tool: step.tool,
        success: false,
        output: '',
        error: err.message,
      };
    }
  }

  // 执行完整技能
  async execute(
    steps: SkillStep[],
    context: Record<string, any> = {}
  ): Promise<SkillExecutionResult> {
    const sortedSteps = [...steps].sort((a, b) => a.order - b.order);
    const results: StepResult[] = [];
    let stopped = false;

    for (const step of sortedSteps) {
      if (stopped) break;

      // 检查条件
      if (step.condition) {
        try {
          const conditionFn = new Function('context', `return ${step.condition}`)({ ...context });
          if (!conditionFn) continue;
        } catch {
          // 条件解析失败，默认执行
        }
      }

      const result = await this.executeStep(step, context);
      results.push(result);

      // 错误处理
      if (!result.success) {
        if (step.onError === 'stop') {
          stopped = true;
        } else if (step.onError === 'retry') {
          // 简单重试一次
          const retryResult = await this.executeStep(step, context);
          results.push(retryResult);
          if (!retryResult.success && step.onError === 'retry') {
            stopped = true;
          }
        }
        // 'skip' 错误继续执行
      }
    }

    const allSuccess = results.every(r => r.success);
    const failedSteps = results.filter(r => !r.success);

    return {
      success: allSuccess,
      skillName: context.skillName || 'unknown',
      stepsCompleted: results.filter(r => r.success).length,
      stepsTotal: sortedSteps.length,
      results,
      summary: allSuccess
        ? `✅ 所有 ${sortedSteps.length} 个步骤执行成功`
        : `⚠️ ${failedSteps.length}/${sortedSteps.length} 个步骤执行失败`,
    };
  }
}