import { Conversations } from '@ant-design/x';
import { useChatContext } from '../providers/ChatProvider';

export default function Sidebar() {
  const {
    activeConversationId,
    setActiveConversationId,
    conversationTitles,
    conversationIds,
    createConversation,
    deleteConversation,
  } = useChatContext();

  const items = conversationIds.map(key => ({
    key,
    label: conversationTitles[key] || '新对话',
  }));

  return (
    <Conversations
      items={items}
      activeKey={activeConversationId}
      onActiveChange={setActiveConversationId}
      creation={{ onClick: createConversation }}
      style={{ height: '100%' }}
      menu={(item) => ({
        items: [
          { label: '删除', key: 'delete', danger: true, onClick: () => deleteConversation(item.key) },
        ],
      })}
    />
  );
}
