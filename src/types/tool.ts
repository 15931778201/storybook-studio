import { z } from 'zod';

export interface ToolResult {
  output: string;
  metadata?: Record<string, unknown>;
}

export class ToolError extends Error {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly params: Record<string, any>,
    public readonly isRetryable: boolean = false
  ) {
    super(message);
    this.name = "ToolError";
  }
}

export abstract class Tool {
  abstract name: string;
  abstract description: string;
  abstract parameters: z.ZodTypeAny;

  abstract execute(params: z.infer<this["parameters"]>): Promise<ToolResult>;
}
