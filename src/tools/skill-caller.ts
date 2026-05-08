import { Tool, ToolResult, safeExecute } from '../core/tool';
import { z } from 'zod';
import { SkillManager } from '../skills/skill-manager';
import { SkillExecutor } from '../skills/skill-executor';
import type { Tool as ITool } from '../core/tool';  // 避免命名冲突

export class SkillCallerTool extends Tool {
  name = 'call_skill';
  description =
    '调用一个已保存的技能。技能是一组预定义的工具调用序列。' +
    '使用 list_skills 查看可用技能，使用 create_skill 创建新技能。';
  parameters = z.object({
    skillName: z.string().describe('技能名称'),
    context: z.record(z.any()).optional().describe('传递给技能的上下文变量'),
  });

  private manager: SkillManager;
  private executor: SkillExecutor;

  constructor(manager: SkillManager, tools: ITool[]) {
    super();
    this.manager = manager;
    this.executor = new SkillExecutor(tools);
  }

  protected async executeCore(validatedParams: unknown): Promise<ToolResult> {
    const { skillName, context } = validatedParams as z.infer<typeof this.parameters>;
    const skill = this.manager.getSkill(skillName);
    if (!skill) {
      return {
        success: false,
        output: `❌ 技能 "${skillName}" 不存在。使用 list_skills 查看可用技能。`,
      };
    }

    console.log(`🎯 执行技能: ${skill.metadata.title}`);
    const result = await this.executor.execute(skill.steps, {
      ...context,
      skillName: skill.metadata.name,
    });

    return {
      success: result.success,
      output: `${result.summary}\n\n详细结果:\n${result.results
        .map(
          (r) =>
            `  ${r.success ? '✅' : '❌'} [${r.order}] ${r.tool}: ${r.success ? r.output.slice(0, 100) : r.error}`
        )
        .join('\n')}`,
      metadata: { executionResult: result },
    };
  }
}

// 列出技能的 Tool
export class ListSkillsTool extends Tool {
  name = 'list_skills';
  description = '列出所有可用的技能';
  parameters = z.object({});

  constructor(private manager: SkillManager) {
    super();
  }

  protected async executeCore(_validatedParams: unknown): Promise<ToolResult> {
    const skills = this.manager.listSkills();
    if (skills.length === 0) {
      return { success: true, output: '当前没有任何技能。使用 create_skill 创建。' };
    }
    const list = skills.map(
      (s) =>
        `- **${s.metadata.name}**: ${s.metadata.title} — ${s.metadata.description} [${s.metadata.tags.join(', ')}]`
    );
    return { success: true, output: `📚 可用技能 (${skills.length}):\n${list.join('\n')}` };
  }
}