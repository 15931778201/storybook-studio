import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form, Input, InputNumber, Button, Card, message, Typography, Space, Divider, Tabs,
} from 'antd';
import { CloudOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import { loadModelConfig, saveModelConfig, ModelConfig } from '../types/models';
import { useChatContext } from '../providers/ChatProvider';

export default function SettingsPage() {
  const [llmForm] = Form.useForm();
  const [embedForm] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { activeRole, setActiveRole } = useChatContext();

  const handleSaveLlm = async () => {
    try {
      const values = await llmForm.validateFields();
      const current = loadModelConfig();
      saveModelConfig({ ...current, ...values });
      message.success('LLM 配置已保存');
      setSaving(false);
    } catch {}
  };

  const handleSaveEmbed = async () => {
    try {
      const values = await embedForm.validateFields();
      const current = loadModelConfig();
      saveModelConfig({
        ...current,
        embeddingModel: values.embeddingModel,
        embeddingApiKey: values.embeddingApiKey,
        embeddingBaseURL: values.embeddingBaseURL,
      });
      message.success('嵌入配置已保存');
      setSaving(false);
    } catch {}
  };

  useEffect(() => {
    const config = loadModelConfig();
    llmForm.setFieldsValue(config);
    embedForm.setFieldsValue({
      embeddingModel: config.embeddingModel,
      embeddingApiKey: config.embeddingApiKey,
      embeddingBaseURL: config.embeddingBaseURL,
    });
  }, []);

  const tabItems = [
    {
      key: 'llm',
      label: <span><CloudOutlined /> LLM 配置</span>,
      children: (
        <Card>
          <Form form={llmForm} layout="vertical">
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
            <Button type="primary" onClick={handleSaveLlm} loading={saving}>
              保存模型配置
            </Button>
          </Form>
        </Card>
      ),
    },
    {
      key: 'embed',
      label: <span><RobotOutlined /> 嵌入模型</span>,
      children: (
        <Card>
          <Typography.Paragraph type="secondary">
            留空则依次回退到 EMBEDDING_xxx 环境变量和 LLM 配置
          </Typography.Paragraph>
          <Form form={embedForm} layout="vertical">
            <Form.Item name="embeddingModel" label="嵌入模型名称" rules={[{ required: true }]}>
              <Input placeholder="text-embedding-3-small" />
            </Form.Item>
            <Form.Item name="embeddingApiKey" label="API Key（留空回退环境变量）">
              <Input.Password placeholder="sk-..." />
            </Form.Item>
            <Form.Item name="embeddingBaseURL" label="Base URL（留空回退环境变量）">
              <Input placeholder="https://api.openai.com/v1" />
            </Form.Item>
            <Button type="primary" onClick={handleSaveEmbed} loading={saving}>
              保存嵌入配置
            </Button>
          </Form>
        </Card>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Typography.Title level={4}>⚙️ 设置</Typography.Title>

      <Tabs items={tabItems} style={{ marginBottom: 24 }} />

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
