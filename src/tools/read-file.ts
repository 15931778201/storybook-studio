import { Tool, safeExecute, ToolError } from '../core/tool';
import { z } from 'zod';
import fs from 'fs';
import { resolveWorkspacePath, WorkspaceToolOptions } from './workspace';

export class ReadFileTool extends Tool {
  name = 'read_file';
  description = '读取指定文件的内容';
  parameters = z.object({
    filePath: z.string(),
    offset: z.coerce.number().int().min(0).optional().default(0),
    limit: z.coerce.number().int().min(1).optional().default(500),
  });

  constructor(private options: WorkspaceToolOptions = {}) { super(); }

  resolvePath(filePath: string) {
    return resolveWorkspacePath(this.options.workspaceRoot, filePath);
  }

  protected async executeCore(validatedParams: any) {
    const { filePath, offset, limit } = validatedParams;
    return safeExecute(this.name, async () => {
      const fullPath = this.resolvePath(filePath);
      if (!fs.existsSync(fullPath)) throw new ToolError('文件不存在', this.name, { filePath });
      const lines = fs.readFileSync(fullPath, 'utf-8').split('\n');
      return { success: true, output: lines.slice(offset, offset + limit).join('\n') };
    });
  }
}
