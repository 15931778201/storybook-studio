import { Button, Card, List, Tag, Typography } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useChatContext } from '../providers/ChatProvider';
import { buildWorkspaceStatus } from '../utils/chat-session-state';

const { Text } = Typography;

export default function WorkspaceStatusPanel({
  collapsed,
  onCollapsedChange,
}: {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const { activeWorkspaceId, workspaces, messages, confirmRequest, resumeLastRun, activeConversationId } = useChatContext();
  const [workspaceContext, setWorkspaceContext] = useState<{ fileTreeSummary?: string; gitContext?: string } | null>(null);
  const [auditItems, setAuditItems] = useState<any[]>([]);
  const status = buildWorkspaceStatus({
    activeWorkspaceId,
    workspaces,
    messages,
    confirmRequest,
  });
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);

  useEffect(() => {
    if (!activeWorkspace?.projectPath) return;
    fetch(`/api/tools/workspace-context?projectPath=${encodeURIComponent(activeWorkspace.projectPath)}`)
      .then((response) => response.json())
      .then((data) => {
        if (data?.success) {
          setWorkspaceContext(data.data || null);
        }
      })
      .catch(() => {});
  }, [activeWorkspace?.projectPath]);

  useEffect(() => {
    fetch(`/api/logs/audit?sessionId=${encodeURIComponent(activeConversationId)}&limit=50`)
      .then((response) => response.json())
      .then((data) => setAuditItems(data.items || []))
      .catch(() => {});
  }, [activeConversationId, messages.length]);

  return (
    <Card
      size="small"
      title={(
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>工作区状态</span>
          <Button
            type="text"
            size="small"
            icon={collapsed ? <LeftOutlined /> : <RightOutlined />}
            onClick={() => onCollapsedChange(!collapsed)}
            aria-label={collapsed ? '展开工作区状态面板' : '收起工作区状态面板'}
          />
        </div>
      )}
      style={{
        width: collapsed ? 56 : 320,
        borderLeft: '1px solid var(--border-color)',
        borderRadius: 0,
        flexShrink: 0,
        transition: 'width 0.2s ease',
        overflow: 'hidden',
      }}
      bodyStyle={collapsed
        ? {
            padding: 0,
            minHeight: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }
        : { display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      {collapsed ? (
        <div style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', padding: '12px 0', color: 'var(--text-color-secondary)' }}>
          工作区状态
        </div>
      ) : (
        <>
      <section>
        <Text type="secondary">项目路径</Text>
        <div style={{ marginTop: 4, wordBreak: 'break-all' }}>{status.projectPath}</div>
        <div style={{ marginTop: 8 }}>
          <Button size="small" onClick={resumeLastRun}>恢复上次运行</Button>
        </div>
      </section>

      <section>
        <Text type="secondary">已修改文件</Text>
        <List
          size="small"
          locale={{ emptyText: '暂无' }}
          dataSource={status.modifiedFiles}
          renderItem={(item) => <List.Item>{item}</List.Item>}
        />
      </section>

      <section>
        <Text type="secondary">待确认 Diff</Text>
        <List
          size="small"
          locale={{ emptyText: '暂无' }}
          dataSource={status.pendingDiffFiles}
          renderItem={(item) => <List.Item>{item}</List.Item>}
        />
      </section>

      <section>
        <Text type="secondary">最近测试结果</Text>
        <div style={{ marginTop: 8 }}>
          {status.lastVerification ? (
            <>
              <div style={{ marginBottom: 8 }}>
                <Tag color={status.lastVerification.passed ? 'green' : 'red'}>
                  {status.lastVerification.passed ? '通过' : '失败'}
                </Tag>
              </div>
              <div style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
                {status.lastVerification.commands.join('\n') || '未执行'}
              </div>
            </>
          ) : (
            <Text type="secondary">暂无</Text>
          )}
        </div>
      </section>

      <section>
        <Text type="secondary">文件树摘要</Text>
        <div style={{ marginTop: 8, fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto' }}>
          {workspaceContext?.fileTreeSummary || status.fileTreeSummary || '暂无'}
        </div>
      </section>

      <section>
        <Text type="secondary">Git 上下文</Text>
        <div style={{ marginTop: 8, fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto' }}>
          {workspaceContext?.gitContext || status.gitContext || '暂无'}
        </div>
      </section>

      <section>
        <Text type="secondary">会话审计</Text>
        <List
          size="small"
          locale={{ emptyText: '暂无' }}
          dataSource={auditItems}
          renderItem={(item) => (
            <List.Item>
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <Tag color={item.action === 'denied' ? 'red' : 'blue'}>{item.action}</Tag>
                  <Text strong>{item.toolName || 'unknown'}</Text>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-color-secondary)' }}>
                  {item.reason || item.output || item.filePath || ''}
                </div>
              </div>
            </List.Item>
          )}
        />
      </section>
        </>
      )}
    </Card>
  );
}
