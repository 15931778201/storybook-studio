import { Button, Card, Input, List, Select, Segmented, Space, Statistic, Table, Tag, Typography } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useState } from 'react';

interface AuditItem {
  sessionId?: string;
  action?: string;
  status?: string;
  toolName?: string;
  reason?: string;
  output?: string;
  filePath?: string;
  timestamp?: string;
}

interface TimelineItem {
  timestamp?: string;
  kind: string;
  action?: string;
  status?: string;
  toolName?: string;
  summary?: string;
  filePath?: string;
}

export default function AuditPage() {
  const [mode, setMode] = useState<'table' | 'timeline'>('table');
  const [sessionId, setSessionId] = useState('');
  const [action, setAction] = useState<string | undefined>(undefined);
  const [toolName, setToolName] = useState('');
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [keyword, setKeyword] = useState('');
  const [items, setItems] = useState<AuditItem[]>([]);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [timelineSummary, setTimelineSummary] = useState({ allowed: 0, denied: 0, errors: 0 });
  const [loading, setLoading] = useState(false);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (sessionId.trim()) params.set('sessionId', sessionId.trim());
      if (action) params.set('action', action);
      if (toolName.trim()) params.set('toolName', toolName.trim());
      if (status) params.set('status', status);
      if (keyword.trim()) params.set('keyword', keyword.trim());
      const response = await fetch(`/api/logs/audit?${params.toString()}`);
      const data = await response.json();
      setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  }, [action, keyword, sessionId, status, toolName]);

  const fetchTimeline = useCallback(async () => {
    if (!sessionId.trim()) {
      setTimelineItems([]);
      setTimelineSummary({ allowed: 0, denied: 0, errors: 0 });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/logs/audit/timeline?sessionId=${encodeURIComponent(sessionId.trim())}`);
      const data = await response.json();
      setTimelineItems(data.items || []);
      setTimelineSummary(data.summary || { allowed: 0, denied: 0, errors: 0 });
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (mode === 'table') {
      fetchAudit().catch(() => {});
    } else {
      fetchTimeline().catch(() => {});
    }
  }, [fetchAudit, fetchTimeline, mode]);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>会话审计</Typography.Title>
        <Space>
          <Segmented
            value={mode}
            onChange={(value) => setMode(value as 'table' | 'timeline')}
            options={[
              { label: '审计列表', value: 'table' },
              { label: '时间线回放', value: 'timeline' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => mode === 'table' ? fetchAudit() : fetchTimeline()} loading={loading}>刷新</Button>
        </Space>
      </div>

      <Space wrap>
        <Input
          placeholder="会话 ID"
          value={sessionId}
          onChange={(event) => setSessionId(event.target.value)}
          style={{ width: 180 }}
        />
        <Select
          allowClear
          placeholder="动作"
          value={action}
          onChange={setAction}
          style={{ width: 140 }}
          options={[
            { label: 'allowed', value: 'allowed' },
            { label: 'denied', value: 'denied' },
            { label: 'apply', value: 'apply' },
            { label: 'rollback', value: 'rollback' },
          ]}
        />
        <Input
          placeholder="工具名"
          value={toolName}
          onChange={(event) => setToolName(event.target.value)}
          style={{ width: 160 }}
        />
        <Select
          allowClear
          placeholder="状态"
          value={status}
          onChange={setStatus}
          style={{ width: 140 }}
          options={[
            { label: 'done', value: 'done' },
            { label: 'denied', value: 'denied' },
            { label: 'error', value: 'error' },
          ]}
        />
        <Input
          placeholder="关键词"
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          style={{ width: 220 }}
        />
        <Button type="primary" onClick={() => mode === 'table' ? fetchAudit() : fetchTimeline()} loading={loading}>查询</Button>
      </Space>

      {mode === 'table' ? (
      <Table
        rowKey={(item, index) => `${item.timestamp || 'none'}-${item.sessionId || 'session'}-${index}`}
        loading={loading}
        dataSource={items}
        pagination={{ pageSize: 50, showSizeChanger: false }}
        columns={[
          {
            title: '时间',
            dataIndex: 'timestamp',
            width: 180,
            render: (value: string) => value ? new Date(value).toLocaleString() : '-',
          },
          { title: '会话', dataIndex: 'sessionId', width: 140, ellipsis: true },
          {
            title: '动作',
            dataIndex: 'action',
            width: 100,
            render: (value: string) => <Tag color={value === 'denied' ? 'red' : 'blue'}>{value || '-'}</Tag>,
          },
          {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (value: string) => <Tag color={value === 'error' ? 'red' : value === 'denied' ? 'orange' : 'green'}>{value || '-'}</Tag>,
          },
          { title: '工具', dataIndex: 'toolName', width: 160 },
          { title: '文件', dataIndex: 'filePath', width: 220, ellipsis: true },
          {
            title: '详情',
            key: 'detail',
            render: (_, record: AuditItem) => (
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {record.reason || record.output || '-'}
              </div>
            ),
          },
        ]}
      />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Space>
            <Card size="small"><Statistic title="允许" value={timelineSummary.allowed} /></Card>
            <Card size="small"><Statistic title="拒绝" value={timelineSummary.denied} /></Card>
            <Card size="small"><Statistic title="错误" value={timelineSummary.errors} /></Card>
          </Space>
          <Card size="small" title="会话时间线">
            <List
              loading={loading}
              locale={{ emptyText: sessionId.trim() ? '暂无时间线' : '请输入会话 ID 查询回放' }}
              dataSource={timelineItems}
              renderItem={(item) => (
                <List.Item>
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                      <Tag color={item.kind === 'tool' ? 'blue' : item.kind.includes('confirm') ? 'orange' : 'default'}>
                        {item.kind}
                      </Tag>
                      {item.toolName ? <Tag>{item.toolName}</Tag> : null}
                      {item.status ? <Tag color={item.status === 'error' ? 'red' : item.status === 'denied' ? 'orange' : 'green'}>{item.status}</Tag> : null}
                      <Typography.Text type="secondary">
                        {item.timestamp ? new Date(item.timestamp).toLocaleString() : '-'}
                      </Typography.Text>
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {item.summary || item.filePath || '-'}
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
