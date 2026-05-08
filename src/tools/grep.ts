
import { Tool, safeExecute } from '../core/tool';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);
export class GrepTool extends Tool {
  name = 'grep'; description = '在项目中搜索模式';
  parameters = z.object({ pattern: z.string(), path: z.string().optional().default('.'), include: z.string().optional() });
  protected async executeCore(validatedParams: any) {
    const { pattern, path, include } = validatedParams;
    const args = ['-r', '-n', '--color=never']; if (include) args.push('--include', include); args.push(pattern, path);
    return safeExecute(this.name, async () => { const { stdout } = await execFileAsync('grep', args, { timeout: 15000, maxBuffer: 5*1024*1024 }); return { success: true, output: stdout.slice(0, 5000) }; }, { timeout: 20000, maxOutput: 5000 });
  }
}
