
import { Tool, safeExecute } from '../core/tool';
import { z } from 'zod';
import fs from 'fs'; import path from 'path';
import { createBackup } from '../utils/backup';
import { generateUnifiedDiff } from '../utils/diff';
import { appendAuditLog } from '../utils/logger';
export class WriteFileTool extends Tool {
  name = 'write_file'; description = '将内容写入文件，自动备份并生成 diff 预览';
  parameters = z.object({ filePath: z.string(), content: z.string() });
  protected async executeCore(validatedParams: any) {
    const { filePath, content } = validatedParams;
    return safeExecute(this.name, async () => {
      const fullPath = path.resolve(process.cwd(), filePath);
      let diff: string | null = null;
      if (fs.existsSync(fullPath)) { const old = fs.readFileSync(fullPath, 'utf8'); diff = generateUnifiedDiff(old, content, filePath); }
      const backupPath = createBackup(fullPath);
      fs.writeFileSync(fullPath, content, 'utf8');
      appendAuditLog({ tool: this.name, filePath, backupPath, diff, timestamp: new Date().toISOString() });
      return { success: true, output: `文件 ${filePath} 写入成功`, metadata: { backupPath, diff } };
    });
  }
}
