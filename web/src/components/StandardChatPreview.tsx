import { useMemo, useState } from 'react';
import { Bubble, Sender } from '@ant-design/x';
import { Alert } from 'antd';
import { useStandardChat } from '../hooks/useStandardChat';

type BubbleListRole = NonNullable<React.ComponentProps<typeof Bubble.List>['role']>;

const bubbleRoles: BubbleListRole = {
  assistant: {
    placement: 'start',
    avatar: 'AI',
  },
  user: {
    placement: 'end',
    avatar: 'U',
  },
};

export default function StandardChatPreview({ sessionId }: { sessionId?: string }) {
  const [value, setValue] = useState('');
  const { messages, sendMessage, isRequesting, abort } = useStandardChat(sessionId);

  const items = useMemo(
    () =>
      messages.map(({ id, message, status }) => ({
        key: id,
        role: message.role,
        content: message.content,
        status,
        loading: status === 'loading' && !message.content,
        streaming: status === 'updating',
      })),
    [messages]
  );

  const handleSubmit = (content: string) => {
    if (!content.trim()) return;

    sendMessage(content);
    setValue('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="标准聊天接口预览"
        description="该组件使用 https://api.example.com/chat 适配层，不会替换当前主聊天链路。"
      />
      <Bubble.List
        role={bubbleRoles}
        items={items}
        autoScroll
        style={{ flex: 1, overflow: 'auto', padding: 16 }}
      />
      <Sender
        value={value}
        onChange={setValue}
        loading={isRequesting}
        placeholder="输入消息以测试标准接口适配层"
        onSubmit={handleSubmit}
        onCancel={abort}
      />
    </div>
  );
}
