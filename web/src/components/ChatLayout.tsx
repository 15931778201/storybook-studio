import React, { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Bubble, Sender } from '@ant-design/x';
import { XMarkdown } from '@ant-design/x-markdown';
import rehypeHighlight from 'rehype-highlight';
import { Button, Tooltip, message, Space } from 'antd';
import { CopyOutlined, RedoOutlined, StopOutlined, EditOutlined, ExportOutlined } from '@ant-design/icons';
import { useChatContext } from '../providers/ChatProvider';
import type { ChatMessage } from '../types/messages';
import TaskPlanView from './TaskPlanView';
import DecisionTreeView from './DecisionTree';
import StepPipelineView from './StepPipelineView';
import DiffEditor from './DiffEditor';
import CodeBlock from './CodeBlock';
import EmptyState from './EmptyState';
import ImageUpload from './ImageUpload';

const ConfirmDialog = lazy(() => import('./ConfirmDialog'));

export default function ChatLayout() {
  const { messages, sendMessage, isRequesting, abort } = useChatContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputVal, setInputVal] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (text: string) => {
      sendMessage(text, imageBase64);
      setInputVal('');
      setImageBase64(null);
    },
    [sendMessage, imageBase64]
  );

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    (document.querySelector('.ant-sender-input') as HTMLElement)?.focus();
  }, []);

  // 🔥 根据 contentType 选择渲染组件
  function renderMessageContent(msg: ChatMessage) {
    switch (msg.contentType) {
      case 'plan':
        return <TaskPlanView goal={msg.metadata?.goal || ''} steps={msg.metadata?.steps || []} />;

      case 'decision':
        return (
          <DecisionTreeView
            question={msg.content}
            options={msg.metadata?.options || []}
            chosen={msg.metadata?.chosen}
          />
        );

      case 'pipeline':
        return (
          <StepPipelineView
            steps={msg.metadata?.steps || []}
            currentStep={msg.metadata?.currentStep || 0}
          />
        );

      case 'diff':
        return (
          <DiffEditor
            original={msg.metadata?.original || ''}
            modified={msg.metadata?.modified || ''}
            filePath={msg.metadata?.filePath || ''}
          />
        );

      default:
        return (
          <XMarkdown
            content={String(msg.content)}
            rehypePlugins={[rehypeHighlight]}
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
        );
    }
  }

  const items = messages
    .filter(msg => msg.role !== 'thinking')
    .map(msg => ({
      key: msg.id,
      role: msg.role,
      placement: (msg.role === 'user' ? 'end' : 'start') as 'end' | 'start',
      content: renderMessageContent(msg),
      avatar: msg.role === 'user' ? '👤' : '🤖',
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
          ) : (
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
          )}
        </Space>
      ),
    }));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        {messages.length === 0 && !isRequesting && <EmptyState />}
        <Bubble.List items={items} style={{ maxWidth: 800, margin: '0 auto' }} />
      </div>
      <div style={{ 
          padding: '0 24px',
          borderTop: '1px solid var(--border-color)'
       }}>
        <ImageUpload
          onImageReady={setImageBase64}
          onClear={() => setImageBase64(null)}
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
          />
        </div>
        {isRequesting && (
          <Tooltip title="停止生成">
            <Button danger icon={<StopOutlined />} onClick={abort} size="large" />
          </Tooltip>
        )}
      </div>
    </div>
  );
}