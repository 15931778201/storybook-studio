import DOMPurify from 'dompurify';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bubble, Sender } from '@ant-design/x';
import { XMarkdown } from '@ant-design/x-markdown';
import rehypeHighlight from 'rehype-highlight';

import { Button, Space, Tooltip, message } from 'antd';
import {
  CopyOutlined,
  RedoOutlined,
  StopOutlined,
  EditOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import { useChatContext } from '../providers/ChatProvider';
import ThinkingPanel from './ThinkingPanel';
import CodeBlock from './CodeBlock';
import EmptyState from './EmptyState';
import StepPipelineView from './StepPipelineView';
import ImageUpload from './ImageUpload';

export default function ChatLayout() {
  const {
    messages,
    sendMessage,
    isRequesting,
    abort,
    regenerateLastMessage,
    exportChat,
    pipelineSteps
  } = useChatContext();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [editingMessageText, setEditingMessageText] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  // 处理发送（支持编辑后发送）
  const handleSubmit = useCallback(
    (text: string) => {
      sendMessage(text, imageBase64);
      setInputValue('');
      setEditingMessageText(null);   // 清除编辑状态
      setImageBase64(null);            // 清空图片
    },
    [sendMessage, imageBase64]
  );

  // 处理编辑用户消息：将消息内容放入输入框
  const handleEditMessage = useCallback((text: string) => {
    setEditingMessageText(text);
    setInputValue(text);
    // 自动聚焦输入框
    setTimeout(() => {
      const input = document.querySelector('.ant-sender-input') as HTMLTextAreaElement;
      if (input) input.focus();
    }, 0);
  }, []);

  // 复制文本
  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success('已复制');
    } catch {
      message.error('复制失败');
    }
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // 初次加载自动聚焦输入框
  useEffect(() => {
    const input = document.querySelector('.ant-sender-input') as HTMLTextAreaElement;
    if (input) input.focus();
  }, []);
  // 构建消息列表
  const items = messages
    .filter(msg => msg.role !== 'thinking')
    .map((msg) => {
      const isUser = msg.role === 'user';
      return {
        key: msg.id,
        role: msg.role,
        placement: msg.role === 'user' ? 'end' : 'start',
        content: msg.content,
        avatar: isUser ? '👤' : '🤖',
        footer: (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 12, color: '#999' }}>
              {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''}
            </span>
            <Space size="small">
              {isUser ? (
                // 用户消息的操作：编辑、重发
                <>
                  <Tooltip title="编辑">
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleEditMessage(msg.content)}
                    />
                  </Tooltip>
                  <Tooltip title="重新发送">
                    <Button
                      type="text"
                      size="small"
                      icon={<RedoOutlined />}
                      onClick={() => sendMessage(msg.content)}
                    />
                  </Tooltip>
                </>
              ) : (
                // 助手消息的操作：复制、重新生成、导出
                <>
                  <Tooltip title="复制">
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => handleCopy(msg.content)}
                    />
                  </Tooltip>
                  <Tooltip title="重新生成">
                    <Button
                      type="text"
                      size="small"
                      icon={<RedoOutlined />}
                      onClick={regenerateLastMessage}
                    />
                  </Tooltip>
                  <Tooltip title="导出对话">
                    <Button
                      type="text"
                      size="small"
                      icon={<ExportOutlined />}
                      onClick={exportChat}
                    />
                  </Tooltip>
                </>
              )}
            </Space>
          </div>
        ),
        // 思考链面板（仅助手消息显示）
        children: msg.role === 'assistant' ? (
          <ThinkingPanel steps={messages.find(m => m.role === 'thinking')?.steps || []} />
        ) : undefined,
      };
    });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 消息区域 */}
      <div ref={scrollContainerRef} style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        {items.length === 0 && !isRequesting && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <EmptyState />
          </div>
        )}
        {pipelineSteps.length > 0 && (
          <StepPipelineView steps={pipelineSteps} />
        )}
        <Bubble.List
          items={items}
          style={{ maxWidth: 800, margin: '0 auto' }}
          contentRender={(content: string) => (
            <XMarkdown
              content={String(DOMPurify.sanitize(content))}
              rehypePlugins={[rehypeHighlight]}
              components={{
                code({ inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <CodeBlock language={match[1]}>{String(children).replace(/\n$/, '')}</CodeBlock>
                  ) : (
                    <code className={className} {...props}>{children}</code>
                  );
                },
              }}
            />
          )}
        />
      </div>

      {/* 输入区域（带暂停按钮） */}
      <div style={{ 
          padding: '12px 24px',
          borderTop: '1px solid var(--border-color)',
          width: '100%',
          margin: '0 auto',           
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 8
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
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div style={{ flex: 1 }}>
          <Sender
            value={inputValue}
            onChange={setInputValue}
            loading={isRequesting}
            placeholder="输入任务… (Enter 发送, Shift+Enter 换行)"
            onSubmit={handleSubmit}
          />
        </div>
        {isRequesting && (
          <Tooltip title="停止生成">
            <Button
              danger
              icon={<StopOutlined />}
              onClick={abort}
              size="large"
            />
          </Tooltip>
        )}
        <Tooltip title="导出对话 (MD)">
          <Button icon={<ExportOutlined />} onClick={exportChat} size="large" />
        </Tooltip>
      </div>
    </div>
  );
}