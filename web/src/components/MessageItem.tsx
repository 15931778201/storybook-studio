import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import type { ChatMessage } from '../hooks/useAgent';

export default function MessageItem({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`message ${message.role}`}>
      <div className="message-avatar">
        {isUser ? '👤' : '🤖'}
      </div>
      <div className={`message-bubble ${isUser ? 'user-bubble' : 'agent-bubble'}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            code({ inline, className, children, ...props }: any) {
              return inline ? (
                <code className="inline-code" {...props}>{children}</code>
              ) : (
                <pre className="code-block">
                  <code className={className} {...props}>{children}</code>
                </pre>
              );
            },
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}