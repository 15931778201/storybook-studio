import { DiffEditor } from '@monaco-editor/react';
export default function CodeDiffEditor({ original, modified }: { original: string; modified: string }) {
  return <DiffEditor height="400px" language="text" original={original} modified={modified} theme="vs-dark" options={{ readOnly: true, renderSideBySide: true, minimap: { enabled: false } }} />;
}