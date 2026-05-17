import { CodeHighlighter, Mermaid } from '@ant-design/x';

export default function CodeBlock({ language, children }: { language?: string; children: string }) {
  if (language === 'mermaid') {
    return (
      <div style={{ margin: '12px 0' }}>
        <Mermaid>{children}</Mermaid>
      </div>
    );
  }

  return (
    <div style={{ margin: '12px 0' }}>
      <CodeHighlighter lang={language} header={language ? undefined : false}>
        {children}
      </CodeHighlighter>
    </div>
  );
}
