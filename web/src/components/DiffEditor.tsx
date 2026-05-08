import React from 'react';
import { DiffEditor } from '@monaco-editor/react';

interface Props {
  original: string;
  modified: string;
  language?: string;
}

export default function CodeDiffEditor({ original, modified, language = 'text' }: Props) {
  return (
    <div style={{ width: '100%', height: 400, borderRadius: 8, overflow: 'hidden' }}>
      <DiffEditor
        height="100%"
        language={language}
        original={original}
        modified={modified}
        theme="vs-dark"
        options={{
          readOnly: true,
          renderSideBySide: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          lineNumbers: 'on',
        }}
      />
    </div>
  );
}