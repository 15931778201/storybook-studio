import React, { useState, useCallback, memo } from 'react';
import { Conversations } from '@ant-design/x';

const INITIAL_CONVERSATIONS = [{ key: `conv-${Date.now()}`, label: '默认对话' }];

const Sidebar = ({ activeKey, onSelect }: { activeKey: string; onSelect: (key: string) => void }) => {
  const [items, setItems] = useState(INITIAL_CONVERSATIONS);

  const handleCreate = useCallback(() => {
    const newConv = { key: `conv-${Date.now()}`, label: '新对话' };
    setItems(prev => [newConv, ...prev]);
    onSelect(newConv.key);
  }, [onSelect]);

  return (
    <Conversations
      items={items}
      activeKey={activeKey}
      onActiveChange={onSelect}
      creation={{ onClick: handleCreate }}
      style={{ height: '100%' }}
    />
  );
};

export default memo(Sidebar);