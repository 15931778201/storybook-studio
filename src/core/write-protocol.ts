import { generateUnifiedDiff } from '../utils/diff';

// ─── 统一写入协议类型 ───────────────────────────────────────────

export type WriteProtocol = 'apply_patch';

export interface UnifiedWriteResult {
  writeProtocol: WriteProtocol;
  changedFiles: string[];
  appliedFiles: string[];
  diff: string;
  backupCount: number;
  rollbackPerformed: boolean;
  rolledBackFiles: string[];
  conflict?: {
    filePath?: string;
    reason?: string;
    hunkIndex?: number;
    searchSnippet?: string;
    beforeContextSnippet?: string;
    afterContextSnippet?: string;
  };
}

// ─── Staged Write 类型 ──────────────────────────────────────────

export type StagedWriteStatus = 'pending' | 'committed' | 'rolled_back';

export interface StagedWriteEntry {
  id: string;
  sessionId: string;
  toolName: string;
  filePath: string;
  fullPath: string;
  originalContent: string;
  patchedContent: string;
  diff: string;
  backupPath: string;
  status: StagedWriteStatus;
  createdAt: string;
  committedAt?: string;
  rolledBackAt?: string;
}

export interface StagedWriteCommitResult {
  committed: string[];
  rolledBack: string[];
}

// ─── Hunk 级冲突检测结果 ────────────────────────────────────────

export interface HunkConflict {
  filePath: string;
  hunkIndex: number;
  searchSnippet: string;
  reason: 'not_found' | 'multiple_matches' | 'context_mismatch' | 'line_offset_drift';
  actualMatches: number;
  expectedMatches: number;
  beforeContextMatch: boolean;
  afterContextMatch: boolean;
  lineOffset?: number;
}

export interface HunkConflictCheckResult {
  hasConflict: boolean;
  conflicts: HunkConflict[];
}

// ─── 审计记录结构 ───────────────────────────────────────────────

export interface AuditChangeRecord {
  id: string;
  sessionId: string;
  toolName: string;
  writeProtocol: WriteProtocol;
  filePath: string;
  action: 'stage' | 'apply' | 'rollback' | 'commit';
  diff: string;
  backupPath: string;
  status: StagedWriteStatus;
  timestamp: string;
  metadata?: {
    hunkIndex?: number;
    expectedMatches?: number;
    actualMatches?: number;
    conflictReason?: string;
    [key: string]: unknown;
  };
}

// ─── 原有工具函数 ───────────────────────────────────────────────

export function shouldPromoteWriteToPatch(before: string, after: string): boolean {
  if (before === after) return false;
  if (before.length === 0) return false;
  return true;
}

export function buildPatchArgsForWrite(filePath: string, before: string, after: string) {
  return {
    patches: [
      {
        filePath,
        search: before,
        replace: after,
        expectedMatches: 1,
      },
    ],
  };
}

// ─── Hunk 级冲突检测 ────────────────────────────────────────────

/**
 * 对 patch 列表执行细粒度 hunk 级冲突检测。
 * 与 apply-patch.ts 中的基础检测不同，这里会：
 * 1. 逐 hunk 检查搜索文本在文件中的匹配情况
 * 2. 检测行偏移漂移（line offset drift）
 * 3. 独立校验 beforeContext / afterContext
 * 4. 返回结构化的冲突列表，而非简单的 pass/fail
 * 5. 新增：检测部分匹配、模糊匹配、内容相似度等高级冲突检测
 */
