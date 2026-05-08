import { useState } from 'react';
import { Dropdown, Button, Modal, Form, Input, Space, message, Tag } from 'antd';
import { UserOutlined, PlusOutlined } from '@ant-design/icons';
import type { RoleProfile } from '../types/roles';
import { BUILTIN_ROLES } from '../data/builtinRoles';

interface Props {
  activeRole: RoleProfile | null;
  onSelectRole: (role: RoleProfile | null) => void;
}

export default function RoleSelector({ activeRole, onSelectRole }: Props) {
  const [customRoles, setCustomRoles] = useState<RoleProfile[]>(() => {
    try { return JSON.parse(localStorage.getItem('customRoles') || '[]'); } catch { return []; }
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const saveCustom = (roles: RoleProfile[]) => {
    setCustomRoles(roles);
    localStorage.setItem('customRoles', JSON.stringify(roles));
  };

  const handleCreate = () => {
    form.validateFields().then((values: any) => {
      const newRole: RoleProfile = { id: 'custom-' + Date.now(), ...values };
      const updated = [...customRoles, newRole];
      saveCustom(updated);
      setModalOpen(false);
      form.resetFields();
      message.success('角色已创建');
    });
  };

  const allRoles = [...BUILTIN_ROLES, ...customRoles];

  const menuItems = [
    { key: 'none', label: '无角色', onClick: () => onSelectRole(null) },
    { type: 'divider' as const },
    ...allRoles.map(role => ({
      key: role.id,
      label: role.name,
      onClick: () => onSelectRole(role),
    })),
    { type: 'divider' as const },
    { key: 'create', icon: <PlusOutlined />, label: '创建自定义角色', onClick: () => setModalOpen(true) },
  ];

  return (
    <>
      <Dropdown menu={{ items: menuItems }} trigger={['click']}>
        <Button size="small" icon={<UserOutlined />}>
          {activeRole ? activeRole.name : '角色'}
        </Button>
      </Dropdown>
      <Modal title="创建自定义角色" open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="角色名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="title" label="职业称谓"><Input /></Form.Item>
          <Form.Item name="tone" label="语气风格"><Input /></Form.Item>
          <Form.Item name="customPrompt" label="额外提示词"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}