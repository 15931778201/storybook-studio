import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bubble, Sender } from '@ant-design/x';
import { XMarkdown } from '@ant-design/x-markdown';
import { Alert, Button, Tooltip, message, Space, Modal } from 'antd';
import { CopyOutlined, RedoOutlined, EditOutlined, ExportOutlined } from '@ant-design/icons';
import { useChatContext } from '../providers/ChatProvider';
import type { ChatMessage } from '../types/messages';
import TaskPlanView from './TaskPlanView';
import DecisionTreeView from './DecisionTree';
import StepPipelineView from './StepPipelineView';
import DiffEditor from './DiffEditor';
import CodeBlock from './CodeBlock';
import EmptyState from './EmptyState';
import ImageUpload from './ImageUpload';
import CollapsibleThinkingPanel from './CollapsibleThinkingPanel';
import SummaryMessageCard from './SummaryMessageCard';
import { shouldRenderSummaryNarrative } from './SummaryMessageCard';
import { getBubbleRole, getMessagePlacement, shouldRenderMessage } from '../utils/chat-presentation';
import { getAutoScrollState } from '../utils/chat-scroll';
import type { UploadedImageAttachment } from '../utils/chat-upload';
import { buildMessageWindow } from '../utils/chat-message-window';
import { buildRunStatusBanner } from '../utils/chat-run-status-banner';

