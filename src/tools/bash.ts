// src/tools/bash.ts
import { z } from 'zod';
import { safeExecute, Tool, ToolResult } from '../core/tool';
import { exec } from 'child_process';
import { promisify } from 'util';
import { appendAuditLog } from '../utils/logger';
import { resolveWorkspaceRoot, WorkspaceToolOptions } from './workspace';

// 扩展execAsync的类型定义以支持cwd选项
const execAsync = promisify(exec) as (
  command: string, 
  options?: { 
    shell?: boolean | string; 
    timeout?: number; 
    maxBuffer?: number;
    cwd?: string;
  }
) => Promise<{ stdout: string; stderr: string }>;

function shellQuote(arg: string): string {
  if (/^[\w@%+,:;!~.\/=-]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

export class BashTool extends Tool {
  name = 'bash';
  description = '在安全沙箱中执行 bash 命令';
  parameters = z.object({
    command: z.string().describe('要执行的 bash 命令'),
    timeout: z.number().optional().default(30).describe('超时时间（秒）'),
  });
  
  // 自然语言示例：展示如何调用工具
  example = `// 列出当前目录的文件
{
  "command": "ls -la"
}

// 查看系统信息
{
  "command": "uname -a",
  "timeout": 10
}

// 搜索特定文件
{
  "command": "find . -name '*.ts' -type f"
}`;

  constructor(private options: WorkspaceToolOptions = {}) { super(); }

  protected async executeCore(validatedParams: any) {
    const { command, timeout } = validatedParams;
    const safeInternal = Math.min(Math.max(Number(timeout) || 30_000, 1000), 2_147_483_647);

    const cmd = command;
    const risk = classifyCommandRisk(cmd);

    return safeExecute(
      this.name,
      async () => {
        try {
          const { stdout, stderr } = await execAsync(cmd, {
            shell: true,
            timeout: safeInternal,
            maxBuffer: 5 * 1024 * 1024,
            cwd: resolveWorkspaceRoot(this.options.workspaceRoot),
          });
          const output = stdout + (stderr ? `\n[STDERR] ${stderr}` : '');
          appendAuditLog({
            tool: this.name,
            command: cmd,
            riskLevel: risk.riskLevel,
            requiresConfirmation: risk.requiresConfirmation,
            timestamp: new Date().toISOString(),
          });
          return { success: true, output, metadata: risk };
        } catch (error: any) {
          const partialStdout = error.stdout || '';
          const partialStderr = error.stderr || '';
          let output = partialStdout + (partialStderr ? `\n[STDERR] ${partialStderr}` : '');
          if (error.killed) {
            output += `\n⚠️ 命令超时 (${safeInternal}ms)`;
          } else {
            output += `\n[退出码 ${error.code}]`;
          }
          appendAuditLog({
            tool: this.name,
            command: cmd,
            riskLevel: risk.riskLevel,
            requiresConfirmation: risk.requiresConfirmation,
            timestamp: new Date().toISOString(),
          });
          return { success: false, output, metadata: risk };
        }
      },
      { timeout: safeInternal }
    );
  }
}

function classifyCommandRisk(command: string): { riskLevel: 'low' | 'medium' | 'high'; requiresConfirmation: boolean } {
  if (/(rm\s+-rf|git\s+reset\s+--hard|mkfs|dd\s+if=|shutdown|reboot|:\(\)\s*\{)/.test(command)) {
    return { riskLevel: 'high', requiresConfirmation: true };
  }
  if (/(git\s+clean\s+-fd|chmod\s+-R|chown\s+-R)/.test(command)) {
    return { riskLevel: 'medium', requiresConfirmation: true };
  }
  return { riskLevel: 'low', requiresConfirmation: false };
}
