import { useState, useEffect } from 'react';
import { Modal, Form, Select, Input, InputNumber, Button, Space, Divider, message, Tag, Tooltip } from 'antd';
import { SettingOutlined, CloudOutlined, HomeOutlined, ExperimentOutlined } from '@ant-design/icons';
import { loadModelConfig, saveModelConfig, ModelConfig } from '../types/models';

const PRESET_MODELS = [
  // 云端模型
  { label: 'GPT-5.4', value: 'gpt-5.4', provider: 'openai' },
  { label: 'GPT-5.3', value: 'gpt-5.3', provider: 'openai' },
  { label: 'GPT-5.2', value: 'gpt-5.2', provider: 'openai' },
  // 本地模型 (Ollama)
  { label: 'Qwen2.5 14B', value: 'qwen2.5:14b', provider: 'ollama' },
  { label: 'Llama3.1 8B', value: 'llama3.1:8b', provider: 'ollama' },
  { label: 'Mistral-Nemo 12B', value: 'mistral-nemo:12b', provider: 'ollama' },
  { label: 'DeepSeek-V2 16B', value: 'deepseek-v2:16b', provider: 'ollama' },
  { label: 'CodeQwen 7B', value: 'codeqwen:7b', provider: 'ollama' },
];

export default function ModelSettings({ onConfigChange }: { onConfigChange?: (config: ModelConfig) => void }) {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [provider, setProvider] = useState<string>('openai');

  const handleOpen = () => {
    const config = loadModelConfig();
    form.setFieldsValue(config);
    // 自动识别当前提供商
    if (config.baseURL?.includes('11434')) {
      setProvider('ollama');
    } else {
      setProvider('openai');
    }
    setOpen(true);
  };

  const handleProviderSwitch = (newProvider: string) => {
    setProvider(newProvider);
    if (newProvider === 'ollama') {
      form.setFieldsValue({ baseURL: 'http://localhost:11434/v1' });
    } else {
      form.setFieldsValue({ baseURL: '' });
    }
  };

  const handleSave = () => {
    form.validateFields().then((values) => {
      const newConfig: ModelConfig = {
        model: values.model,
        apiKey: values.apiKey,
        baseURL: values.baseURL,
        temperature: values.temperature,
        maxTokens: values.maxTokens,
      };
      saveModelConfig(newConfig);
      message.success(`已切换至 ${values.model}`);
      setOpen(false);
      onConfigChange?.(newConfig);
    });
  };

  return (
    <>
      <Form form={form} layout="vertical" initialValues={loadModelConfig()}>
        {/* 提供商切换 */}
        <Form.Item label="提供商">
          <Space>
            <Button
              type={provider === 'openai' ? 'primary' : 'default'}
              icon={<CloudOutlined />}
              onClick={() => handleProviderSwitch('openai')}
            >
              OpenAI / 云端
            </Button>
            <Button
              type={provider === 'ollama' ? 'primary' : 'default'}
              icon={<HomeOutlined />}
              onClick={() => handleProviderSwitch('ollama')}
            >
              Ollama / 本地
            </Button>
          </Space>
        </Form.Item>

        {/* 模型选择 */}
        <Form.Item name="model" label="模型" rules={[{ required: true, message: '请选择模型' }]}>
          <Select
            showSearch
            placeholder="选择模型或输入自定义名称"
            optionFilterProp="label"
            allowClear
            dropdownRender={(menu) => (
              <>
                {menu}
                <Divider style={{ margin: '8px 0' }} />
                <Space style={{ padding: '0 8px 4px' }}>
                  <Input
                    placeholder="自定义模型名"
                    onKeyDown={(e) => e.stopPropagation()}
                    onPressEnter={() => {
                      const value = (document.querySelector('.custom-model-input') as HTMLInputElement)?.value;
                      if (value) {
                        form.setFieldsValue({ model: value });
                      }
                    }}
                    className="custom-model-input"
                    style={{ width: 200 }}
                  />
                  <Button size="small" type="link">
                    自定义
                  </Button>
                </Space>
              </>
            )}
          >
            {PRESET_MODELS.filter(m => m.provider === provider).map(m => (
              <Select.Option key={m.value} value={m.value}>
                <Space>
                  {m.provider === 'ollama' ? <HomeOutlined /> : <CloudOutlined />}
                  {m.label}
                  <Tag color={m.provider === 'ollama' ? 'green' : 'blue'}>
                    {m.provider === 'ollama' ? '本地' : '云端'}
                  </Tag>
                </Space>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        {/* Base URL（根据提供商自动填充） */}
        <Form.Item name="baseURL" label="Base URL">
          <Input placeholder={provider === 'ollama' ? 'http://localhost:11434/v1' : 'https://api.openai.com/v1'} />
        </Form.Item>

        {/* API Key */}
        <Form.Item name="apiKey" label="API Key">
          <Input.Password placeholder={provider === 'ollama' ? 'ollama（可不填）' : 'sk-...'} />
        </Form.Item>

        {/* 温度与 Tokens */}
        <Space style={{ width: '100%' }} size="large">
          <Form.Item name="temperature" label="温度" rules={[{ required: true }]}>
            <InputNumber min={0} max={2} step={0.1} />
          </Form.Item>
          <Form.Item name="maxTokens" label="最大 Tokens" rules={[{ required: true }]}>
            <InputNumber min={100} max={128000} step={100} />
          </Form.Item>
        </Space>

        {/* 提示 */}
        {provider === 'ollama' && (
          <div style={{ padding: '8px', background: '#f6ffed', borderRadius: 6, marginTop: 8 }}>
            <ExperimentOutlined style={{ color: '#52c41a' }} />
            <span style={{ marginLeft: 8 }}>本地模型需先启动 Ollama 服务并拉取模型</span>
          </div>
        )}
      </Form>
    </>
  );
}