import React from 'react';
import { Steps, Tag, Typography } from 'antd';
import {
  CheckCircleOutlined,
  SyncOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';

export interface PipelineStep {
  id: string;
  type: 'thought' | 'action' | 'observation' | 'final';
  content: string;
  status?: 'pending' | 'running' | 'success' | 'error';
  toolName?: string;
}

interface Props {
  steps: PipelineStep[];
}

export default function StepPipelineView({ steps }: Props) {
  const items = steps.map((step, idx) => ({
    title: getStepTitle(step),
    description: (
      <div>
        <Typography.Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, fontSize: 13 }}>
          {step.content}
        </Typography.Paragraph>
        {step.toolName && <Tag color="blue">{step.toolName}</Tag>}
      </div>
    ),
    status: step.status === 'error' ? 'error' as const :
            step.status === 'success' ? 'finish' as const :
            (step.status === 'running' ? 'process' as const : 'wait' as const),
    icon: stepIcon(step.type, step.status),
  }));

  return (
    <div style={{ padding: '12px 16px', background: '#f9f9f9', borderRadius: 8, margin: '8px 0' }}>
      <Steps
        direction="vertical"
        size="small"
        current={steps.length - 1}
        items={items}
      />
    </div>
  );
}

function getStepTitle(step: PipelineStep): string {
  switch (step.type) {
    case 'thought': return '💭 思考';
    case 'action': return '⚡ 行动';
    case 'observation': return '👀 观察';
    case 'final': return '🎯 最终答案';
    default: return step.type;
  }
}

function stepIcon(type: PipelineStep['type'], status?: PipelineStep['status']) {
  if (status === 'running') return <SyncOutlined spin />;
  if (status === 'error') return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
  if (status === 'success') return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
  if (type === 'thought') return <QuestionCircleOutlined />;
  if (type === 'final') return <CheckCircleOutlined style={{ color: '#1890ff' }} />;
  return undefined;
}