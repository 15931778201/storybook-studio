export interface FinalSummaryInput {
  appliedFiles: string[];
  changes?: Array<{ kind: 'initial' | 'repair'; toolName: string; changedFiles: string[]; diff?: string }>;
  repair?: {
    attempted: boolean;
    success: boolean;
    changes: Array<{ kind: 'initial' | 'repair'; toolName: string; changedFiles: string[]; diff?: string }>;
  };
  failure?: {
    rollbackPerformed: boolean;
    rolledBackFiles: string[];
    conflict?: any;
  };
  verification: {
    commands: string[];
    passed: boolean;
    output: string;
  };
}

export function buildFinalAnswerFromSummary(summary: FinalSummaryInput, userGoal?: string) {
  const changedFiles = [...new Set((summary.changes || []).flatMap((change) => change.changedFiles))];
  const repairLine = summary.repair?.attempted
    ? `自动修复: ${summary.repair.success ? '已执行并通过' : '已执行但仍失败'}`
    : '自动修复: 未触发';

  return [
    '改了什么',
    changedFiles.length ? changedFiles.join(', ') : '无文件变更',
    '',
    '为什么',
    userGoal || '根据当前任务完成代码修改与验证闭环',
    repairLine,
    summary.failure?.conflict ? `写入异常: ${summary.failure.conflict.reason || '未知冲突'}` : '',
    summary.failure?.rollbackPerformed ? `回滚: ${summary.failure.rolledBackFiles.join(', ') || '已执行'}` : '',
    '',
    '测试结果',
    summary.verification.commands.length ? summary.verification.commands.join(', ') : '未执行测试',
    summary.verification.passed ? '结果: 通过' : '结果: 失败',
  ].join('\n');
}
