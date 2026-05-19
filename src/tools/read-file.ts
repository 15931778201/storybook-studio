import { Tool, safeExecute, ToolError } from '../core/tool';
import { z } from 'zod';
import fs from 'fs';
import { resolveWorkspacePath, WorkspaceToolOptions } from './workspace';

export class ReadFileTool extends Tool {
  name = 'read_file';
  description = '读取指定文件的内容';
  parameters = z.object({
    filePath: z.string().describe('文件路径'),
    offset: z.coerce.number().int().min(0).optional().default(0).describe('偏移量'),
    limit: z.coerce.number().int().min(1).optional().default(500).describe('读取行数限制'),
  });
  
  // 自然语言示例：展示如何调用工具
  example = `// 读取 package.json 文件的全部内容
{
  "filePath": "package.json"
}

// 读取大文件的特定部分（从第100行开始，读取50行）
{
  "filePath": "large-file.log",
  "offset": 100,
  "limit": 50
}`;

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