import { Conversations } from '@ant-design/x';
import { useCallback, useState } from 'react';
import { useChatContext } from '../providers/ChatProvider';

export default function Sidebar() {
  const { activeConversationId, setActiveConversationId, setMessages } = useChatContext();
  const [items, setItems] = useState([{ key: activeConversationId, label: '默认对话' }]);

  const handleCreate = useCallback(() => {
    const newKey = 'conv-' + Date.now();
    setItems(prev => [{ key: newKey, label: '新对话' }, ...prev]);
    setActiveConversationId(newKey);
    setMessages([]);
  }, [setActiveConversationId, setMessages]);

  const handleDelete = useCallback((key: string) => {
    setItems(prev => prev.filter(i => i.key !== key));
    if (key === activeConversationId) {
      const remaining = items.filter(i => i.key !== key);
      if (remaining.length > 0) setActiveConversationId(remaining[0].key);
    }
  }, [activeConversationId, items, setActiveConversationId]);

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