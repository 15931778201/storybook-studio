import React from 'react';
import { Steps, Tag, Progress, Button, Space } from 'antd';
import {
  CheckCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  PauseOutlined,
  StepForwardOutlined,
  RedoOutlined,
  CaretRightOutlined,
} from '@ant-design/icons';
import type { CurrentExecutionState, PlanStep } from '../types/messages';
import { useChatContext } from '../providers/ChatProvider';

interface Props {
  goal: string;
  steps: PlanStep[];
  replanReason?: string;
  currentExecution?: CurrentExecutionState;
}

export default function TaskPlanView({ goal, steps, replanReason, currentExecution }: Props) {
  const { sendPlanControl } = useChatContext();
  const completed = steps.filter(s => s.status === 'done').length;
  const total = steps.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const runningStep = steps.find((step) => step.status === 'running');

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
      <Space size={8} style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <Button size="small" icon={<PauseOutlined />} onClick={() => sendPlanControl('pause', runningStep?.stepId, { scope: 'step' })}>
          暂停步骤
        </Button>
        <Button size="small" icon={<CaretRightOutlined />} onClick={() => sendPlanControl('resume', runningStep?.stepId, { scope: 'step' })}>
          继续
        </Button>
        <Button
          size="small"
          icon={<PauseOutlined />}
          disabled={!currentExecution?.toolName}
          onClick={() => sendPlanControl('pause', currentExecution?.stepId, { scope: 'tool', toolName: currentExecution?.toolName })}
        >
          暂停工具
        </Button>
        <Button
          size="small"
          icon={<PauseOutlined />}
          disabled={currentExecution?.phase !== 'verification'}
          onClick={() => sendPlanControl('pause', currentExecution?.stepId, { scope: 'verification' })}
        >
          暂停验证
        </Button>
        <Button size="small" icon={<StepForwardOutlined />} onClick={() => sendPlanControl('skip', runningStep?.stepId)}>
          跳过
        </Button>
        <Button size="small" icon={<RedoOutlined />} onClick={() => sendPlanControl('retry', runningStep?.stepId)}>
          重试
        </Button>
      </Space>
      {currentExecution ? (
        <div style={{ marginBottom: 12, fontSize: 12, color: '#595959' }}>
          当前执行：{currentExecution.phase || 'idle'}
          {currentExecution.toolName ? ` / ${currentExecution.toolName}` : ''}
          {currentExecution.summary ? ` / ${currentExecution.summary}` : ''}
        </div>
      ) : null}
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
