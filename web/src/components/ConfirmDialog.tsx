import { lazy, Suspense } from 'react';
import { Modal, Button } from 'antd';
const DiffEditor = lazy(() => import('./DiffEditor'));
export default function ConfirmDialog({ toolName, diff, onConfirm, onReject }: { toolName: string; diff: string; onConfirm: () => void; onReject: () => void }) {
  const parseDiff = (d: string) => { const o: string[] = [], m: string[] = []; d.split('\n').forEach(l => { if (l.startsWith('-')) o.push(l.slice(1)); else if (l.startsWith('+')) m.push(l.slice(1)); else { o.push(l); m.push(l); } }); return { original: o.join('\n'), modified: m.join('\n') }; };
  const { original, modified } = parseDiff(diff);
  return (
    <Modal title={'确认执行修改 - ' + toolName} open onCancel={onReject} footer={<><Button onClick={onReject}>拒绝</Button><Button type="primary" onClick={onConfirm}>确认执行</Button></>} width={900}>
      <Suspense fallback={<div>加载差异编辑器...</div>}><DiffEditor original={original} modified={modified} /></Suspense>
    </Modal>
  );
}