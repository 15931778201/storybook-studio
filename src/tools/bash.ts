// src/tools/bash.ts
import { z } from 'zod';
import { safeExecute, Tool, ToolResult } from '../core/tool';
import { exec } from 'child_process';
import { promisify } from 'util';
import { appendAuditLog } from '../utils/logger';
import { resolveWorkspaceRoot, WorkspaceToolOptions } from './workspace';

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

export interface BashRiskClassification {
  riskLevel: 'low' | 'medium' | 'high';
  requiresConfirmation: boolean;
  policy: 'allow' | 'confirm' | 'deny';
}

export class BashTool extends Tool {
  name = 'bash';
  description = '在安全沙箱中执行 bash 命令';
  parameters = z.object({
    command: z.string().describe('要执行的 bash 命令'),
    args: z.array(z.string()).optional().describe('可选参数数组，会与 command 一起拼接'),
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
    const { command, args = [], timeout } = validatedParams;
    const timeoutMs = Math.min(Math.max((Number(timeout) || 30) * 1000, 1000), 2_147_483_647);

    const cmd = args.length > 0
      ? [command, ...args.map(shellQuote)].join(' ')
      : command;
    const risk = classifyCommandRisk(cmd);

    return safeExecute(
      this.name,
      async () => {
        try {
          const { stdout, stderr } = await execAsync(cmd, {
            shell: true,
            timeout: timeoutMs,
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
            output += `\n⚠️ 命令超时 (${timeoutMs}ms)`;
            appendAuditLog({
              tool: this.name,
              command: cmd,
              riskLevel: risk.riskLevel,
              requiresConfirmation: risk.requiresConfirmation,
              timestamp: new Date().toISOString(),
            });
            return { success: false, output, metadata: risk };
          }

          output += `\n[退出码 ${error.code}]`;
          appendAuditLog({
            tool: this.name,
            command: cmd,
            riskLevel: risk.riskLevel,
            requiresConfirmation: risk.requiresConfirmation,
            timestamp: new Date().toISOString(),
          });
          return { success: true, output, metadata: risk };
        }
      },
      { timeout: timeoutMs }
    );
  }
}

export function classifyCommandRisk(command: string): BashRiskClassification {
  const normalized = command.trim();
  if (!normalized) {
    return { riskLevel: 'low', requiresConfirmation: false, policy: 'allow' };
  }

  if (/(^|\s)(rm\s+-rf|git\s+reset\s+--hard|git\s+clean\s+-fdx?|mkfs|dd\s+if=|shutdown|reboot|:\(\)\s*\{|sudo\s+rm\b)/.test(normalized)) {
    return { riskLevel: 'high', requiresConfirmation: true, policy: 'deny' };
  }

  if (/(^|\s)(bun\s+install|npm\s+install|pnpm\s+install|yarn\s+install|chmod\s+-R|chown\s+-R|docker\s+build|git\s+checkout\b|git\s+switch\b)/.test(normalized)) {
    return { riskLevel: 'medium', requiresConfirmation: true, policy: 'confirm' };
  }

  return { riskLevel: 'low', requiresConfirmation: false, policy: 'allow' };
}
