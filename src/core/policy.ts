export class PolicyResult { allowed: boolean = true; reason?: string; diff?: string | null; needApproval?: boolean; metadata?: Record<string, unknown>; }
export abstract class Policy {
  abstract preExecute(tool: any, params: Record<string, any>): Promise<PolicyResult>;
  abstract postExecute(tool: any, params: any, result: any): Promise<void>;
  abstract undo(operationId: string): Promise<string>;
  abstract getAuditLog(limit?: number): Promise<any[]>;
}
