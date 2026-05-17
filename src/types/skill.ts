export interface SkillMetadata {
  name: string; title: string; description: string;
  version: string; author: string; tags: string[];
  createdAt: string; updatedAt: string;
}
export interface SkillStep {
  id: string; order: number; tool: string;
  params: Record<string, any>; description: string;
  condition?: string; onError?: 'skip' | 'stop' | 'retry';
}

export interface SkillTemplate {
  name: string;
  title: string;
  description: string;
  category: 'deploy' | 'test' | 'refactor' | 'review' | 'setup' | 'custom';
  steps: SkillStep[];     // 预定义的步骤模板
  requiredTools: string[];// 依赖的工具列表
}

export interface ParsedSkill {
  metadata: SkillMetadata; steps: SkillStep[]; raw: string;
}
export interface SkillExecutionResult { success: boolean; skillName: string; stepsCompleted: number; stepsTotal: number; results: any[]; summary: string; }
export interface StepResult { stepId: string; order: number; tool: string; success: boolean; output: string; error?: string; }

export type ImportSourceType = 'github' | 'clawhub' | 'direct' | 'unknown';

export interface ImportResult {
  name: string;
  title: string;
  success: boolean;
  overwritten: boolean;
  error?: string;
}
