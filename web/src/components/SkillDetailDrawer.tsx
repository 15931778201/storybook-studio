import { useState, useEffect } from 'react';
import { Drawer, Descriptions, Tag, Table, Typography, Spin, Space, message } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SkillMetadata {
  name: string;
  title: string;
  description: string;
  version: string;
  author: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface SkillStep {
  id: string;
  order: number;
  tool: string;
  params: Record<string, any>;
  description: string;
}

interface SkillDetail {
  metadata: SkillMetadata;
  steps: SkillStep[];
  raw: string;
}

interface Props {
  name: string | null;
  onClose: () => void;
}

export default function SkillDetailDrawer({ name, onClose }: Props) {
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!name) { setDetail(null); return; }
    setLoading(true);
    fetch(`/api/skills/${encodeURIComponent(name)}`)
      .then(res => res.json())
      .then(data => setDetail(data))
      .catch(() => message.error('加载技能详情失败'))
      .finally(() => setLoading(false));
  }, [name]);

  const stepColumns = [
    { title: '#', dataIndex: 'order', key: 'order', width: 40 },
    { title: '工具', dataIndex: 'tool', key: 'tool' },
    {
      title: '参数',
      dataIndex: 'params',
      key: 'params',
      render: (params: Record<string, any>) => (
        <pre style={{ margin: 0, fontSize: 12, maxWidth: 300, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(params, null, 1)}
        </pre>
      ),
    },
    { title: '描述', dataIndex: 'description', key: 'description' },
  ];

  return (
    <Drawer
      title={detail ? `${detail.metadata.title} (${detail.metadata.name})` : '技能详情'}
      open={!!name}
      onClose={onClose}
      width={720}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
      ) : detail ? (
        <>
          <Typography.Title level={5}>元数据</Typography.Title>
          <Descriptions column={2} size="small" bordered style={{ marginBottom: 24 }}>
            <Descriptions.Item label="名称">{detail.metadata.name}</Descriptions.Item>
            <Descriptions.Item label="标题">{detail.metadata.title}</Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>{detail.metadata.description}</Descriptions.Item>
            <Descriptions.Item label="作者">{detail.metadata.author}</Descriptions.Item>
            <Descriptions.Item label="版本">{detail.metadata.version}</Descriptions.Item>
            <Descriptions.Item label="标签" span={2}>
              <Space wrap>{detail.metadata.tags?.map(t => <Tag key={t}>{t}</Tag>)}</Space>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">{detail.metadata.createdAt}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{detail.metadata.updatedAt}</Descriptions.Item>
          </Descriptions>

          <Typography.Title level={5}>步骤</Typography.Title>
          <Table
            dataSource={detail.steps}
            columns={stepColumns}
            rowKey="id"
            pagination={false}
            size="small"
            style={{ marginBottom: 24 }}
          />

          <Typography.Title level={5}>原始内容</Typography.Title>
          <div className="markdown-body" style={{ border: '1px solid #d9d9d9', borderRadius: 6, padding: 16 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {detail.raw}
            </ReactMarkdown>
          </div>
        </>
      ) : null}
    </Drawer>
  );
}
