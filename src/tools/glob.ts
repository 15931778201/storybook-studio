
import { Tool, safeExecute } from '../core/tool';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { resolveWorkspacePath, WorkspaceToolOptions } from './workspace';
const execFileAsync = promisify(execFile);
export class GlobTool extends Tool {
  name = 'glob'; description = '按模式查找文件';
  parameters = z.object({ 
    pattern: z.string(), path: z.string().optional().default('.').describe('查找的目录，默认为当前目录'), 
    args: z.preprocess(
      (val: any) => typeof val === 'string' ? 
        val.split(' ').filter(Boolean) : 
        val, z.array(z.string()).optional().default([]))
      .describe('额外的参数，如 -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -maxdepth 10'),
  });

  constructor(private options: WorkspaceToolOptions = {}) {
    super();
  }

  protected async executeCore(validatedParams: any) {
    const { pattern, path, args = [] } = validatedParams;
    return safeExecute(this.name, async () => {
      const targetPath = resolveWorkspacePath(this.options.workspaceRoot, path);
      const fullArgs = [targetPath, '-name', pattern, '-not', '-path', '*/node_modules/*', '-not', '-path', '*/.git/*', '-maxdepth', '10', ...args];
      const { stdout } = await execFileAsync('find', fullArgs, { timeout: 10000, maxBuffer: 5*1024*1024 });
      return { success: true, output: stdout.slice(0, 5000) };
    }, { timeout: 15000, maxOutput: 5000 });
  }
}
