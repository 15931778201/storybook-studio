import React from 'react';
import { Steps, Tag, Progress } from 'antd';
import {
  CheckCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';

export interface PlanStep {
  description: string;
  tools: string[];
  expectedOutput: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

interface Props {
  goal: string;
  steps: PlanStep[];
}

export default function TaskPlanView({ goal, steps }: Props) {
  const completed = steps.filter(s => s.status === 'done').length;
  const total = steps.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div style={{ margin: '16px 0', padding: '16px', background: '#f0f5ff', borderRadius: 8 }}>
      <h4 style={{ marginBottom: 12 }}>🎯 任务计划：{goal}</h4>
      <Progress percent={percent} size="small" style={{ marginBottom: 16 }} />
      <Steps
        direction="vertical"
        size="small"
        current={steps.findIndex(s => s.status === 'running')}
        items={steps.map((step, idx) => ({
          title: step.description,
          description: (
            <div>
              <div style={{ marginBottom: 4 }}>
                {step.tools.map(t => <Tag key={t} color="blue">{t}</Tag>)}
              </div>
              <small>{step.expectedOutput}</small>
            </div>
          ),
          icon: statusIcon(step.status),
          status: step.status === 'error' ? 'error' : (step.status === 'done' ? 'finish' : undefined),
        }))}
      />
    </div>
  );
}

function statusIcon(status: PlanStep['status']) {
  switch (status) {
    case 'done': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    case 'running': return <SyncOutlined spin style={{ color: '#1890ff' }} />;
    case 'error': return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    default: return <ClockCircleOutlined />;
  }
}