export function checkHunkConflicts(
  fileContent: string,
  patches: Array<{
    filePath: string;
    search: string;
    replace: string;
    expectedMatches?: number;
    beforeContext?: string;
    afterContext?: string;
  }>,
): HunkConflictCheckResult {
  const conflicts: HunkConflict[] = [];

  for (let hunkIndex = 0; hunkIndex < patches.length; hunkIndex++) {
    const patch = patches[hunkIndex];
    const actualMatches = fileContent.split(patch.search).length - 1;

    // 未找到匹配
    if (actualMatches === 0) {
      // 尝试模糊匹配（相似度检测）
      const fuzzyMatch = findFuzzyMatch(fileContent, patch.search);
      if (fuzzyMatch.similarity > 0.8) {
        // 高相似度但不完全匹配，标记为模糊冲突
        conflicts.push({
          filePath: patch.filePath,
          hunkIndex,
          searchSnippet: patch.search.slice(0, 80),
          reason: 'context_mismatch',
          actualMatches: 0,
          expectedMatches: patch.expectedMatches ?? 1,
          beforeContextMatch: false,
          afterContextMatch: false,
        });
        continue;
      }
      
      conflicts.push({
        filePath: patch.filePath,
        hunkIndex,
        searchSnippet: patch.search.slice(0, 80),
        reason: 'not_found',
        actualMatches: 0,
        expectedMatches: patch.expectedMatches ?? 1,
        beforeContextMatch: false,
        afterContextMatch: false,
      });
      continue;
    }

    // 多次匹配
    if (patch.expectedMatches != null && actualMatches !== patch.expectedMatches) {
      conflicts.push({
        filePath: patch.filePath,
        hunkIndex,
        searchSnippet: patch.search.slice(0, 80),
        reason: 'multiple_matches',
        actualMatches,
        expectedMatches: patch.expectedMatches,
        beforeContextMatch: false,
        afterContextMatch: false,
      });
      continue;
    }

    // 上下文校验
    const searchIndex = fileContent.indexOf(patch.search);
    let beforeContextMatch = true;
    let afterContextMatch = true;

    if (patch.beforeContext != null) {
      const beforeSlice = fileContent.slice(
        Math.max(0, searchIndex - patch.beforeContext.length),
        searchIndex,
      );
      beforeContextMatch = beforeSlice === patch.beforeContext;
      if (!beforeContextMatch) {
        // 检测行偏移漂移：在搜索文本附近的行范围内查找 beforeContext
        const lineOffset = detectLineOffsetDrift(fileContent, patch.search, patch.beforeContext);
        if (lineOffset !== null) {
          conflicts.push({
            filePath: patch.filePath,
            hunkIndex,
            searchSnippet: patch.search.slice(0, 80),
            reason: 'line_offset_drift',
            actualMatches,
            expectedMatches: patch.expectedMatches ?? 1,
            beforeContextMatch: false,
            afterContextMatch: true,
            lineOffset,
          });
          continue;
        }
        
        // 检查是否是部分上下文匹配
        const partialMatch = checkPartialContextMatch(beforeSlice, patch.beforeContext);
        if (!partialMatch.isComplete) {
          conflicts.push({
            filePath: patch.filePath,
            hunkIndex,
            searchSnippet: patch.search.slice(0, 80),
            reason: 'context_mismatch',
            actualMatches,
            expectedMatches: patch.expectedMatches ?? 1,
            beforeContextMatch: false,
            afterContextMatch: true,
          });
          continue;
        }
      }
    }

    if (patch.afterContext != null) {
      const afterStart = searchIndex + patch.search.length;
      const afterSlice = fileContent.slice(afterStart, afterStart + patch.afterContext.length);
      afterContextMatch = afterSlice === patch.afterContext;
      if (!afterContextMatch) {
        // 检查部分上下文匹配
        const partialMatch = checkPartialContextMatch(afterSlice, patch.afterContext);
        if (!partialMatch.isComplete) {
          conflicts.push({
            filePath: patch.filePath,
            hunkIndex,
            searchSnippet: patch.search.slice(0, 80),
            reason: 'context_mismatch',
            actualMatches,
            expectedMatches: patch.expectedMatches ?? 1,
            beforeContextMatch: true,
            afterContextMatch: false,
          });
          continue;
        }
      }
    }

    if (!beforeContextMatch || !afterContextMatch) {
      conflicts.push({
        filePath: patch.filePath,
        hunkIndex,
        searchSnippet: patch.search.slice(0, 80),
        reason: 'context_mismatch',
        actualMatches,
        expectedMatches: patch.expectedMatches ?? 1,
        beforeContextMatch,
        afterContextMatch,
      });
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}

/**
 * 模糊匹配检测：计算字符串相似度
 */
function findFuzzyMatch(content: string, search: string): { similarity: number; position: number } {
  if (search.length === 0) return { similarity: 0, position: -1 };
  
  // 简单的滑动窗口相似度计算
  let bestSimilarity = 0;
  let bestPosition = -1;
  const searchLen = search.length;
  
  for (let i = 0; i <= content.length - searchLen; i++) {
    const substring = content.slice(i, i + searchLen);
    const similarity = calculateSimilarity(substring, search);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestPosition = i;
    }
  }
  
  return { similarity: bestSimilarity, position: bestPosition };
}

/**
 * 计算两个字符串的相似度（基于字符匹配）
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1.length !== str2.length) return 0;
  let matches = 0;
  for (let i = 0; i < str1.length; i++) {
    if (str1[i] === str2[i]) matches++;
  }
  return matches / str1.length;
}

/**
 * 检查部分上下文匹配
 */
function checkPartialContextMatch(actual: string, expected: string): { isComplete: boolean; matchRatio: number } {
  if (actual.length === 0 || expected.length === 0) {
    return { isComplete: false, matchRatio: 0 };
  }
  
  const minLength = Math.min(actual.length, expected.length);
  let matches = 0;
  for (let i = 0; i < minLength; i++) {
    if (actual[i] === expected[i]) matches++;
  }
  
  const matchRatio = matches / expected.length;
  return { isComplete: matchRatio >= 0.9, matchRatio };
}

/**
 * 检测行偏移漂移：搜索文本存在但 beforeContext 不匹配时，
 * 在搜索文本附近的行范围内查找 beforeContext，返回偏移行数
 */
function detectLineOffsetDrift(
  fileContent: string,
  search: string,
  beforeContext: string,
): number | null {
  const searchIndex = fileContent.indexOf(search);
  if (searchIndex === -1) return null;

  const beforeLines = fileContent.slice(0, searchIndex).split('\n');
  const contextLines = beforeContext.split('\n');
  const contextLineCount = contextLines.length;

  // 在搜索位置前 20 行范围内查找 context
  const maxDrift = 20;
  const startLine = Math.max(0, beforeLines.length - contextLineCount - maxDrift);

  for (let offset = 1; offset <= maxDrift; offset++) {
    // 向前偏移 offset 行
    const candidateStart = beforeLines.length - contextLineCount - offset;
    if (candidateStart < startLine) break;
    const candidate = beforeLines.slice(candidateStart, candidateStart + contextLineCount).join('\n');
    if (candidate === beforeContext) {
      return offset;
    }
  }

  // 向后偏移
  for (let offset = 1; offset <= maxDrift; offset++) {
    const candidateStart = beforeLines.length - contextLineCount + offset;
    if (candidateStart + contextLineCount > beforeLines.length) break;
    const candidate = beforeLines.slice(candidateStart, candidateStart + contextLineCount).join('\n');
    if (candidate === beforeContext) {
      return -offset;
    }
  }

  return null;
}

// ─── Staged Write 管理器 ────────────────────────────────────────

export class StagedWriteManager {
  private stagingDir: string;
  private entries: Map<string, StagedWriteEntry> = new Map();

  constructor(stagingDir = '.agent/staging') {
    this.stagingDir = stagingDir;
  }

  /** 将写入操作暂存到 staging 区，不直接落盘 */
  async stage(entry: Omit<StagedWriteEntry, 'id' | 'status' | 'createdAt'>): Promise<StagedWriteEntry> {
    const staged: StagedWriteEntry = {
      ...entry,
      id: `stage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.entries.set(staged.id, staged);

    // 将暂存内容写入 staging 目录
    const fs = await import('fs');
    fs.mkdirSync(this.stagingDir, { recursive: true });
    const stagingFilePath = `${this.stagingDir}/${staged.id}.json`;
    fs.writeFileSync(stagingFilePath, JSON.stringify(staged, null, 2), 'utf-8');

    return staged;
  }

  /** 确认后提交：将暂存的变更真正写入文件系统 */
  async commit(stagedId: string): Promise<{ success: boolean; filePath: string }> {
    const entry = this.entries.get(stagedId);
    if (!entry || entry.status !== 'pending') {
      return { success: false, filePath: '' };
    }

    const fs = await import('fs');
    try {
      fs.writeFileSync(entry.fullPath, entry.patchedContent, 'utf-8');
      entry.status = 'committed';
      entry.committedAt = new Date().toISOString();
      this.entries.set(stagedId, entry);

      // 更新 staging 文件
      const stagingFilePath = `${this.stagingDir}/${stagedId}.json`;
      if (fs.existsSync(stagingFilePath)) {
        fs.writeFileSync(stagingFilePath, JSON.stringify(entry, null, 2), 'utf-8');
      }

      return { success: true, filePath: entry.filePath };
    } catch {
      return { success: false, filePath: entry.filePath };
    }
  }

  /** 拒绝后回滚：恢复原始内容 */
  async rollback(stagedId: string): Promise<{ success: boolean; filePath: string }> {
    const entry = this.entries.get(stagedId);
    if (!entry || entry.status !== 'pending') {
      return { success: false, filePath: '' };
    }

    const fs = await import('fs');
    try {
      // 恢复原始内容
      if (entry.backupPath && fs.existsSync(entry.backupPath)) {
        fs.copyFileSync(entry.backupPath, entry.fullPath);
      } else {
        fs.writeFileSync(entry.fullPath, entry.originalContent, 'utf-8');
      }

      entry.status = 'rolled_back';
      entry.rolledBackAt = new Date().toISOString();
      this.entries.set(stagedId, entry);

      // 更新 staging 文件
      const stagingFilePath = `${this.stagingDir}/${stagedId}.json`;
      if (fs.existsSync(stagingFilePath)) {
        fs.writeFileSync(stagingFilePath, JSON.stringify(entry, null, 2), 'utf-8');
      }

      return { success: true, filePath: entry.filePath };
    } catch {
      return { success: false, filePath: entry.filePath };
    }
  }

  /** 批量提交所有 pending 状态的暂存条目 */
  async commitAll(sessionId: string): Promise<StagedWriteCommitResult> {
    const result: StagedWriteCommitResult = { committed: [], rolledBack: [] };
    for (const [id, entry] of this.entries) {
      if (entry.sessionId === sessionId && entry.status === 'pending') {
        const commitResult = await this.commit(id);
        if (commitResult.success) {
          result.committed.push(commitResult.filePath);
        } else {
          await this.rollback(id);
          result.rolledBack.push(commitResult.filePath);
        }
      }
    }
    return result;
  }

  /** 批量回滚所有 pending 状态的暂存条目 */
  async rollbackAll(sessionId: string): Promise<string[]> {
    const rolledBack: string[] = [];
    for (const [id, entry] of this.entries) {
      if (entry.sessionId === sessionId && entry.status === 'pending') {
        const rbResult = await this.rollback(id);
        if (rbResult.success) rolledBack.push(rbResult.filePath);
      }
    }
    return rolledBack;
  }

  /** 获取指定会话的所有暂存条目 */  getBySession(sessionId: string): StagedWriteEntry[] {
    return [...this.entries.values()].filter((e) => e.sessionId === sessionId);
  }

  /** 获取指定状态的暂存条目 */
  getByStatus(status: StagedWriteStatus): StagedWriteEntry[] {
    return [...this.entries.values()].filter((e) => e.status === status);
  }
}

// ─── 审计记录构建 ───────────────────────────────────────────────

export function buildAuditChangeRecord(
  partial: Omit<AuditChangeRecord, 'id' | 'writeProtocol' | 'timestamp'>,
): AuditChangeRecord {
  return {
    ...partial,
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    writeProtocol: 'apply_patch',
    timestamp: new Date().toISOString(),
  };
}

/** 从工具执行结果构建统一写入结果 */
export function buildUnifiedWriteResult(params: {
  changedFiles: string[];
  appliedFiles: string[];
  diff: string;
  backupCount: number;
  rollbackPerformed: boolean;
  rolledBackFiles: string[];
  conflict?: Record<string, unknown>;
}): UnifiedWriteResult {
  return {
    writeProtocol: 'apply_patch',
    changedFiles: params.changedFiles,
    appliedFiles: params.appliedFiles,
    diff: params.diff,
    backupCount: params.backupCount,
    rollbackPerformed: params.rollbackPerformed,
    rolledBackFiles: params.rolledBackFiles,
    conflict: params.conflict as UnifiedWriteResult['conflict'],
  };
}
