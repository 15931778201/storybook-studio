import { Tag, Typography } from 'antd';
import { CodeOutlined, SearchOutlined, FileTextOutlined } from '@ant-design/icons';
import { useRef, useState, useEffect, useCallback } from 'react';
import StepDetailModal from './StepDetailModal';
import type { ThinkingStep } from '../types/messages';

const toolIcons: Record<string, React.ReactNode> = {
  read_file: <FileTextOutlined />, write_file: <CodeOutlined />, grep: <SearchOutlined />, bash: <CodeOutlined />, glob: <SearchOutlined />,
};

const statusLabels: Record<string, string> = {
  running: '执行中', done: '完成', error: '失败', denied: '已拒绝', pending: '等待',
};

interface Props {
  steps: ThinkingStep[];
  isRequesting?: boolean;
}

export default function CollapsibleThinkingPanel({ steps, isRequesting }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [detailStep, setDetailStep] = useState<ThinkingStep | null>(null);
  const userToggled = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  const hasRunning = steps.some(s => s.status === 'running');

  useEffect(() => {
    if (hasRunning && !userToggled.current) {
      setExpanded(true);
    }
  }, [hasRunning]);

  useEffect(() => {
    if (expanded && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [steps.length, expanded]);

  const toggle = useCallback(() => {
    userToggled.current = true;
    setExpanded(prev => !prev);
  }, []);

  if (!steps || steps.length === 0) return null;

  const doneCount = steps.filter(s => s.status === 'done' || s.status === 'error' || s.status === 'denied').length;
  const runningSteps = steps.filter(s => s.status === 'running').length;

  const summary = hasRunning
    ? `🛠 正在执行 (${doneCount + runningSteps}/${steps.length})`
    : `🛠 执行了 ${steps.length} 步工具调用`;

  const runningStepIndices = steps
    .map((s, i) => s.status === 'running' ? i : -1)
    .filter(i => i !== -1);

  return (
    <div className="collapsible-thinking">
      <div className="thinking-header" onClick={toggle}>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {summary}
        </Typography.Text>
        <span className="thinking-toggle">{expanded ? '▾' : '▸'}</span>
      </div>

      <div
        ref={listRef}
        className={`thinking-steps${expanded ? ' expanded' : ''}`}
      >
        {steps.map((step, index) => {
          const isRunning = step.status === 'running';
          return (
            <div
              key={step.id}
              className={`thinking-step-item${isRunning ? ' running' : ''}`}
              onClick={() => setDetailStep(step)}
            >
              <div className="step-header">
                {toolIcons[step.toolName] || <CodeOutlined />}
                <Typography.Text strong style={{ fontSize: 13 }}>{step.toolName}</Typography.Text>
                <Tag
                  color={step.status === 'error' ? 'red' : isRunning ? 'processing' : 'default'}
                  style={{ fontSize: 11, lineHeight: '18px', padding: '0 6px' }}
                >
                  {statusLabels[step.status] || step.status}
                </Tag>
                {runningStepIndices.length > 1 && (
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    {index + 1}/{steps.length}
                  </Typography.Text>
                )}
              </div>
              {step.args ? (
                <div className="step-args">
                  参数: {step.args.length > 120 ? step.args.slice(0, 120) + '…' : step.args}
                </div>
              ) : null}
              {step.result && (step.status === 'done' || step.status === 'error') ? (
                <div className="step-result">
                  {step.result.length > 800 ? step.result.slice(0, 800) + '…' : step.result}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <StepDetailModal step={detailStep} onClose={() => setDetailStep(null)} />
    </div>
  );
}
