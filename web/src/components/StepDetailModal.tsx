import { Modal, Tag, Typography } from 'antd';
import { CodeOutlined, SearchOutlined, FileTextOutlined } from '@ant-design/icons';
import type { ThinkingStep } from '../types/messages';

const toolIcons: Record<string, React.ReactNode> = {
  read_file: <FileTextOutlined />, write_file: <CodeOutlined />, grep: <SearchOutlined />, bash: <CodeOutlined />, glob: <SearchOutlined />,
};

const statusLabels: Record<string, string> = {
  running: '执行中', done: '完成', error: '失败', denied: '已拒绝', pending: '等待',
};

const statusColors: Record<string, string> = {
  running: 'processing', done: 'success', error: 'error', denied: 'warning', pending: 'default',
};

interface Props {
  step: ThinkingStep | null;
  onClose: () => void;
}

const preStyle: React.CSSProperties = {
  background: 'var(--background-secondary, #f5f5f5)',
  padding: 12,
  borderRadius: 6,
  fontSize: 12,
  maxHeight: 300,
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  margin: 0,
};

export default function StepDetailModal({ step, onClose }: Props) {
  if (!step) return null;

  return (
    <Modal
      title={
        <span>
          {toolIcons[step.toolName] || <CodeOutlined />}
          {' '}{step.toolName}
        </span>
      }
      open={!!step}
      onCancel={onClose}
      footer={null}
      width={800}
      style={{ maxWidth: '90vw' }}
    >
      <div style={{ marginBottom: 16 }}>
        <Tag color={statusColors[step.status] || 'default'}>
          {statusLabels[step.status] || step.status}
        </Tag>
      </div>

      {step.args ? (
        <div style={{ marginBottom: 16 }}>
          <Typography.Title level={5}>参数</Typography.Title>
          <pre style={preStyle}>
            {step.args}
          </pre>
        </div>
      ) : null}

      {step.result ? (
        <div>
          <Typography.Title level={5}>结果</Typography.Title>
          <pre style={{ ...preStyle, maxHeight: 400 }}>
            {step.result}
          </pre>
        </div>
      ) : null}
    </Modal>
  );
}
