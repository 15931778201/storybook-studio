import { Tool, safeExecute, ToolResult, ToolError } from '../core/tool';
import { z } from 'zod';
import fs from 'fs';
import { generateUnifiedDiff } from '../utils/diff';
import { appendAuditLog } from '../utils/logger';
import { resolveWorkspacePath, WorkspaceToolOptions } from './workspace';

export class EditFileTool extends Tool {
  name = 'edit_file';
  description = '在文件中查找并替换指定内容（支持正则）';
  parameters = z.object({
    filePath: z.string().describe('要编辑的文件路径'),
    search: z.string().describe('要查找的文本或正则表达式'),
    replace: z.string().describe('替换后的文本'),
    isRegex: z.boolean().optional().default(false).describe('是否使用正则表达式'),
  });

  constructor(private options: WorkspaceToolOptions = {}) {
    super();
  }

  protected async executeCore(validatedParams: unknown): Promise<ToolResult> {
    const { filePath, search, replace, isRegex } = validatedParams as z.infer<typeof this.parameters>;
    return safeExecute(this.name, async () => {
      const fullPath = resolveWorkspacePath(this.options.workspaceRoot, filePath);
      if (!fs.existsSync(fullPath)) {
        throw new ToolError(`文件不存在: ${filePath}`, this.name, { filePath });
      }
      let content = fs.readFileSync(fullPath, 'utf-8');
      const before = content;
      if (isRegex) {
        const regex = new RegExp(search, 'g');
        content = content.replace(regex, replace);
      } else {
        content = content.split(search).join(replace);
      }
      if (content === before) {
        return { success: true, output: '未找到匹配内容，文件无变化' };
      }
      fs.writeFileSync(fullPath, content, 'utf-8');
      const diff = generateUnifiedDiff(before, content, filePath);
      appendAuditLog({ tool: this.name, filePath, diff, timestamp: new Date().toISOString() });
      return { success: true, output: `已在 ${filePath} 中完成替换`, metadata: { changedFiles: [filePath], diff } };
    });
  }
}
