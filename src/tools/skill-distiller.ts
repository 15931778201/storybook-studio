import { Tool, safeExecute, ToolResult } from '../core/tool';
import { z } from 'zod';
import { SkillManager } from '../skills/skill-manager';
import OpenAI from 'openai';

export class SkillDistillerTool extends Tool {
  name = 'distill_skill';
  description = '从最近的对话历史中自动提取并创建技能。' +
    '当用户要求“把刚才的操作保存为技能”或任务完成后主动建议蒸馏时使用。';
  parameters = z.object({
    name: z.string().describe('技能唯一标识（英文，短横线连接）'),
    title: z.string().describe('技能标题（中文）'),
    description: z.string().optional().describe('技能描述，如不提供则自动生成'),
    recentMessages: z.string().describe('最近几轮对话的JSON字符串，包含用户消息和工具调用结果'),
    generalizeParams: z.boolean().optional().default(true).describe('是否自动泛化参数为变量'),
  });

  constructor(private manager: SkillManager, private openai: OpenAI) {
    super();
  }

  protected async executeCore(validatedParams: unknown): Promise<ToolResult> {
    const { name, title, description, recentMessages, generalizeParams } =
      validatedParams as z.infer<typeof this.parameters>;

    return safeExecute(this.name, async () => {
      // 调用 LLM 分析对话历史，提取步骤
      const prompt = this.buildDistillPrompt(recentMessages, name, title, description);
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      if (!result.steps || result.steps.length === 0) {
        return { success: false, output: '未从对话中识别出可复用的步骤' };
      }

      // 泛化参数
      const steps = result.steps.map((step: any, idx: number) => ({
        id: `step-${idx + 1}`,
        order: idx + 1,
        tool: step.tool,
        params: generalizeParams ? this.generalizeParams(step.params) : step.params,
        description: step.description || '',
        onError: 'skip',
      }));

      // 使用 SkillManager 创建技能
      const skill = this.manager.createSkill(
        name,
        title,
        description || result.description || '',
        steps,
        result.tags || []
      );

      if (!skill) {
        return { success: false, output: '技能创建失败' };
      }
      return {
        success: true,
        output: `✅ 技能 "${title}" 已成功蒸馏！\n- 名称: ${name}\n- 步骤数: ${steps.length}\n- 使用: call_skill(skillName="${name}")`,
      };
    });
  }

  private buildDistillPrompt(messages: string, name: string, title: string, description?: string): string {
    return `你是一个技能蒸馏专家。请分析以下对话历史，提取出用户完成的复杂操作流程，生成一个可复用的技能。

技能名称: ${name}
技能标题: ${title}
${description ? `技能描述: ${description}` : '请根据操作自动生成描述'}

对话历史:
${messages}

请严格输出JSON格式：
{
  "description": "技能描述（如未提供）",
  "steps": [
    {
      "tool": "工具名（如 bash, write_file, read_file 等）",
      "params": { "参数名": "参数值" },
      "description": "步骤描述"
    }
  ],
  "tags": ["标签1", "标签2"]
}

要求：
1. 步骤按执行顺序排列
2. 参数值中明显为项目特定的内容（如具体路径、文件名）可以保留，不要过度抽象
3. 标签从以下选择：deploy, test, setup, review, build, refactor, custom
4. 省略闲聊、确认交互等非操作步骤`;
  }

  private generalizeParams(params: Record<string, any>): Record<string, any> {
    const generalized: Record<string, any> = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        // 将明显的具体路径/参数替换为变量占位符
        if (value.match(/^\/[a-zA-Z0-9/._-]+$/)) {
          generalized[key] = `{{${key}}}`;
        } else if (value.match(/^https?:\/\/.+/)) {
          generalized[key] = `{{${key}}}`;
        } else if (key === 'filePath' || key === 'command') {
          generalized[key] = value; // 保留原始值，不过度泛化
        } else {
          generalized[key] = value;
        }
      } else {
        generalized[key] = value;
      }
    }
    return generalized;
  }
}