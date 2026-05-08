import { useState } from 'react';
import { Collapse, Tag, Typography } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, CodeOutlined, SearchOutlined, FileTextOutlined } from '@ant-design/icons';
import type { ThinkingStep } from '../types/messages';

const toolIcons: Record<string, React.ReactNode> = {
  read_file: <FileTextOutlined />, write_file: <CodeOutlined />, grep: <SearchOutlined />, bash: <CodeOutlined />, glob: <SearchOutlined />,
};
const statusIcons: Record<string, React.ReactNode> = {
  running: <SyncOutlined spin />, done: <CheckCircleOutlined style={{ color: '#52c41a' }} />, error: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
};

export default function ThinkingPanel({ steps }: { steps: ThinkingStep[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!steps || steps.length === 0) return null;
  return (
    <Collapse activeKey={expanded ? ['thinking'] : []} onChange={() => setExpanded(!expanded)} style={{ marginTop: 8, background: '#fffbe6', border: '1px solid #ffe58f' }} items={[{
      key: 'thinking',
      label: <span>🧠 思考中（{steps.length} 步）</span>,
      children: steps.map(step => (
        <div key={step.id} style={{ marginBottom: 8, fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {statusIcons[step.status]}{toolIcons[step.toolName] || <CodeOutlined />}
            <Typography.Text strong>{step.toolName}</Typography.Text>
            <Tag>{step.args?.slice(0, 60)}</Tag>
          </div>
          {step.result && <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, marginTop: 4, fontSize: 12, maxHeight: 100, overflow: 'auto' }}>{step.result.slice(0, 500)}</pre>}
        </div>
      ))
    }]} />
  );
}
