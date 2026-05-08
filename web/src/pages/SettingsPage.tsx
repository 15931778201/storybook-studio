// import { useState } from 'react';
// import { Form, Input, InputNumber, Button, Card, message, Typography, Space } from 'antd';
// import { loadModelConfig, saveModelConfig, ModelConfig } from '../types/models';
// import ModelSettings from '../components/ModelSettings';
// import RoleCard from '../components/RoleCard';
// export default function SettingsPage() {
//   const [form] = Form.useForm();
//   const [saving, setSaving] = useState(false);
//   const handleSave = () => {
//     form.validateFields().then((values: ModelConfig) => {
//       saveModelConfig(values); message.success('配置已保存'); setSaving(false);
//     });
//   };
//   const load = () => { form.setFieldsValue(loadModelConfig()); };
//   useState(() => { load(); });
//   return (
//     <div style={{ padding: 24, margin: '0 auto' }}>
//       <Typography.Title level={4}>⚙️ 设置</Typography.Title>
//       <Card title="模型配置" style={{ marginBottom: 24 }}>
//         <ModelSettings />
//       </Card>
//       <Card title="角色配置" style={{ marginBottom: 24 }}>
//         <RoleCard />
//       </Card>      
//       <Card title="关于 AgentKit">
//         <Typography.Paragraph>AgentKit v0.1.0 — 企业级 AI Agent 开发框架。</Typography.Paragraph>
//       </Card>
//     </div>
//   );
// }

import { useState, useEffect } from 'react';
import {
  Form, Input, InputNumber, Button, Card, message, Typography, Space, Divider,
  Modal, Row, Col,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { loadModelConfig, saveModelConfig, ModelConfig } from '../types/models';
import { useChatContext } from '../providers/ChatProvider';
import RoleCard from '../components/RoleCard';
import { BUILTIN_ROLES } from '../data/builtinRoles';
import type { RoleProfile } from '../types/roles';

export default function SettingsPage() {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const { activeRole, setActiveRole } = useChatContext();

  // 自定义角色管理
  const [customRoles, setCustomRoles] = useState<RoleProfile[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('customRoles') || '[]');
    } catch { return []; }
  });
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleForm] = Form.useForm();

  // 模型配置
  const handleSave = async () => {
    try {
      const values: ModelConfig = await form.validateFields();
      saveModelConfig(values);
      message.success('模型配置已保存');
      setSaving(false);
    } catch {}
  };

  useEffect(() => {
    form.setFieldsValue(loadModelConfig());
  }, []);

  // 创建自定义角色
  const handleCreateRole = async () => {
    try {
      const values = await roleForm.validateFields();
      const newRole: RoleProfile = {
        id: 'custom-' + Date.now(),
        ...values,
        customPrompt: values.customPrompt || '',
      };
      const updated = [...customRoles, newRole];
      setCustomRoles(updated);
      localStorage.setItem('customRoles', JSON.stringify(updated));
      message.success('角色已创建');
      setRoleModalOpen(false);
      roleForm.resetFields();
    } catch {}
  };

  const allRoles = [...BUILTIN_ROLES, ...customRoles];

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Typography.Title level={4}>⚙️ 设置</Typography.Title>

      {/* 模型配置 */}
      <Card title="模型配置" style={{ marginBottom: 24 }}>
        <Form form={form} layout="vertical">
          <Form.Item name="model" label="模型名称" rules={[{ required: true }]}>
            <Input placeholder="gpt-4o" />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key（留空使用环境变量）">
            <Input.Password placeholder="sk-..." />
          </Form.Item>
          <Form.Item name="baseURL" label="Base URL">
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>
          <Space size="large">
            <Form.Item name="temperature" label="温度" rules={[{ required: true }]}>
              <InputNumber min={0} max={2} step={0.1} />
            </Form.Item>
            <Form.Item name="maxTokens" label="最大 Tokens" rules={[{ required: true }]}>
              <InputNumber min={100} max={128000} step={100} />
            </Form.Item>
          </Space>
          <Button type="primary" onClick={handleSave} loading={saving}>
            保存模型配置
          </Button>
        </Form>
      </Card>

      {/* 角色管理 */}
      <Card
        title="角色管理"
        extra={
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => setRoleModalOpen(true)}
          >
            创建角色
          </Button>
        }
      >
        <Typography.Paragraph type="secondary">
          选择一个角色，Agent 将以该角色的专业口吻和思考框架进行回答。
        </Typography.Paragraph>

        {/* 无角色选项 */}
        <div style={{ marginBottom: 16 }}>
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

        <Row gutter={[12, 12]}>
          {allRoles.map(role => (
            <Col xs={24} sm={12} key={role.id}>
              <RoleCard
                role={role}
                active={activeRole?.id === role.id}
                onClick={() => setActiveRole(role)}
              />
            </Col>
          ))}
        </Row>
      </Card>

      <Divider />

      <Card title="关于 AgentKit">
        <Typography.Paragraph>
          AgentKit v0.1.0 — 企业级 AI Agent 开发框架，集成了 Skills、MCP、RAG、工作流等能力。
        </Typography.Paragraph>
      </Card>

      {/* 创建自定义角色弹窗 */}
      <Modal
        title="创建自定义角色"
        open={roleModalOpen}
        onOk={handleCreateRole}
        onCancel={() => {
          setRoleModalOpen(false);
          roleForm.resetFields();
        }}
      >
        <Form form={roleForm} layout="vertical">
          <Form.Item name="name" label="角色名称" rules={[{ required: true }]}>
            <Input placeholder="如：谈判专家" />
          </Form.Item>
          <Form.Item name="title" label="职业称谓">
            <Input placeholder="如：Negotiator" />
          </Form.Item>
          <Form.Item name="tone" label="语气风格">
            <Input placeholder="如：冷静、果断、有说服力" />
          </Form.Item>
          <Form.Item name="customPrompt" label="额外提示词">
            <Input.TextArea rows={3} placeholder="如：每次回复前先确认对方需求" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}