import { Collapse, Space, Tag, Tabs, Typography } from 'antd';
import DiffEditor from './DiffEditor';
import { buildSummarySections } from '../utils/summary-presentation';
import { formatDiffContentForDisplay, shouldRenderSummaryNarrative } from '../utils/confirm-presentation';

export default function SummaryMessageCard({ summary }: { summary: any }) {
  const sections = buildSummarySections(summary);

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space wrap size={[8, 8]}>
        <Tag color="blue">{`文件 ${summary.appliedFiles?.length || 0}`}</Tag>
        <Tag color={summary.verification?.passed ? 'green' : 'red'}>
          {summary.verification?.passed ? '测试通过' : '测试失败'}
        </Tag>
        {summary.repair?.attempted ? (
          <Tag color={summary.repair.success ? 'gold' : 'volcano'}>
            {summary.repair.success ? '已自动修复' : '自动修复未通过'}
          </Tag>
        ) : null}
      </Space>

      <Collapse
        defaultActiveKey={sections.map((section) => section.key)}
        items={sections.map((section) => ({
          key: section.key,
          label: (
            <Space size={8}>
              <Typography.Text strong>{section.title}</Typography.Text>
              {section.status ? (
                <Tag color={section.status === 'passed' ? 'green' : 'red'}>
                  {section.status === 'passed' ? '通过' : '失败'}
                </Tag>
              ) : null}
            </Space>
          ),
          children: renderSection(section),
        }))}
      />
    </Space>
  );
}

function renderSection(section: ReturnType<typeof buildSummarySections>[number]) {
  if (section.key === 'failure') {
    return <pre className="confirm-diff-plain">{section.details || '写入失败'}</pre>;
  }

  if (section.key === 'verification') {
    return (
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Space wrap size={[8, 8]}>
          {(section.commands || []).map((command) => (
            <Tag key={command}>
              <Typography.Text code>{command}</Typography.Text>
            </Tag>
          ))}
        </Space>
        <pre className="confirm-diff-plain">{section.output || '未执行测试'}</pre>
      </Space>
    );
  }

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      {(section.changes || []).map((change, index) => {
        const bundle = change.bundle;
        return (
          <Space key={`${section.key}-${index}`} direction="vertical" size={8} style={{ width: '100%' }}>
            <Space wrap size={[8, 8]}>
              <Tag>{change.toolName}</Tag>
              <Tag color="green">{`新增 ${bundle.fileSummary.added}`}</Tag>
              <Tag color="red">{`删除 ${bundle.fileSummary.deleted}`}</Tag>
              <Tag color="blue">{`修改 ${bundle.fileSummary.modified}`}</Tag>
            </Space>
            {bundle.isEmpty
              ? <pre className="confirm-diff-plain">{change.diff || '无 diff'}</pre>
              : (
                <Collapse
                  defaultActiveKey={[bundle.files[0]?.filePath || '']}
                  items={bundle.files.map((file) => ({
                    key: file.filePath,
                    label: (
                      <Space size={8}>
                        <Tag color={file.changeType === 'added' ? 'green' : file.changeType === 'deleted' ? 'red' : 'blue'}>
                          {file.changeType === 'added' ? '新增' : file.changeType === 'deleted' ? '删除' : '修改'}
                        </Tag>
                        <Typography.Text code>{file.filePath}</Typography.Text>
                        <Tag color="green">+{file.additions}</Tag>
                        <Tag color="red">-{file.deletions}</Tag>
                      </Space>
                    ),
                    children: (
                      <Tabs
                        items={[
                          {
                            key: 'visual',
                            label: '可视化差异',
                            children: (
                              <div className="diff-editor-container">
                                <DiffEditor original={file.original} modified={file.modified} language={file.language} />
                              </div>
                            ),
                          },
                          {
                            key: 'formatted',
                            label: '格式化对比',
                            children: (
                              <div className="diff-editor-container">
                                <DiffEditor
                                  original={formatDiffContentForDisplay(file.language, file.original)}
                                  modified={formatDiffContentForDisplay(file.language, file.modified)}
                                  language={file.language}
                                />
                              </div>
                            ),
                          },
                          {
                            key: 'raw',
                            label: '原始 Diff',
                            children: <pre className="confirm-diff-plain">{file.raw}</pre>,
                          },
                        ]}
                      />
                    ),
                  }))}
                />
              )}
          </Space>
        );
      })}
    </Space>
  );
}

export { shouldRenderSummaryNarrative };
