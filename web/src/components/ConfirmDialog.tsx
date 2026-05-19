import { lazy, Suspense, useMemo, useState } from 'react';
import { Alert, Button, Collapse, Modal, Progress, Space, Tabs, Tag, Typography } from 'antd';
import { parseDiffBundle, parseUnifiedDiff } from '../utils/diff-presentation';
import { buildSelectionStatus, formatDiffContentForDisplay } from '../utils/confirm-presentation';

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
        <Space wrap size={[8, 8]}>
          <Tag color="blue">{toolName}</Tag>
          <Tag style={{ maxWidth: 620, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <Typography.Text code style={{ margin: 0 }}>{bundle.files.length > 1 ? `${bundle.files.length} files` : activeFile.filePath}</Typography.Text>
          </Tag>
          <Tag color="cyan">{`新增 ${selectionStatus.acceptedGroups.added.length}/${selectionStatus.rejectedGroups.added.length}`}</Tag>
          <Tag color="volcano">{`删除 ${selectionStatus.acceptedGroups.deleted.length}/${selectionStatus.rejectedGroups.deleted.length}`}</Tag>
          <Tag color="gold">{`修改 ${selectionStatus.acceptedGroups.modified.length}/${selectionStatus.rejectedGroups.modified.length}`}</Tag>
          <Tag color="green">+{bundle.totalAdditions}</Tag>
          <Tag color="red">-{bundle.totalDeletions}</Tag>
          <Tag color={nextSummary.accepted === nextSummary.total ? 'blue' : 'gold'}>{`已选 ${nextSummary.accepted}/${nextSummary.total}`}</Tag>
        </Space>

        {bundle.files.length > 1 ? (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Typography.Text strong>文件清单</Typography.Text>
            <Space wrap size={[8, 8]}>
              {bundle.files.map((file) => (
                <Tag
                  key={file.filePath}
                  color={file.changeType === 'added' ? 'green' : file.changeType === 'deleted' ? 'red' : 'blue'}
                >
                  {`${file.changeType === 'added' ? '新增' : file.changeType === 'deleted' ? '删除' : '修改'} ${file.filePath}`}
                </Tag>
              ))}
            </Space>
          </Space>
        ) : null}

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
