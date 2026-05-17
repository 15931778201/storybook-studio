import { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Space, Typography } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import type { RoleProfile } from '../types/roles';

interface Props {
  open: boolean;
  role?: RoleProfile | null;
  onClose: () => void;
  onSave: (data: Omit<RoleProfile, 'id'>) => Promise<void>;
}

export default function RoleEditorModal({ open, role, onClose, onSave }: Props) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (role) {
        form.setFieldsValue(role);
      }
    }
  }, [open, role]);

  const handleOk = async () => {
    try {
      setSaving(true);
      const values = await form.validateFields();
      await onSave({
        name: values.name,
        title: values.title || '',
        description: values.description || '',
        tone: values.tone || '',
        customPrompt: values.customPrompt || '',
        thinkingFramework: values.thinkingFramework || undefined,
        outputFormat: values.outputFormat || undefined,
        constraints: values.constraints?.filter(Boolean) || undefined,
        preferredTools: values.preferredTools?.filter(Boolean) || undefined,
        examples: values.examples?.filter((e: any) => e.user && e.assistant) || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={role ? '编辑角色' : '创建角色'}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={saving}
      width={640}
    >
      <Form form={form} layout="vertical">
        <Typography.Text strong>基础信息</Typography.Text>
        <Form.Item name="name" label="角色名称" rules={[{ required: true }]}>
          <Input placeholder="如：谈判专家" />
        </Form.Item>
        <Form.Item name="title" label="职业称谓">
          <Input placeholder="如：Negotiator" />
        </Form.Item>
        <Form.Item name="description" label="角色描述">
          <Input.TextArea rows={2} placeholder="角色简介" />
        </Form.Item>
        <Form.Item name="tone" label="语气风格">
          <Input placeholder="如：冷静、果断、有说服力" />
        </Form.Item>

        <Typography.Text strong style={{ display: 'block', marginTop: 16 }}>进阶配置</Typography.Text>
        <Form.Item name="thinkingFramework" label="思考框架">
          <Input.TextArea rows={2} placeholder="如：先分析需求，再分步骤执行，最后总结" />
        </Form.Item>
        <Form.Item name="outputFormat" label="输出格式">
          <Input.TextArea rows={2} placeholder="如：使用 Markdown 格式输出，包含标题和列表" />
        </Form.Item>
        <Form.Item name="constraints" label="约束条件">
          <Form.List name="constraints">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item {...rest} name={name} noStyle>
                      <Input placeholder="约束条件" style={{ width: 440 }} />
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} size="small">
                  添加约束
                </Button>
              </>
            )}
          </Form.List>
        </Form.Item>
        <Form.Item name="preferredTools" label="偏好工具">
          <Form.List name="preferredTools">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item {...rest} name={name} noStyle>
                      <Input placeholder="工具名称" style={{ width: 440 }} />
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} size="small">
                  添加工具
                </Button>
              </>
            )}
          </Form.List>
        </Form.Item>
        <Form.Item label="示例对话">
          <Form.List name="examples">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <div key={key} style={{ marginBottom: 12, padding: 12, background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0', position: 'relative' }}>
                    <Form.Item {...rest} name={[name, 'user']} label="用户说" style={{ marginBottom: 8 }}>
                      <Input.TextArea rows={2} placeholder="用户说" />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, 'assistant']} label="助手答" style={{ marginBottom: 0 }}>
                      <Input.TextArea rows={4} placeholder="助手答" style={{ fontFamily: 'monospace' }} />
                    </Form.Item>
                    <MinusCircleOutlined
                      onClick={() => remove(name)}
                      style={{ position: 'absolute', top: 8, right: 8, color: '#999', cursor: 'pointer' }}
                    />
                  </div>
                ))}
                <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} size="small">
                  添加示例
                </Button>
              </>
            )}
          </Form.List>
        </Form.Item>

        <Typography.Text strong style={{ display: 'block', marginTop: 16 }}>自定义</Typography.Text>
        <Form.Item name="customPrompt" label="额外提示词">
          <Input.TextArea rows={3} placeholder="自定义提示词" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
