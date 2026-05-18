import { DiffEditor } from '@monaco-editor/react';
export default function CodeDiffEditor({
  original,
  modified,
  language = 'plaintext',
  height = 420,
}: {
  original: string;
  modified: string;
  language?: string;
  height?: string | number;
}) {
  return (
    <DiffEditor
      height={height}
      language={language}
      original={original}
      modified={modified}
      options={{
        readOnly: true,
        originalEditable: false,
        renderSideBySide: true,
        automaticLayout: true,
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        minimap: { enabled: false },
        lineNumbers: 'on',
        renderIndicators: true,
      }}
    />
  );
}