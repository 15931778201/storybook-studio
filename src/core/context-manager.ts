export interface ContextManagerOptions { maxTokens: number; keepRecentTurns: number; compressionThreshold: number; }
export abstract class ContextManager {
  constructor(protected options: ContextManagerOptions) {}
  abstract compress(messages: any[]): Promise<any[]>;
  abstract injectSystemPrompt(messages: any[], memories: any[], projectContext: string): any[];
  abstract checkThreshold(messages: any[]): boolean;
}
