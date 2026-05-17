import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form, Input, InputNumber, Button, Card, message, Typography, Space, Divider,
} from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { loadModelConfig, saveModelConfig, ModelConfig } from '../types/models';
import { useChatContext } from '../providers/ChatProvider';

export default function SettingsPage() {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { activeRole, setActiveRole } = useChatContext();

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

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Typography.Title level={4}>⚙️ 设置</Typography.Title>

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

      <Card
        title="角色管理"
        extra={
          <Button size="small" icon={<UserOutlined />} onClick={() => navigate('/roles')}>
            管理角色
          </Button>
        }
        style={{ marginBottom: 24 }}
      >
        <Typography.Paragraph type="secondary">
          {activeRole
            ? `当前角色：${activeRole.name}（${activeRole.title || '自定义'}）`
            : '当前角色：无角色（正常对话模式）'}
        </Typography.Paragraph>
        <Button type="link" onClick={() => setActiveRole(null)}>取消角色</Button>
        <Button type="link" onClick={() => navigate('/roles')}>前往角色管理</Button>
      </Card>

      <Divider />

      <Card title="关于 AgentKit">
        <Typography.Paragraph>
          AgentKit v0.1.0 — 企业级 AI Agent 开发框架，集成了 Skills、MCP、RAG、工作流等能力。
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
