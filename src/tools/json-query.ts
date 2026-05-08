import { Tool, safeExecute, ToolResult } from '../core/tool';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

export class JsonQueryTool extends Tool {
  name = 'json_query';
  description = '读取 JSON 文件并执行简单路径查询（如 data.users[0].name）';
  parameters = z.object({
    filePath: z.string().describe('JSON 文件路径'),
    path: z.string().optional().describe('点号分隔的路径，如 users.0.name，留空返回整个 JSON'),
  });

  protected async executeCore(validatedParams: unknown): Promise<ToolResult> {
    const { filePath, path: queryPath } = validatedParams as z.infer<typeof this.parameters>;
    return safeExecute(this.name, async () => {
      const fullPath = path.resolve(process.cwd(), filePath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const data = JSON.parse(content);
      if (!queryPath) return { success: true, output: JSON.stringify(data, null, 2).slice(0, 4000) };

      const parts = queryPath.split('.');
      let current: any = data;
      for (const part of parts) {
        const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
        if (arrayMatch) {
          current = current?.[arrayMatch[1]]?.[Number(arrayMatch[2])];
        } else {
          current = current?.[part];
        }
        if (current === undefined) return { success: false, output: `路径 ${queryPath} 不存在` };
      }
      return { success: true, output: JSON.stringify(current, null, 2).slice(0, 4000) };
    });
  }
}