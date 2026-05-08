import { lazy, Suspense } from 'react';
import ChatLayout from '../components/ChatLayout';
const ConfirmDialog = lazy(() => import('../components/ConfirmDialog'));
import { useChatContext } from '../providers/ChatProvider';
import { useConfirm } from '../hooks/useConfirm';
export default function ChatPage() {
  const { confirmRequest } = useChatContext();
  const { handleConfirm, handleReject } = useConfirm();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ChatLayout />
      {confirmRequest && (
        <Suspense fallback={<div>加载中...</div>}>
          <ConfirmDialog toolName={confirmRequest.toolName} diff={confirmRequest.diff} onConfirm={handleConfirm} onReject={handleReject} />
        </Suspense>
      )}
    </div>
  );
}