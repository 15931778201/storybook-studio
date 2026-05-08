import { useState, useEffect } from 'react';
import { Table, Button, message, Popconfirm, Tag, Space, Typography } from 'antd';
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
export default function SkillsPage() {
  const [skills, setSkills] = useState<any[]>([]); const [loading, setLoading] = useState(false);
  const fetchSkills = async () => { setLoading(true); try { const res = await fetch('/api/skills'); setSkills(await res.json()); } catch { message.error('加载失败'); } setLoading(false); };
  useEffect(() => { fetchSkills(); }, []);
  const del = async (name: string) => { await fetch('/api/skills/' + name, { method: 'DELETE' }); message.success('已删除'); fetchSkills(); };
  const cols = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '标签', dataIndex: 'tags', key: 'tags', render: (tags: string[]) => tags?.map(t => <Tag key={t}>{t}</Tag>) },
    { title: '步骤', dataIndex: 'stepCount', key: 'stepCount', width: 60 },
    { title: '操作', key: 'action', render: (_: any, r: any) => <Popconfirm title="确认删除？" onConfirm={() => del(r.name)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm> },
  ];
  return (
    <div style={{ padding: 24, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}><Typography.Title level={4} style={{ margin: 0 }}>🧩 技能管理</Typography.Title><Button icon={<ReloadOutlined />} onClick={fetchSkills} loading={loading}>刷新</Button></Space>
      <Table dataSource={skills} columns={cols} rowKey="name" loading={loading} pagination={false} />
    </div>
  );
}