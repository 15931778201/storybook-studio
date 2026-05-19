import { Tool, safeExecute } from '../core/tool';
import { z } from 'zod';
import fs from 'fs';
import { createBackup } from '../utils/backup';
import { generateUnifiedDiff } from '../utils/diff';
import { appendAuditLog } from '../utils/logger';
import { resolveWorkspacePath, WorkspaceToolOptions } from './workspace';

export class WriteFileTool extends Tool {
  name = 'write_file';
  description = '将内容写入文件，自动备份并生成 diff 预览';
  parameters = z.object({ filePath: z.string(), content: z.string() });

  constructor(private options: WorkspaceToolOptions = {}) { super(); }

  resolvePath(filePath: string) {
    return resolveWorkspacePath(this.options.workspaceRoot, filePath);
  }

  protected async executeCore(validatedParams: any) {
    const { filePath, content } = validatedParams;
    return safeExecute(this.name, async () => {
      const fullPath = this.resolvePath(filePath);
      if (fs.existsSync(fullPath)) {
        const old = fs.readFileSync(fullPath, 'utf8');
        if (old === content) {
          return {
            success: true,
            output: `文件 ${filePath} 内容未变化`,
            metadata: { changedFiles: [] },
          };
        }
        return {
          success: false,
          output: `文件 ${filePath} 已存在；修改现有文件请使用 apply_patch`,
        };
      }
      let diff: string | null = null;
      const backupPath = createBackup(fullPath);
      fs.writeFileSync(fullPath, content, 'utf8');
      appendAuditLog({ tool: this.name, filePath, backupPath, diff, timestamp: new Date().toISOString() });
      return { success: true, output: `文件 ${filePath} 写入成功`, metadata: { backupPath, diff, changedFiles: [filePath] } };
    });
  }
}
