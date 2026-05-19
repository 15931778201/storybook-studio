import { Tool, safeExecute, ToolResult, ToolError } from '../core/tool';
import { z } from 'zod';
import fs from 'fs';
import { ApplyPatchTool } from './apply-patch';
import { WorkspaceToolOptions } from './workspace';

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
      const patchTool = new ApplyPatchTool(this.options);
      const fullPath = patchTool.resolvePath(filePath);
      if (!fs.existsSync(fullPath)) {
        throw new ToolError(`文件不存在: ${filePath}`, this.name, { filePath });
      }
      if (isRegex) {
        throw new ToolError(`edit_file 暂不支持 regex 直写，请改用 apply_patch`, this.name, { filePath, isRegex });
      }
      const result = await patchTool.execute({
        patches: [
          {
            filePath,
            search,
            replace,
          },
        ],
      });
      return {
        ...result,
        output: result.success ? `已在 ${filePath} 中完成替换` : result.output,
        metadata: {
          ...(result.metadata || {}),
          writeProtocol: 'apply_patch',
        },
      };
    });
  }
}
