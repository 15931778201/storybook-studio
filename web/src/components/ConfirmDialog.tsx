import { lazy, Suspense, useMemo, useState } from 'react';
import { Alert, Button, Collapse, Modal, Progress, Space, Tabs, Tag, Typography } from 'antd';
import { parseDiffBundle, parseUnifiedDiff } from '../utils/diff-presentation';
import { buildSelectionStatus, buildFileManifestGroups, formatDiffContentForDisplay } from '../utils/confirm-presentation';

const DiffEditor = lazy(() => import('./DiffEditor'));

export default function ConfirmDialog({
  toolName,
  args,
  diff,
  onConfirm,
  onReject,
  files,
  summary,
}: {
  toolName: string;
  args?: Record<string, unknown>;
  diff: string;
  onConfirm: (selectedFiles?: Record<string, boolean>) => void;
  onReject: () => void;
  files?: Array<{ filePath: string; changeType: 'added' | 'deleted' | 'modified'; accepted: boolean }>;
  summary?: { total: number; accepted: number; added: number; deleted: number; modified: number };
}) {
  const bundle = parseDiffBundle(diff, args);
  const activeFile = bundle.files[0] || parseUnifiedDiff(diff, args);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((files || bundle.files).map((file: any) => [file.filePath, file.accepted ?? true])),
  );
  const selectionStatus = useMemo(
    () => buildSelectionStatus((files || bundle.files).map((file: any) => ({ ...file, accepted: file.accepted ?? true })), selectedFiles),
    [bundle.files, files, selectedFiles],
  );
  const nextSummary = useMemo(() => ({
    total: summary?.total ?? bundle.files.length,
    accepted: selectionStatus.accepted,
    added: summary?.added ?? bundle.fileSummary.added,
    deleted: summary?.deleted ?? bundle.fileSummary.deleted,
    modified: summary?.modified ?? bundle.fileSummary.modified,
  }), [bundle.fileSummary.added, bundle.fileSummary.deleted, bundle.fileSummary.modified, bundle.files.length, selectionStatus.accepted, summary]);

  return (
    <Modal
      title="确认代码变更"
      open
      onCancel={onReject}
      footer={(
        <>
          <Button onClick={onReject}>拒绝</Button>
          <Button type="primary" onClick={() => onConfirm(selectedFiles)} disabled={nextSummary.accepted === 0}>确认执行</Button>
        </>
      )}
      width="min(1120px, calc(100vw - 32px))"
      styles={{ body: { paddingTop: 12 } }}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {/* 工具标签行 */}
        <Space wrap size={[8, 8]}>
          <Tag color="blue">{toolName}</Tag>
          <Tag style={{ maxWidth: 620, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <Typography.Text code style={{ margin: 0 }}>{bundle.files.length > 1 ? `${bundle.files.length} files` : activeFile.filePath}</Typography.Text>
          </Tag>
          <Tag color="green">+{bundle.totalAdditions}</Tag>
          <Tag color="red">-{bundle.totalDeletions}</Tag>
        </Space>

        {/* 三态汇总进度条：待处理 / 已接受 / 已拒绝 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: '#f0f0f0' }}>
            {selectionStatus.accepted > 0 && (
              <div style={{ flex: selectionStatus.accepted, background: '#52c41a', transition: 'flex 0.3s' }} />
            )}
            {selectionStatus.rejected > 0 && (
              <div style={{ flex: selectionStatus.rejected, background: '#ff4d4f', transition: 'flex 0.3s' }} />
            )}
            {selectionStatus.pending > 0 && (
              <div style={{ flex: selectionStatus.pending, background: '#1677ff', transition: 'flex 0.3s' }} />
            )}
          </div>
          <Space size={12}>
            <Tag color="blue">{`待处理 ${selectionStatus.pending}`}</Tag>
            <Tag color="green">{`已接受 ${selectionStatus.accepted}`}</Tag>
            <Tag color="red">{`已拒绝 ${selectionStatus.rejected}`}</Tag>
          </Space>
        </div>

        {/* 顶部独立文件清单摘要区（分组卡片） */}
        {bundle.files.length > 1 && (() => {
          const manifestGroups = buildFileManifestGroups(
            bundle.files.map((file) => ({
              filePath: file.filePath,
              changeType: file.changeType || 'modified',
              additions: file.additions,
              deletions: file.deletions,
            })),
          );
          return (
            <div style={{
              border: '1px solid #e8e8e8',
              borderRadius: 8,
              padding: '12px 16px',
              background: '#fafafa',
            }}>
              <Typography.Text strong style={{ marginBottom: 8, display: 'block' }}>变更文件清单</Typography.Text>
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                {manifestGroups.map((group) => (
                  <div key={group.changeType}>
                    <Tag color={group.color} style={{ marginBottom: 4 }}>
                      {`${group.label} ${group.files.length} 个文件`}
                    </Tag>
                    <div style={{ paddingLeft: 8 }}>
                      {group.files.map((file) => (
                        <div key={file.filePath} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                          <Typography.Text code style={{ fontSize: 12 }}>{file.filePath}</Typography.Text>
                          {file.additions !== undefined && file.deletions !== undefined && (
                            <Space size={4}>
                              <Tag color="green" style={{ fontSize: 11, lineHeight: '16px', padding: '0 4px', margin: 0 }}>+{file.additions}</Tag>
                              <Tag color="red" style={{ fontSize: 11, lineHeight: '16px', padding: '0 4px', margin: 0 }}>-{file.deletions}</Tag>
                            </Space>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </Space>
            </div>
          );
        })()}

        {bundle.isEmpty ? (
          <Alert
            type="warning"
            showIcon
            message="没有可预览的代码差异"
            description="该工具调用未返回 diff，确认前请检查工具参数和上下文。"
          />
        ) : (
          <>
            <Progress percent={bundle.totalAdditions + bundle.totalDeletions > 0 ? 100 : 0} showInfo={false} />
            {bundle.files.length > 1 ? (
              <Collapse
                defaultActiveKey={[bundle.files[0]?.filePath || '']}
                items={bundle.files.map((file) => ({
                  key: file.filePath,
                  label: (
                    <Space size={8}>
                      <Button
                        size="small"
                        type={selectedFiles[file.filePath] !== false ? 'primary' : 'default'}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedFiles((prev) => ({ ...prev, [file.filePath]: !(prev[file.filePath] ?? true) }));
                        }}
                      >
                        {selectedFiles[file.filePath] !== false ? '接受' : '拒绝'}
                      </Button>
                      <Tag color={file.changeType === 'added' ? 'green' : file.changeType === 'deleted' ? 'red' : 'blue'}>
                        {file.changeType === 'added' ? '新增' : file.changeType === 'deleted' ? '删除' : '修改'}
                      </Tag>
                      <Typography.Text code>{file.filePath}</Typography.Text>
                      <Tag color={selectedFiles[file.filePath] !== false ? 'green' : 'default'}>
                        {selectedFiles[file.filePath] !== false ? '已接受' : '已拒绝'}
                      </Tag>
                      <Tag color="green">+{file.additions}</Tag>
                      <Tag color="red">-{file.deletions}</Tag>
                    </Space>
                  ),
                  children: renderDiff(file.original, file.modified, file.language, file.raw),
                }))}
              />
            ) : (
              <Tabs
                items={[
                  {
                    key: 'visual',
                    label: '可视化差异',
                    children: renderDiff(activeFile.original, activeFile.modified, activeFile.language, activeFile.raw),
                  },
                  {
                    key: 'raw',
                    label: '原始 Diff',
                    children: <pre className="confirm-diff-plain">{bundle.raw}</pre>,
                  },
                ]}
              />
            )}
          </>
        )}
      </Space>
    </Modal>
  );
}

function renderDiff(original: string, modified: string, language: string, raw: string) {
  const formattedOriginal = formatDiffContentForDisplay(language, original);
  const formattedModified = formatDiffContentForDisplay(language, modified);

  return (
    <Tabs
      items={[
        {
          key: 'visual',
          label: '可视化差异',
          children: (
            <div className="diff-editor-container">
              <Suspense fallback={<div style={{ padding: 16 }}>加载差异编辑器...</div>}>
                <DiffEditor original={original} modified={modified} language={language} />
              </Suspense>
            </div>
          ),
        },
        {
          key: 'formatted',
          label: '格式化对比',
          children: (
            <div className="diff-editor-container">
              <Suspense fallback={<div style={{ padding: 16 }}>加载差异编辑器...</div>}>
                <DiffEditor original={formattedOriginal} modified={formattedModified} language={language} />
              </Suspense>
            </div>
          ),
        },
        {
          key: 'raw',
          label: '原始 Diff',
          children: <pre className="confirm-diff-plain">{raw}</pre>,
        },
      ]}
    />
  );
}
