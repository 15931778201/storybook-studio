import { Card, Tag, Space, Typography } from 'antd';
import type { RoleProfile } from '../types/roles';

export default function RoleCard({ role, active, onClick }: {
  role: RoleProfile;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Card
      size="small"
      hoverable
      onClick={onClick}
      style={{
        border: active ? '2px solid #007aff' : '1px solid #eee',
        background: active ? '#f0f5ff' : '#fff',
        cursor: 'pointer',
        transition: '0.2s',
      }}
    >
      <Typography.Text strong>{role.name}</Typography.Text>
      <br />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {role.description}
      </Typography.Text>
      <div style={{ marginTop: 8 }}>
        <Tag color="blue">{role.tone}</Tag>
        {role.thinkingFramework && <Tag>有思考框架</Tag>}
        {role.constraints && <Tag color="orange">{role.constraints.length} 项约束</Tag>}
      </div>
    </Card>
  );
}