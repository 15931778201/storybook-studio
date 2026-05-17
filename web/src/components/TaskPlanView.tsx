import React from 'react';
import { Steps, Tag, Progress } from 'antd';
import {
  CheckCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { PlanStep } from '../types/messages';

interface Props {
  goal: string;
  steps: PlanStep[];
  replanReason?: string;
}

export default function TaskPlanView({ goal, steps, replanReason }: Props) {
  const completed = steps.filter(s => s.status === 'done').length;
  const total = steps.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div style={{ margin: '16px 0', padding: '16px', background: '#f0f5ff', borderRadius: 8 }}>
      <h4 style={{ marginBottom: 12 }}>
        {replanReason ? '🔄 重新规划：' : '🎯 任务计划：'}
        {goal}
      </h4>
      {replanReason && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fff7e6', borderRadius: 4, fontSize: 13 }}>
          ⚠️ {replanReason}
        </div>
      )}
      <Progress percent={percent} size="small" style={{ marginBottom: 16 }} />
      <Steps
        direction="vertical"
        size="small"
        current={steps.findIndex(s => s.status === 'running')}
        items={steps.map((step) => ({
          title: (
            <span>
              {step.description}
              {step.duration != null && step.status === 'done' && (
                <span style={{ marginLeft: 8, fontSize: 12, color: '#999' }}>
                  ({step.duration}ms)
                </span>
              )}
            </span>
          ),
          description: (
            <div>
              <Tag color="blue">{step.tool}</Tag>
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