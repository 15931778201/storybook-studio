export type ConfirmPresentationFile = {
  filePath: string;
  changeType: 'added' | 'deleted' | 'modified';
  accepted?: boolean;
};

export function groupFilesByChangeType(files: ConfirmPresentationFile[]) {
  return {
    added: files.filter((file) => file.changeType === 'added'),
    deleted: files.filter((file) => file.changeType === 'deleted'),
    modified: files.filter((file) => file.changeType === 'modified'),
  };
}

export function buildSelectionStatus(
  files: ConfirmPresentationFile[],
  selectedFiles: Record<string, boolean>,
) {
  const acceptedFiles = files.filter((file) => selectedFiles[file.filePath] !== false);
  const rejectedFiles = files.filter((file) => selectedFiles[file.filePath] === false);

  return {
    total: files.length,
    accepted: acceptedFiles.length,
    rejected: rejectedFiles.length,
    acceptedGroups: groupFilesByChangeType(acceptedFiles),
    rejectedGroups: groupFilesByChangeType(rejectedFiles),
  };
}

export function shouldRenderSummaryNarrative(content: string | undefined | null) {
  const normalized = String(content || '').trim();
  if (!normalized) return false;

  return !(
    normalized.startsWith('改了什么\n')
    && normalized.includes('\n为什么\n')
    && normalized.includes('\n测试结果\n')
  );
}

export function formatDiffContentForDisplay(language: string, content: string) {
  const normalized = String(content || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .trimEnd();

  if (language === 'json') {
    try {
      return JSON.stringify(JSON.parse(normalized || '{}'), null, 2);
    } catch {
      return normalized;
    }
  }

  return normalized;
}
