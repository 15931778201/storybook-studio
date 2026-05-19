import type { ChatMessage } from '../types/messages';

const SUPPRESSED_SYSTEM_EVENTS = new Set([
  'test-result',
  'repair-start',
  'repair-end',
  'repair-skipped',
  'summary-ready',
]);

export function shouldSuppressStandaloneSystemMessage(eventType: string) {
  return SUPPRESSED_SYSTEM_EVENTS.has(eventType);
}

/** 检测 assistant 文本内容是否与 summary 卡片内容高度重叠 */
export function isAssistantContentOverlappingWithSummary(
  content: string,
  summary: Record<string, any>,
): boolean {
  const normalized = String(content || '').trim();
  if (!normalized) return false;

  // 旧模板三段式
  if (
    normalized.startsWith('改了什么\n')
    && normalized.includes('\n为什么\n')
    && normalized.includes('\n测试结果\n')
  ) {
    return true;
  }

  // 新格式引导语
  if (/^已完成 \d+ 个文件的变更，详情见上方摘要卡片。$/.test(normalized)) return true;
  if (/^未产生文件变更，详情见上方摘要卡片。$/.test(normalized)) return true;

  // 检测文件列表重叠：如果 content 中的文件路径与 summary.appliedFiles 高度重合
  const appliedFiles: string[] = summary.appliedFiles || [];
  if (appliedFiles.length >= 2) {
    const overlapCount = appliedFiles.filter((f) => normalized.includes(f)).length;
    if (overlapCount >= Math.ceil(appliedFiles.length * 0.6)) return true;
  }

  return false;
}

export function mergeSummaryIntoAssistantMessage(
  messages: ChatMessage[],
  assistantId: string | null,
  summary: Record<string, any>,
) {
  if (!assistantId) {
    return [
      ...messages,
      {
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        content: '变更总结',
        contentType: 'summary' as const,
        metadata: { summary },
      },
    ];
  }

  return messages.map((message) => {
    if (message.id !== assistantId) return message;

    // 如果 assistant 文本与 summary 卡片重叠，则清空文本避免重复
    const contentOverlaps = isAssistantContentOverlappingWithSummary(
      message.content || '',
      summary,
    );

    return {
      ...message,
      content: contentOverlaps ? '' : message.content,
      contentType: 'summary' as const,
      metadata: {
        ...(message.metadata || {}),
        summary,
      },
    };
  });
}
