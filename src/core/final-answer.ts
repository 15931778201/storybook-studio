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

/** 判断 summary 是否包含足够数据来渲染 summary 卡片 */
export function isSummaryCardComplete(summary: FinalSummaryInput): boolean {
  return Boolean(
    summary.appliedFiles &&
    summary.verification &&
    typeof summary.verification.passed === 'boolean',
  );
}

export function buildFinalAnswerFromSummary(summary: FinalSummaryInput, userGoal?: string) {
  const changedFiles = [...new Set((summary.changes || []).flatMap((change) => change.changedFiles))];

  // 当 summary 卡片数据完整时，final answer 只输出补充性说明，
  // 不再重复文件列表、修复状态、测试结果等卡片已展示的内容
  if (isSummaryCardComplete(summary)) {
    const lines: string[] = [];

    if (userGoal) {
      lines.push(`任务目标: ${userGoal}`);
    }

    if (summary.failure?.conflict) {
      lines.push(`⚠️ 写入异常: ${summary.failure.conflict.reason || '未知冲突'}`);
    }
    if (summary.failure?.rollbackPerformed) {
      lines.push(`↩️ 已回滚: ${summary.failure.rolledBackFiles.join(', ') || '已执行'}`);
    }

    // 仅在无特殊信息时给出简短引导语
    if (lines.length === 0) {
      lines.push(changedFiles.length > 0
        ? `已完成 ${changedFiles.length} 个文件的变更，详情见上方摘要卡片。`
        : '未产生文件变更，详情见上方摘要卡片。',
      );
    }

    return lines.join('\n');
  }

  // 降级：summary 卡片数据不完整时，仍输出完整模板
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
