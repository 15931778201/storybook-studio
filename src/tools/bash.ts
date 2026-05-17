// src/tools/bash.ts
import { z } from 'zod';
import { safeExecute, Tool, ToolResult } from '../core/tool';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec) as (command: string, options?: { shell?: boolean | string; timeout?: number; maxBuffer?: number }) => Promise<{ stdout: string; stderr: string }>;

function shellQuote(arg: string): string {
  if (/^[\w@%+,:;!~.\/=-]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

export class BashTool extends Tool {
  name = 'bash';
  description = '执行 Shell 命令（支持管道、重定向、变量）';
  parameters = z.object({
    command: z.string().describe('要执行的命令（推荐直接写完整 shell 命令，如 "ls -la | grep foo"）'),
    args: z.array(z.string()).optional().default([]).describe('命令参数（可选，会自动追加到 command 后）'),
    timeout: z.preprocess(
      (val) => {
        const num = Number(val);
        if (isNaN(num) || num < 1000) return 30000;
        if (num > 2_147_483_647) return 2_147_483_647;
        return num;
      },
      z.number().int().min(1000).max(120_000).optional().default(30000)
    ).describe('超时毫秒（1-120秒，默认30秒）'),
  });

  protected async executeCore(validatedParams: unknown): Promise<ToolResult> {
    const { command, args = [], timeout } = validatedParams as z.infer<typeof this.parameters>;
    const safeInternal = Math.min(Math.max(Number(timeout) || 30_000, 1000), 2_147_483_647);

    const cmd = args.length > 0
      ? `${command} ${args.map(shellQuote).join(' ')}`
      : command;

    return safeExecute(
      this.name,
      async () => {
        try {
          const { stdout, stderr } = await execAsync(cmd, {
            shell: true,
            timeout: safeInternal,
            maxBuffer: 5 * 1024 * 1024,
          });
          const output = stdout + (stderr ? `\n[STDERR] ${stderr}` : '');
          return { success: true, output };
        } catch (error: any) {
          const partialStdout = error.stdout || '';
          const partialStderr = error.stderr || '';
          let output = partialStdout + (partialStderr ? `\n[STDERR] ${partialStderr}` : '');
          if (error.killed) {
            output += `\n⚠️ 命令超时 (${safeInternal}ms)`;
          } else {
            output += `\n[退出码 ${error.code}]`;
          }
          return { success: true, output };
        }
      },
      { timeout: safeInternal + 5000, maxOutput: 10000 }
    );
  }
}