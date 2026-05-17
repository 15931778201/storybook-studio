import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Popconfirm, Space, Tag, message } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

const TYPE_MAP: Record<string, { color: string; label: string }> = {
  requirement: { color: 'blue', label: '需求' },
  optimization: { color: 'green', label: '优化' },
  bug: { color: 'red', label: 'Bug' },
};

const TRIGGER_LABELS: Record<string, string> = {
  manual: '手动',
  git: 'Git 扫描',
  agent: 'Agent 自动',
};

interface ChangelogEntry {
  id: string;
  type: string;
  title: string;
  description?: string;
  trigger: string;
  commitHash?: string;
  createdAt: string;
}

export default function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchEntries = async (p = page, t = typeFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: '50' });
      if (t) params.set('type', t);
      const res = await fetch(`/api/changelog?${params}`);
      const data = await res.json();
      setEntries(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch { message.error('加载失败'); }
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, []);

  const handleSubmit = async (values: any) => {
    try {
      await fetch('/api/changelog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      message.success('创建成功');
      setModalOpen(false);
      form.resetFields();
      fetchEntries();
    } catch { message.error('创建失败'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/changelog/${id}`, { method: 'DELETE' });
      message.success('已删除');
      fetchEntries();
    } catch { message.error('删除失败'); }
  };

  const handleTypeFilterChange = (value: string | undefined) => {
    setTypeFilter(value);
    setPage(1);
    fetchEntries(1, value);
  };

  const columns = [
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 80,
      render: (v: string) => {
        const m = TYPE_MAP[v];
        return <Tag color={m?.color ?? 'default'}>{m?.label ?? v}</Tag>;
      },
    },
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '触发方式', dataIndex: 'trigger', key: 'trigger', width: 100,
      render: (v?: string) => v ? TRIGGER_LABELS[v] ?? v : '-',
    },
    {
      title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作', key: 'action', width: 80,
      render: (_: any, record: ChangelogEntry) => (
        <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <h3 style={{ margin: 0 }}>📋 变更日志</h3>
          <Select
            allowClear
            placeholder="类型过滤"
            style={{ width: 140 }}
            value={typeFilter}
            onChange={handleTypeFilterChange}
          >
            <Select.Option value="requirement">需求</Select.Option>
            <Select.Option value="optimization">优化</Select.Option>
            <Select.Option value="bug">Bug</Select.Option>
          </Select>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>
          新建
        </Button>
      </div>

      <Table
        dataSource={entries}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: 50,
          total,
          onChange: (p) => { setPage(p); fetchEntries(p); },
        }}
      />

      <Modal
        title="新建变更日志"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select placeholder="选择类型">
              <Select.Option value="requirement">需求</Select.Option>
              <Select.Option value="optimization">优化</Select.Option>
              <Select.Option value="bug">Bug</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="请输入标题" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={4} placeholder="请输入描述（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
