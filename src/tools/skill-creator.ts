import { Tool, ToolResult, safeExecute } from '../core/tool';
import { z } from 'zod';
import { SkillManager } from '../skills/skill-manager';
import { SkillStep } from '../types/skill';

// 确保 steps 是数组
function normalizeSteps(input: any): any[] {
  if (Array.isArray(input)) return input;
  if (typeof input === 'string') {
    try { return JSON.parse(input); } catch { return []; }
  }
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return [input];
  }
  return [];
}

export class CreateSkillTool extends Tool {
  name = 'create_skill';
  description =
    '创建一个新的技能。技能是一组预定义的工具调用序列，可以保存并重复使用。' +
    '步骤格式：{ "tool": "工具名", "params": {...}, "description": "步骤描述" }';
  parameters = z.object({
    name: z.string().describe('技能唯一标识（英文，短横线连接，如 frontend-deploy）'),
    title: z.string().describe('技能标题（中文）'),
    description: z.string().describe('技能描述'),
    steps: z.union([
      z.array(
        z.object({
          tool: z.string(),
          params: z.record(z.any()),
          description: z.string().optional(),
          onError: z.enum(['skip', 'stop', 'retry']).optional(),
        })
      ),
      z.string(), // 允许 JSON 字符串
    ]).describe('步骤列表，按顺序执行'),
    tags: z.array(z.string()).optional().describe('标签'),
  });

  constructor(private manager: SkillManager) {
    super();
  }

  protected async executeCore(validatedParams: unknown): Promise<ToolResult> {
    const params = validatedParams as z.infer<typeof this.parameters>;
    const rawSteps = normalizeSteps(params.steps);
    if (rawSteps.length === 0) {
      return {
        success: false,
        output: '❌ 技能创建失败：steps 参数为空或格式错误。请提供一个包含 tool、params 的步骤数组。',
      };
    }

    const steps: SkillStep[] = rawSteps.map((s: any, i: number) => ({
      id: `step-${i + 1}`,
      order: i + 1,
      tool: s.tool || 'bash',
      params: s.params || {},
      description: s.description || '',
      onError: s.onError || 'skip',
    }));

    const skill = this.manager.createSkill(
      params.name,
      params.title,
      params.description,
      steps,
      params.tags || []
    );

    if (!skill) {
      return { success: false, output: '技能创建失败（可能已存在同名技能）' };
    }

    return {
      success: true,
      output: `✅ 技能 "${skill.metadata.title}" 创建成功！\n- 名称: ${skill.metadata.name}\n- 步骤数: ${steps.length}\n- 使用: call_skill(skillName="${skill.metadata.name}")`,
    };
  }
}

export class UpdateSkillTool extends Tool {
  name = 'update_skill';
  description = '更新已有技能的信息或步骤';
  parameters = z.object({
    name: z.string().describe('技能名称'),
    title: z.string().optional(),
    description: z.string().optional(),
    steps: z.array(
      z.object({
        tool: z.string(),
        params: z.record(z.any()),
        description: z.string().optional(),
        onError: z.enum(['skip', 'stop', 'retry']).optional(),
      })
    ).optional(),
    tags: z.array(z.string()).optional(),
  });

  constructor(private manager: SkillManager) {
    super();
  }

  protected async executeCore(validatedParams: unknown): Promise<ToolResult> {
    const params = validatedParams as z.infer<typeof this.parameters>;
    const updates: any = {};
    if (params.title) updates.title = params.title;
    if (params.description) updates.description = params.description;
    if (params.steps) {
      updates.steps = params.steps.map((s: any, i: number) => ({
        id: `step-${i + 1}`,
        order: i + 1,
        tool: s.tool,
        params: s.params,
        description: s.description || '',
        onError: s.onError || 'skip',
      }));
    }
    if (params.tags) updates.tags = params.tags;

    const skill = this.manager.updateSkill(params.name, updates);
    if (!skill) {
      return { success: false, output: `技能 "${params.name}" 不存在` };
    }
    return { success: true, output: `✅ 技能 "${params.name}" 更新成功` };
  }
}