import { Tool, safeExecute, ToolResult } from '../core/tool';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { WorkspaceToolOptions, resolveWorkspaceRoot } from './workspace';

const execFileAsync = promisify(execFile);

export class GitTool extends Tool {
  name = 'git';
  description = '执行 git 命令（如 diff, log, status，不包括 push）';
  parameters = z.object({
    subcommand: z.enum(['diff', 'log', 'status', 'branch', 'show']).describe('Git 子命令'),
    args: z.array(z.string()).optional().default([]),
  });

  constructor(private options: WorkspaceToolOptions = {}) { super(); }

  protected async executeCore(validatedParams: unknown): Promise<ToolResult> {
    const { subcommand, args = [] } = validatedParams as z.infer<typeof this.parameters>;
    return safeExecute(this.name, async () => {
      const allowedCommands = ['diff', 'log', 'status', 'branch', 'show'];
      if (!allowedCommands.includes(subcommand)) {
        return { success: false, output: `不支持的 git 子命令: ${subcommand}` };
      }
      const { stdout } = await execFileAsync('git', [subcommand, ...args], {
        timeout: 30000,
        maxBuffer: 1024 * 1024 * 5,
        cwd: resolveWorkspaceRoot(this.options.workspaceRoot),
      });
      return { success: true, output: stdout.slice(0, 5000) };
    }, { timeout: 35000, maxOutput: 5000 });
  }
}
