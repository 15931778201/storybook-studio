import React, { useState, useEffect } from 'react';
import { Drawer, Table, Tag, Button, Space, Typography, Popconfirm, message } from 'antd';
import { CodeOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';

interface SkillInfo {
  name: string;
  title: string;
  description: string;
  tags: string[];
  stepCount: number;
  version: string;
}

export default function SkillPanel({ open }: { open: boolean }) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchSkills = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/skills');
      const data = await res.json();
      setSkills(data);
    } catch {
      message.error('加载技能列表失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchSkills();
  }, [open]);

  const handleDelete = async (name: string) => {
    try {
      await fetch(`/api/skills/${name}`, { method: 'DELETE' });
      message.success(`技能 ${name} 已删除`);
      fetchSkills();
    } catch {
      message.error('删除失败');
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => tags.map(t => <Tag key={t}>{t}</Tag>),
    },
    { title: '步骤', dataIndex: 'stepCount', key: 'stepCount', width: 60 },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: SkillInfo) => (
        <Space>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.name)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Button icon={<ReloadOutlined />} onClick={fetchSkills} loading={loading}>
          刷新
        </Button>
      <Typography.Paragraph type="secondary">
        技能是预定义的工具调用序列。Agent 可以通过 <Tag>call_skill</Tag> 工具调用它们。
        你也可以对 Agent 说"创建一个 XX 技能"来让 Agent 自动生成。
      </Typography.Paragraph>
      <Table
        dataSource={skills}
        columns={columns}
        rowKey="name"
        loading={loading}
        size="small"
        pagination={false}
      />  
    </>
  );
}