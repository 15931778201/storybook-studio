import { Card, Typography, Tooltip } from 'antd';
import type { RoleProfile } from '../types/roles';

const dot = <span style={{ color: '#d9d9d9', margin: '0 2px' }}>·</span>;

export default function RoleCard({ role, active, onClick }: {
  role: RoleProfile;
  active: boolean;
  onClick: () => void;
}) {
  const cCount = role.constraints?.length ?? 0;
  const tCount = role.preferredTools?.length ?? 0;
  const eCount = role.examples?.length ?? 0;
  const hasMeta = role.thinkingFramework || cCount > 0 || tCount > 0 || eCount > 0;

  return (
    <Card
      hoverable
      onClick={onClick}
      style={{
        border: active ? '2px solid #007aff' : '1px solid #eee',
        background: active ? '#f0f5ff' : '#fff',
        cursor: 'pointer',
        transition: '0.2s',
        height: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <Typography.Text strong style={{ fontSize: 16 }}>{role.name}</Typography.Text>
        {role.title && (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {role.title}
          </Typography.Text>
        )}
      </div>
      <Tooltip title={role.tone}>
        <Typography.Paragraph
          type="secondary"
          style={{ fontSize: 13, marginBottom: 0, lineHeight: 1.6, minHeight: '2.6em' }}
          ellipsis={{ rows: 2 }}
        >
          {role.description}
          {role.tone && <span style={{ color: '#aaa' }}> · {role.tone}</span>}
        </Typography.Paragraph>
      </Tooltip>
      {hasMeta && (
        <div style={{ marginTop: 8, fontSize: 13, color: '#888' }}>
          {role.thinkingFramework && <Tooltip title={role.thinkingFramework}><span>🧠{dot}</span></Tooltip>}
          {cCount > 0 && <span>⚠{cCount}{dot}</span>}
          {tCount > 0 && <span>🔧{tCount}{dot}</span>}
          {eCount > 0 && <span>📝{eCount}</span>}
        </div>
      )}
    </Card>
  );
}