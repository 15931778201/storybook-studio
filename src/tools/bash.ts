
import { Tool, safeExecute } from '../core/tool';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);
export class BashTool extends Tool {
  name = 'bash';
  description = '执行 Shell 命令（参数化，安全防注入）';
  parameters = z.object({
    command: z.string(),
    args: z.preprocess((val: any) => typeof val === 'string' ? val.split(' ').filter(Boolean) : val, z.array(z.string()).optional().default([])),
    timeout: z.coerce.number().int().min(1000).max(120000).optional().default(30000)
  });
  protected async executeCore(validatedParams: any) {
    const { command, args = [], timeout } = validatedParams;
    const safeTimeout = Math.min(Math.max(Number(timeout) || 30000, 1000), 2147483647);
    return safeExecute(this.name, async () => {
      const { stdout, stderr } = await execFileAsync(command, args, { timeout: safeTimeout, maxBuffer: 5*1024*1024 });
      return { success: true, output: stdout + (stderr ? '\n[STDERR] ' + stderr : '') };
    }, { timeout: safeTimeout + 5000, maxOutput: 4000 });
  }
}
