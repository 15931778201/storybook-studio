import { parseDiffBundle } from './diff-presentation';

export interface SummaryChange {
  kind: 'initial' | 'repair';
  toolName: string;
  changedFiles: string[];
  diff?: string;
}

export interface SummaryMetadata {
  appliedFiles: string[];
  verification: {
    commands: string[];
    passed: boolean;
    output: string;
  };
  changes?: SummaryChange[];
  repair?: {
    attempted: boolean;
    success: boolean;
    changes: SummaryChange[];
  };
  failure?: {
    rollbackPerformed: boolean;
    rolledBackFiles: string[];
    conflict?: {
      filePath?: string;
      reason?: string;
    };
  };
}

export interface SummarySection {
  key: 'initial' | 'repair' | 'failure' | 'verification';
  title: string;
  status?: 'passed' | 'failed';
  changes?: Array<SummaryChange & { bundle: ReturnType<typeof parseDiffBundle> }>;
  commands?: string[];
  output?: string;
  details?: string;
}

export function buildSummarySections(summary: SummaryMetadata): SummarySection[] {
  const sections: SummarySection[] = [];

  if (summary.changes?.length) {
    sections.push({
      key: 'initial',
      title: '本次变更',
      changes: summary.changes.map((change) => ({
        ...change,
        bundle: parseDiffBundle(change.diff || ''),
      })),
    });
  }

  if (summary.repair?.attempted && summary.repair.changes.length) {
    sections.push({
      key: 'repair',
      title: '自动修复',
      status: summary.repair.success ? 'passed' : 'failed',
      changes: summary.repair.changes.map((change) => ({
        ...change,
        bundle: parseDiffBundle(change.diff || ''),
      })),
    });
  }

  if (summary.failure && (summary.failure.rollbackPerformed || summary.failure.conflict)) {
    const detailLines = [];
    if (summary.failure.rollbackPerformed) {
      detailLines.push(`已回滚: ${summary.failure.rolledBackFiles.join(', ') || '无'}`);
    }
    if (summary.failure.conflict?.filePath) {
      detailLines.push(`冲突文件: ${summary.failure.conflict.filePath}`);
    }
    if (summary.failure.conflict?.reason) {
      detailLines.push(`冲突原因: ${summary.failure.conflict.reason}`);
    }
    sections.push({
      key: 'failure',
      title: '写入失败',
      status: 'failed',
      details: detailLines.join('\n'),
    });
  }

  sections.push({
    key: 'verification',
    title: '测试结果',
    status: summary.verification.passed ? 'passed' : 'failed',
    commands: summary.verification.commands,
    output: summary.verification.output,
  });

  return sections;
}
