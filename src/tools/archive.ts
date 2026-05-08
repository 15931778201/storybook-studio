import { Tool, safeExecute, ToolResult, ToolError } from '../core/tool';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

export class ArchiveTool extends Tool {
  name = 'archive';
  description = '压缩文件为 zip 或解压 zip 文件';
  parameters = z.object({
    action: z.enum(['compress', 'decompress']).describe('操作类型'),
    source: z.string().describe('源文件或目录路径（压缩）或 zip 文件路径（解压）'),
    target: z.string().describe('目标 zip 文件路径（压缩）或解压目标目录（解压）'),
  });

  protected async executeCore(validatedParams: unknown): Promise<ToolResult> {
    const { action, source, target } = validatedParams as z.infer<typeof this.parameters>;
    const fullSource = path.resolve(process.cwd(), source);
    const fullTarget = path.resolve(process.cwd(), target);

    return safeExecute(this.name, async () => {
      if (action === 'compress') {
        const zip = new AdmZip();
        if (fs.statSync(fullSource).isDirectory()) {
          zip.addLocalFolder(fullSource);
        } else {
          zip.addLocalFile(fullSource);
        }
        zip.writeZip(fullTarget);
        return { success: true, output: `已压缩至 ${target}` };
      } else {
        const zip = new AdmZip(fullSource);
        zip.extractAllTo(fullTarget, true);
        return { success: true, output: `已解压至 ${target}` };
      }
    }, { timeout: 60000, maxOutput: 2000 });
  }
}