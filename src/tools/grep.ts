import { Tool, safeExecute } from '../core/tool';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import { resolveWorkspacePath, WorkspaceToolOptions } from './workspace';

const execAsync = promisify(exec);

export class GrepTool extends Tool {
  name = 'grep';
  description = '在项目中搜索模式，返回匹配的文件和行号';
  parameters = z.object({
    pattern: z.string().describe('要搜索的正则表达式模式'),
    path: z.string().optional().default('.').describe('搜索路径'),
    include: z.string().optional().describe('文件过滤，如 *.ts'),
  });

  constructor(private options: WorkspaceToolOptions = {}) {
    super();
  }

  protected async executeCore(validatedParams: any) {
    const { pattern, path, include } = validatedParams;
    const targetPath = resolveWorkspacePath(this.options.workspaceRoot, path);

    // 构建 grep 命令，通过 shell 管道 head 截断输出，避免 maxBuffer exceeded
    let cmd = `grep -r -n --color=never`;
    if (include) cmd += ` --include='${include.replace(/'/g, "'\\''")}'`;
    // 转义 pattern 中的单引号
    cmd += ` '${pattern.replace(/'/g, "'\\''")}' '${targetPath.replace(/'/g, "'\\''")}'`;
    cmd += ` | head -80`;

    return safeExecute(this.name, async () => {
      const { stdout } = await execAsync(cmd, {
        timeout: 15000,
        maxBuffer: 1024 * 1024, // 1MB 足够，因为 head 已经截断了
      });
      let output = stdout;
      // 如果刚好 80 行，可能还有更多结果
      const lineCount = output.split('\n').length;
      if (lineCount >= 80) {
        output += '\n... (结果已截断，请缩小搜索范围或添加 include 过滤)';
      }
      return { success: true, output };
    }, { timeout: 20000, maxOutput: 4000 });
  }
}
