// src/tools/bash.ts
import { z } from 'zod';
import { safeExecute, Tool, ToolResult } from '../core/tool';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

export class BashTool extends Tool {
  name = 'bash';
  description = '执行 Shell 命令（安全，防注入）';
  parameters = z.object({
    command: z.string(),
    args: z.preprocess(
      (val) => (typeof val === 'string' ? val.split(' ').filter(Boolean) : val),
      z.array(z.string()).optional().default([])
    ),
    // ✅ 核心修复：timeout 无论如何都会得到一个合法值
    timeout: z.preprocess(
      (val) => {
        const num = Number(val);
        // 如果转换失败、值为 0、负数或超大，都用默认 30000
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

    return safeExecute(
      this.name,
      async () => {
        const { stdout, stderr } = await execFileAsync(command, args, {
          timeout: safeInternal,
          maxBuffer: 5 * 1024 * 1024,
        });
        return { success: true, output: stdout + (stderr ? `\n[STDERR] ${stderr}` : '') };
      },
      { timeout: safeInternal + 5000, maxOutput: 4000 }
    );
  }
}