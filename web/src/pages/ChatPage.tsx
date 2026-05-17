import { lazy, Suspense, useState } from 'react';
import { Button } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import Sidebar from '../components/Sidebar';
import WorkspaceTabs from '../components/WorkspaceTabs';
import ChatLayout from '../components/ChatLayout';
import { useChatContext } from '../providers/ChatProvider';
import { useConfirm } from '../hooks/useConfirm';

const ConfirmDialog = lazy(() => import('../components/ConfirmDialog'));

export default function ChatPage() {
  const [conversationsOpen, setConversationsOpen] = useState(() => window.innerWidth > 768);
  const { confirmRequest } = useChatContext();
  const { handleConfirm, handleReject } = useConfirm();
  const sidebarWidth = 280;

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <div style={{
        width: conversationsOpen ? sidebarWidth : 0,
        overflow: 'hidden',
        transition: 'width 0.2s',
        borderRight: conversationsOpen ? '1px solid var(--border-color)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        <Sidebar />
      </div>

      <Button
        type="text"
        icon={conversationsOpen ? <LeftOutlined /> : <RightOutlined />}
        onClick={() => setConversationsOpen(!conversationsOpen)}
        style={{
          position: 'absolute',
          left: conversationsOpen ? sidebarWidth : 0,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 10,
          width: 20,
          height: 48,
          borderRadius: '0 4px 4px 0',
          border: '1px solid var(--border-color)',
          borderLeft: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-color)',
          padding: 0,
          minWidth: 20,
        }}
      />

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
      }}>
        <div style={{
          borderBottom: '1px solid var(--border-color)',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          height: 48,
          flexShrink: 0,
        }}>
          <WorkspaceTabs />
        </div>
        <ChatLayout />
        {confirmRequest && (
          <Suspense fallback={<div>加载中...</div>}>
            <ConfirmDialog
              toolName={confirmRequest.toolName}
              diff={confirmRequest.diff}
              onConfirm={handleConfirm}
              onReject={handleReject}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
