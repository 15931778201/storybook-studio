import { ThoughtChain } from '@ant-design/x';
import { Tag, Typography } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, CodeOutlined, SearchOutlined, FileTextOutlined } from '@ant-design/icons';
import type { ThinkingStep } from '../types/messages';

const toolIcons: Record<string, React.ReactNode> = {
  read_file: <FileTextOutlined />, write_file: <CodeOutlined />, grep: <SearchOutlined />, bash: <CodeOutlined />, glob: <SearchOutlined />,
};
const statusIcons: Record<string, React.ReactNode> = {
  running: <SyncOutlined spin />,
  done: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  error: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
  denied: <CloseCircleOutlined style={{ color: '#faad14' }} />,
};

export default function ThinkingPanel({ steps }: { steps: ThinkingStep[] }) {
  if (!steps || steps.length === 0) return null;

  const items = steps.map((step, index) => ({
    key: step.id,
    icon: statusIcons[step.status] || toolIcons[step.toolName] || <CodeOutlined />,
    title: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {toolIcons[step.toolName] || <CodeOutlined />}
        <Typography.Text strong>{step.toolName}</Typography.Text>
        <Tag color={step.status === 'error' ? 'red' : step.status === 'running' ? 'processing' : 'default'}>
          {step.status === 'running' ? '执行中' : step.status === 'done' ? '完成' : step.status === 'denied' ? '已拒绝' : '失败'}
        </Tag>
      </span>
    ),
    description: step.args ? `参数: ${step.args.slice(0, 120)}` : undefined,
    content: step.result ? (
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}>
        {step.result.slice(0, 800)}
      </pre>
    ) : undefined,
    collapsible: Boolean(step.result || step.args),
    blink: step.status === 'running',
  }));

  return (
    <div style={{ padding: '4px 0' }}>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        执行过程（{steps.length} 步）
      </Typography.Text>
      <ThoughtChain
        items={items}
        line="dashed"
        defaultExpandedKeys={items.length <= 2 ? items.map(item => item.key) : [items[items.length - 1].key]}
      />
    </div>
  );
}
