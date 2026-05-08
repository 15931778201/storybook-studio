
import { z } from 'zod';
export interface ToolResult { success: boolean; output: string; metadata?: Record<string, unknown>; }
export class ToolError extends Error {
  constructor(message: string, public toolName: string, public params: Record<string, any>, public isRetryable: boolean = false) { super(message); this.name = 'ToolError'; }
}
export abstract class Tool {
  abstract name: string;
  abstract description: string;
  abstract parameters: z.ZodTypeAny;
  async execute(rawParams: Record<string, unknown>): Promise<ToolResult> {
    const parsed = this.parameters.safeParse(rawParams);
    if (!parsed.success) return { success: false, output: `[${this.name}] 参数校验失败: ${parsed.error.issues.map(i => i.message).join('; ')}` };
    return this.executeCore(parsed.data);
  }
  protected abstract executeCore(validatedParams: unknown): Promise<ToolResult>;
}
export async function safeExecute(toolName: string, fn: () => Promise<ToolResult>, options?: { timeout?: number; maxOutput?: number; fallback?: () => Promise<ToolResult> }): Promise<ToolResult> {
  const maxOutput = options?.maxOutput ?? 4000;
  let timeoutMs = options?.timeout ?? 30000;
  if (typeof timeoutMs !== 'number' || isNaN(timeoutMs) || timeoutMs <= 0) timeoutMs = 30000;
  if (timeoutMs > 2147483647) timeoutMs = 2147483647;
  try {
    const result = await Promise.race([
      fn(),
      new Promise<ToolResult>((_, reject) => setTimeout(() => reject(new Error(`工具 ${toolName} 执行超时(${timeoutMs}ms)`)), timeoutMs))
    ]);
    return { ...result, success: true, output: result.output.slice(0, maxOutput) };
  } catch (err: any) {
    if (options?.fallback) return options.fallback();
    return { success: false, output: `[${toolName} 执行失败] ${err.message}` };
  }
}
