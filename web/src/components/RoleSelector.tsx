import { useState } from 'react';
import { Popover, Row, Col, Button, Space, Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import RoleCard from './RoleCard';
import type { RoleProfile } from '../types/roles';
import { BUILTIN_ROLES } from '../data/roles';

export default function RoleSelector({ activeRole, onSelectRole }: {
  activeRole: RoleProfile | null;
  onSelectRole: (role: RoleProfile | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomRight"
      content={
        <div style={{ width: 420, maxHeight: 500, overflow: 'auto' }}>
          <Typography.Title level={5} style={{ marginBottom: 12 }}>
            选择角色
          </Typography.Title>
          <Row gutter={[8, 8]}>
            <Col span={12}>
              <RoleCard
                role={{ id: '', name: '无角色', title: '', description: '正常对话', tone: '', customPrompt: '' }}
                active={!activeRole}
                onClick={() => { onSelectRole(null); setOpen(false); }}
              />
            </Col>
            {BUILTIN_ROLES.map(role => (
              <Col span={12} key={role.id}>
                <RoleCard
                  role={role}
                  active={activeRole?.id === role.id}
                  onClick={() => { onSelectRole(role); setOpen(false); }}
                />
              </Col>
            ))}
          </Row>
        </div>
      }
    >
      <Button icon={<UserOutlined />} size="small">
        {activeRole ? activeRole.name : '角色'}
      </Button>
    </Popover>
  );
}