export default function ChatLayout() {
  const { messages, sendMessage, isRequesting, abort, runState, resumeLastRun, dismissPausedRun } = useChatContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const [inputVal, setInputVal] = useState('');
  const [imageAttachment, setImageAttachment] = useState<UploadedImageAttachment | null>(null);
  const [showNewOutput, setShowNewOutput] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user');

  const handleSubmit = useCallback(
    (text: string) => {
      sendMessage(text, imageAttachment);
      setInputVal('');
      setImageAttachment(null);
    },
    [sendMessage, imageAttachment]
  );

  const handleCancel = useCallback(() => {
    Modal.confirm({
      title: '停止生成',
      content: '正在生成中，是否停止？停止后可重新输入发送。',
      okText: '停止',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        abort();
      },
    });
  }, [abort]);

  const banner = buildRunStatusBanner(runState, messages);
  const windowedMessages = buildMessageWindow(
    messages.filter(shouldRenderMessage),
    { recentCount: 20, historyExpanded },
  );

  const scrollToBottom = useCallback(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    shouldStickToBottomRef.current = true;
    setShowNewOutput(false);
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const state = getAutoScrollState({
      scrollTop: scrollRef.current.scrollTop,
      clientHeight: scrollRef.current.clientHeight,
      scrollHeight: scrollRef.current.scrollHeight,
    });
    shouldStickToBottomRef.current = state.shouldAutoScroll;
    if (state.shouldAutoScroll) setShowNewOutput(false);
  }, []);

  useEffect(() => {
    if (shouldStickToBottomRef.current) {
      scrollToBottom();
    } else if (messages.length > 0) {
      setShowNewOutput(true);
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    (document.querySelector('.ant-sender-input') as HTMLElement)?.focus();
  }, []);

  function renderMessageContent(msg: ChatMessage) {
    const steps = msg.steps || [];

    switch (msg.contentType) {
      case 'plan':
        return (
          <TaskPlanView
            goal={msg.metadata?.goal || ''}
            steps={msg.metadata?.steps || []}
            replanReason={msg.metadata?.replanReason}
            currentExecution={msg.metadata?.currentExecution}
          />
        );

      case 'decision':
        return (
          <DecisionTreeView
            nodes={msg.metadata?.nodes || msg.metadata?.options || []}
          />
        );

      case 'pipeline':
        return (
          <StepPipelineView
            steps={msg.metadata?.steps || []}
          />
        );

      case 'diff':
        return (
          <DiffEditor
            original={msg.metadata?.original || ''}
            modified={msg.metadata?.modified || ''}
          />
        );

      case 'summary':
        return (
          <div style={{ overflow: 'auto' }}>
            <SummaryMessageCard summary={msg.metadata?.summary || msg.metadata || { appliedFiles: [], verification: { commands: [], passed: true, output: '' } }} />
            {shouldRenderSummaryNarrative(msg.content) ? (
              <div style={{ marginTop: 12 }}>
                <XMarkdown
                  content={String(msg.content)}
                  components={{
                    code({ inline, className, children }: any) {
                      if (!inline && className) {
                        return (
                          <CodeBlock language={className.replace('language-', '')}>
                            {String(children).replace(/\n$/, '')}
                          </CodeBlock>
                        );
                      }
                      return <code className={className}>{children}</code>;
                    },
                  }}
                />
              </div>
            ) : null}
            {steps.length > 0 && (
              <CollapsibleThinkingPanel steps={steps} isRequesting={isRequesting} />
            )}
          </div>
        );

      default:
        return (
          <div style={{ overflow: 'auto' }}>
            <XMarkdown
              content={String(msg.content)}
              components={{
                code({ inline, className, children }: any) {
                  if (!inline && className) {
                    return (
                      <CodeBlock language={className.replace('language-', '')}>
                        {String(children).replace(/\n$/, '')}
                      </CodeBlock>
                    );
                  }
                  return <code className={className}>{children}</code>;
                },
              }}
            />
            {steps.length > 0 && (
              <CollapsibleThinkingPanel steps={steps} isRequesting={isRequesting} />
            )}
          </div>
        );
    }
  }

  const items = windowedMessages.visibleMessages
    .map(msg => ({
      key: msg.id,
      role: getBubbleRole(msg.role),
      placement: getMessagePlacement(msg.role),
      content: renderMessageContent(msg),
      avatar: msg.role === 'user' ? '👤' : msg.role === 'system' ? '⚠️' : '🤖',
      footer: (
        <Space size="small">
          {msg.role === 'user' ? (
            <>
              <Tooltip title="编辑">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => setInputVal(msg.content)}
                />
              </Tooltip>
              <Tooltip title="重发">
                <Button
                  type="text"
                  size="small"
                  icon={<RedoOutlined />}
                  onClick={() => sendMessage(msg.content)}
                />
              </Tooltip>
            </>
          ) : msg.content ? (
            <>
              <Tooltip title="复制">
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={async () => {
                    await navigator.clipboard.writeText(msg.content);
                    message.success('已复制');
                  }}
                />
              </Tooltip>
              <Tooltip title="导出">
                <Button
                  type="text"
                  size="small"
                  icon={<ExportOutlined />}
                  onClick={() => {
                    const blob = new Blob([msg.content], { type: 'text/markdown' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = 'agent-answer.md';
                    a.click();
                  }}
                />
              </Tooltip>
            </>
          ) : null}
        </Space>
      ),
    }));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {banner && (
        <Alert
          type="warning"
          showIcon
          message={banner.message}
          description={banner.description}
          action={(
            <Space size="small">
              <Button size="small" type="primary" onClick={resumeLastRun}>
                恢复
              </Button>
              <Button size="small" onClick={() => latestUserMessage && sendMessage(latestUserMessage.content)}>
                重发
              </Button>
              <Button size="small" onClick={() => {
                setHistoryExpanded(false);
                dismissPausedRun();
                shouldStickToBottomRef.current = true;
                setShowNewOutput(false);
              }}>
                放弃
              </Button>
            </Space>
          )}
          style={{ margin: '12px 24px 0' }}
        />
      )}
      <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        {messages.length === 0 && !isRequesting && <EmptyState />}
        {!historyExpanded && windowedMessages.hiddenCount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <Button size="small" onClick={() => setHistoryExpanded(true)}>
              展开历史消息 {windowedMessages.hiddenCount} 条
            </Button>
          </div>
        )}
        <Bubble.List items={items} style={{ maxWidth: 1000, margin: '0 auto' }} />
        {showNewOutput && (
          <Button
            type="primary"
            size="small"
            onClick={scrollToBottom}
            style={{
              position: 'sticky',
              bottom: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 2,
              display: 'block',
              margin: '0 auto',
            }}
          >
            查看新输出
          </Button>
        )}
      </div>
      <div style={{ 
          padding: '0 24px',
          borderTop: '1px solid var(--border-color)'
       }}>
        <ImageUpload
          onImageReady={setImageAttachment}
          onClear={() => setImageAttachment(null)}
          disabled={isRequesting}
        />
      </div>
      <div
        style={{
          padding: '12px 24px',
          margin: '0 auto',
          width: '100%',
          display: 'flex',
          gap: 8,
        }}
      >
        <div style={{ flex: 1 }}>
          <Sender
            value={inputVal}
            onChange={setInputVal}
            loading={isRequesting}
            placeholder="输入任务… (Enter 发送)"
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </div>
  );
}
