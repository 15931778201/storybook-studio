import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Switch, Popconfirm, Space, Tag, message } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, ThunderboltOutlined } from '@ant-design/icons';

interface CronJob {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  prompt: string;
  role?: string;
  enabled: boolean;
  lastRun?: string;
  createdAt: string;
}

export default function CronPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CronJob | null>(null);
  const [form] = Form.useForm();

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cron');
      setJobs(await res.json());
    } catch { message.error('加载失败'); }
    setLoading(false);
  };

  useEffect(() => { fetchJobs(); }, []);

  const handleSubmit = async (values: any) => {
    const url = editing ? `/api/cron/${editing.id}` : '/api/cron';
    const method = editing ? 'PUT' : 'POST';
    try {
      await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      message.success(editing ? '更新成功' : '创建成功');
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      fetchJobs();
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/cron/${id}`, { method: 'DELETE' });
    message.success('已删除');
    fetchJobs();
  };

  const handleRunNow = async (id: string) => {
    await fetch(`/api/cron/${id}/run`, { method: 'POST' });
    message.success('已触发执行');
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await fetch(`/api/cron/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) });
    fetchJobs();
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: 'Cron 表达式', dataIndex: 'cronExpression', key: 'cronExpression', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '提示词', dataIndex: 'prompt', key: 'prompt', ellipsis: true },
    {
      title: '状态', dataIndex: 'enabled', key: 'enabled',
      render: (v: boolean, record: CronJob) => (
        <Switch checked={v} onChange={(checked) => handleToggle(record.id, checked)} />
      ),
    },
    { title: '上次执行', dataIndex: 'lastRun', key: 'lastRun', render: (v?: string) => v ? new Date(v).toLocaleString() : '-' },
    {
      title: '操作', key: 'action',
      render: (_: any, record: CronJob) => (
        <Space>
          <Button size="small" icon={<ThunderboltOutlined />} onClick={() => handleRunNow(record.id)}>立即执行</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(record); form.setFieldsValue(record); setModalOpen(true); }} />
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3>⏰ 定时任务</h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
          新建任务
        </Button>
      </div>

      <Table dataSource={jobs} columns={columns} rowKey="id" loading={loading} />

      <Modal
        title={editing ? '编辑任务' : '新建任务'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        onOk={() => form.submit()}
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="任务名称" rules={[{ required: true }]}>
            <Input placeholder="如：每日站会总结" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="cronExpression" label="Cron 表达式" rules={[{ required: true }]} help="如：0 9 * * 1-5 表示工作日早上9点">
            <Input placeholder="*/10 * * * *" />
          </Form.Item>
          <Form.Item name="prompt" label="触发提示词" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder="发送给 Agent 的提示词" />
          </Form.Item>
          <Form.Item name="role" label="执行角色（可选）">
            <Select allowClear placeholder="选择角色">
              <Select.Option value="programmer">资深程序员</Select.Option>
              <Select.Option value="analyst">数据分析师</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}