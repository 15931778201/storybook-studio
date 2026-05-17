import { useState, useEffect } from 'react';
import {
  Card, Row, Col, Typography, Button, message, Tag, Space, Popconfirm,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { useChatContext } from '../providers/ChatProvider';
import RoleCard from '../components/RoleCard';
import RoleEditorModal from '../components/RoleEditorModal';
import RoleDetailModal from '../components/RoleDetailModal';
import { listRoles, createRole, updateRole, deleteRole } from '../data/roleApi';
import type { RoleProfile } from '../types/roles';

export default function RoleManagementPage() {
  const [roles, setRoles] = useState<RoleProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleProfile | null>(null);
  const [detailRole, setDetailRole] = useState<RoleProfile | null>(null);
  const { activeRole, setActiveRole } = useChatContext();

  const loadRoles = () => {
    setLoading(true);
    listRoles()
      .then(setRoles)
      .catch(() => message.error('加载角色失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadRoles(); }, []);

  const handleSave = async (data: Omit<RoleProfile, 'id'>) => {
    if (editingRole) {
      await updateRole(editingRole.id, data);
      if (activeRole?.id === editingRole.id) {
        setActiveRole({ ...editingRole, ...data });
      }
    } else {
      await createRole(data);
    }
    await loadRoles();
    message.success(editingRole ? '角色已更新' : '角色已创建');
  };

  const handleDelete = async (id: string) => {
    await deleteRole(id);
    if (activeRole?.id === id) setActiveRole(null);
    setRoles(prev => prev.filter(r => r.id !== id));
    message.success('角色已删除');
  };

  const openEditor = (role?: RoleProfile) => {
    setEditingRole(role || null);
    setEditorOpen(true);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>🎭 角色管理</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>
          创建角色
        </Button>
      </div>

      <Typography.Paragraph type="secondary" style={{ marginBottom: 20 }}>
        选择一个角色，Agent 将以该角色的专业口吻和思考框架进行回答。
      </Typography.Paragraph>

      {/* 无角色选项 */}
      <div style={{ marginBottom: 20 }}>
        <Card
          size="small"
          hoverable
          onClick={() => setActiveRole(null)}
          style={{
            border: !activeRole ? '2px solid #007aff' : '1px solid #eee',
            background: !activeRole ? '#f0f5ff' : '#fff',
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          <Typography.Text strong>无角色</Typography.Text>
          <br />
          <Typography.Text type="secondary">正常对话模式</Typography.Text>
        </Card>
      </div>

      {/* 角色列表 */}
      <Row gutter={[20, 20]}>
        {roles.map(role => (
          <Col xs={24} lg={12} key={role.id}>
            <div style={{ position: 'relative' }}>
              <RoleCard
                role={role}
                active={activeRole?.id === role.id}
                onClick={() => setActiveRole(role)}
              />
              {/* 操作按钮 */}
              <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 2, zIndex: 1 }}>
                <Button
                  size="small"
                  type="text"
                  icon={<EyeOutlined />}
                  onClick={(e) => { e.stopPropagation(); setDetailRole(role); }}
                />
                <Button
                  size="small"
                  type="text"
                  icon={<EditOutlined />}
                  onClick={(e) => { e.stopPropagation(); openEditor(role); }}
                />
                <Popconfirm
                  title="确定删除此角色？"
                  onConfirm={(e) => { e?.stopPropagation(); handleDelete(role.id); }}
                  onCancel={(e) => e?.stopPropagation()}
                >
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Popconfirm>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* 角色详情 */}
      <RoleDetailModal
        role={detailRole}
        open={!!detailRole}
        onClose={() => setDetailRole(null)}
      />

      {/* 角色编辑器 */}
      <RoleEditorModal
        open={editorOpen}
        role={editingRole}
        onClose={() => { setEditorOpen(false); setEditingRole(null); }}
        onSave={handleSave}
      />
    </div>
  );
}
