
import { Tool, safeExecute, ToolError } from '../core/tool';
import { z } from 'zod';
import fs from 'fs'; import path from 'path';
export class ReadFileTool extends Tool {
  name = 'read_file'; description = '读取指定文件的内容';
  parameters = z.object({ filePath: z.string(), offset: z.coerce.number().int().min(0).optional().default(0), limit: z.coerce.number().int().min(1).optional().default(500) });
  protected async executeCore(validatedParams: any) {
    const { filePath, offset, limit } = validatedParams;
    return safeExecute(this.name, async () => {
      const fullPath = path.resolve(process.cwd(), filePath);
      if (!fs.existsSync(fullPath)) throw new ToolError('文件不存在', this.name, { filePath });
      const lines = fs.readFileSync(fullPath, 'utf-8').split('\n');
      return { success: true, output: lines.slice(offset, offset + limit).join('\n') };
    });
  }
}
