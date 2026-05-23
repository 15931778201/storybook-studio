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
  const pendingFiles = files.filter(
    (file) => selectedFiles[file.filePath] === undefined && file.accepted === undefined,
  );

  return {
    total: files.length,
    accepted: acceptedFiles.length,
    rejected: rejectedFiles.length,
    pending: pendingFiles.length,
    acceptedGroups: groupFilesByChangeType(acceptedFiles),
    rejectedGroups: groupFilesByChangeType(rejectedFiles),
    pendingGroups: groupFilesByChangeType(pendingFiles),
  };
}

export interface FileManifestGroup {
  label: string;
  color: string;
  changeType: 'added' | 'deleted' | 'modified';
  files: Array<ConfirmPresentationFile & { additions?: number; deletions?: number }>;
}

export function buildFileManifestGroups(
  files: Array<ConfirmPresentationFile & { additions?: number; deletions?: number }>,
): FileManifestGroup[] {
  const groups = groupFilesByChangeType(files);
  const manifestGroups: FileManifestGroup[] = [
    { label: '新增', color: 'green', changeType: 'added', files: groups.added },
    { label: '删除', color: 'red', changeType: 'deleted', files: groups.deleted },
    { label: '修改', color: 'blue', changeType: 'modified', files: groups.modified },
  ];
  return manifestGroups.filter((group) => group.files.length > 0);
}

export function shouldRenderSummaryNarrative(content: string | undefined | null) {
  const normalized = String(content || '').trim();
  if (!normalized) return false;

  // 旧模板格式：包含「改了什么 / 为什么 / 测试结果」三段式
  if (
    normalized.startsWith('改了什么\n')
    && normalized.includes('\n为什么\n')
    && normalized.includes('\n测试结果\n')
  ) {
    return false;
  }

  // 新格式：summary 卡片完整时的简短引导语，不需要再渲染文本
  const suppressedPatterns = [
    /^已完成 \d+ 个文件的变更，详情见上方摘要卡片。$/,
    /^未产生文件变更，详情见上方摘要卡片。$/,
    /^任务目标:/,
  ];
  if (suppressedPatterns.some((p) => p.test(normalized))) {
    return false;
  }

  return true;
}

export function formatDiffContentForDisplay(language: string, content: string) {
  const normalized = String(content || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .trimEnd();

  if (!normalized) return normalized;

  // JSON: 标准缩进格式化
  if (language === 'json') {
    try {
      return JSON.stringify(JSON.parse(normalized || '{}'), null, 2);
    } catch {
      return normalized;
    }
  }

  // YAML/TOML: 键值对对齐
  if (language === 'yaml' || language === 'toml') {
    return alignKeyValuePairs(normalized);
  }

  // CSS/SCSS/LESS: 属性排序 + 缩进统一
  if (language === 'css' || language === 'scss' || language === 'less') {
    return formatCssLike(normalized);
  }

  // Python: 缩进规范化（统一为四空格）
  if (language === 'python') {
    return normalizePythonIndent(normalized);
  }

  // TypeScript/JavaScript/HTML/Markdown 等: 统一缩进风格
  if (
    language === 'typescript' ||
    language === 'javascript' ||
    language === 'html' ||
    language === 'markdown' ||
    language === 'dockerfile' ||
    language === 'shell'
  ) {
    return normalizeIndentation(normalized);
  }

  return normalized;
}

/** 统一缩进风格：检测 tab/space 并统一为 2 空格，去除多余空行 */
function normalizeIndentation(code: string): string {
  const lines = code.split('\n');
  // 检测主要缩进风格
  let spaceCount = 0;
  let tabCount = 0;
  for (const line of lines) {
    const leadingSpaces = line.match(/^( {2,})/);
    if (leadingSpaces) spaceCount++;
    if (/^\t/.test(line)) tabCount++;
  }

  let result = lines;
  // 如果使用 tab，转换为 2 空格
  if (tabCount > spaceCount) {
    result = result.map((line) => line.replace(/^\t/gm, '  '));
  }

  // 去除连续多余空行（保留最多一个空行）
  return collapseBlankLines(result.join('\n'));
}

/** 对齐 YAML/TOML 键值对冒号 */
function alignKeyValuePairs(code: string): string {
  const lines = code.split('\n');
  const blockRanges: Array<{ start: number; end: number }> = [];
  let blockStart = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '' && i > blockStart) {
      blockRanges.push({ start: blockStart, end: i });
      blockStart = i + 1;
    }
  }
  blockRanges.push({ start: blockStart, end: lines.length });

  const result = [...lines];
  for (const range of blockRanges) {
    const blockLines = lines.slice(range.start, range.end);
    const kvLines: Array<{ index: number; keyLen: number }> = [];
    for (let i = 0; i < blockLines.length; i++) {
      const match = blockLines[i].match(/^(\s*[^:#]+?)([:=])\s/);
      if (match) {
        kvLines.push({ index: i, keyLen: match[1].length });
      }
    }
    if (kvLines.length >= 2) {
      const maxKeyLen = Math.max(...kvLines.map((kv) => kv.keyLen));
      for (const kv of kvLines) {
        const originalLine = blockLines[kv.index];
        const padding = ' '.repeat(maxKeyLen - kv.keyLen);
        const aligned = originalLine.replace(/^(\s*[^:#]+?)([:=])\s/, `$1${padding}$2 `);
        result[range.start + kv.index] = aligned;
      }
    }
  }

  return collapseBlankLines(result.join('\n'));
}

/** CSS 类语言格式化：统一缩进 + 排序属性 */
function formatCssLike(code: string): string {
  // 统一缩进为 2 空格
  let result = code.replace(/\t/g, '  ');
  // 去除行尾分号前空格
  result = result.replace(/\s+;/g, ';');
  // 去除多余空行
  return collapseBlankLines(result);
}

/** Python 缩进规范化：tab 转 4 空格 */
function normalizePythonIndent(code: string): string {
  let result = code.replace(/\t/g, '    ');
  return collapseBlankLines(result);
}

/** 去除连续多余空行（保留最多一个空行） */
function collapseBlankLines(code: string): string {
  return code.replace(/\n{3,}/g, '\n\n');
}
