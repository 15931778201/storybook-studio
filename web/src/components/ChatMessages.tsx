import MessageItem from './MessageItem';
import type { ChatMessage } from '../hooks/useAgent';

export default function ChatMessages({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="chat-messages">
      {messages.map((msg, idx) => (
        <MessageItem key={idx} message={msg} />
      ))}
    </div>
  );
}