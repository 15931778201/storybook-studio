import { Conversations } from '@ant-design/x';
import { useCallback, useState } from 'react';
import { useChatContext } from '../providers/ChatProvider';

export default function Sidebar() {
  const { activeConversationId, setActiveConversationId, conversationTitles } = useChatContext();
  const [keys, setKeys] = useState<string[]>([activeConversationId]);

  const items = keys.map(key => ({
    key,
    label: conversationTitles[key] || '新对话',
  }));

  const handleCreate = useCallback(() => {
    const newKey = 'conv-' + Date.now();
    setKeys(prev => [newKey, ...prev]);
    setActiveConversationId(newKey);
  }, [setActiveConversationId]);

  const handleDelete = useCallback((key: string) => {
    setKeys(prev => prev.filter(k => k !== key));
    if (key === activeConversationId) {
      const remaining = keys.filter(k => k !== key);
      if (remaining.length > 0) setActiveConversationId(remaining[0]);
    }
  }, [activeConversationId, keys, setActiveConversationId]);

  return (
    <Conversations
      items={items}
      activeKey={activeConversationId}
      onActiveChange={setActiveConversationId}
      creation={{ onClick: handleCreate }}
      style={{ height: '100%' }}
      menu={(item) => ({
        items: [
          { label: '删除', key: 'delete', danger: true, onClick: () => handleDelete(item.key) },
        ],
      })}
    />
  );
}
