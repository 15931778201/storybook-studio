import { useState, useEffect, useRef } from 'react';
import { Table, Tag, Space, Select, Switch, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  sessionId?: string;
  duration?: number;
  tokensUsed?: number;
  toolName?: string;
}

const levelColor: Record<string, string> = {
  info: 'blue',
  warn: 'orange',
  error: 'red',
  debug: 'default',
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string[]>(['info', 'warn', 'error']);
  const [paused, setPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource('/api/logs/stream');
    es.onmessage = (event) => {
      try {
        const entry = JSON.parse(event.data);
        setLogs((prev) => [...prev.slice(-500), entry]); // 保留最近 500 条
      } catch {}
    };
    es.onerror = () => {}; // 静默重连
    return () => es.close();
  }, []);

  useEffect(() => {
    if (!paused && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, paused]);

  const filtered = logs.filter((l) => filter.includes(l.level));

  const columns: ColumnsType<LogEntry> = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (v: string) => new Date(v).toLocaleTimeString(),
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 70,
      render: (v: string) => <Tag color={levelColor[v]}>{v.toUpperCase()}</Tag>,
    },
    { title: '消息', dataIndex: 'message', key: 'message', ellipsis: true },
    { title: '会话', dataIndex: 'sessionId', key: 'sessionId', width: 120, ellipsis: true },
    { title: '工具', dataIndex: 'toolName', key: 'toolName', width: 100, ellipsis: true },
    {
      title: '耗时/Tokens',
      key: 'meta',
      width: 120,
      render: (_, r) => (
        <Space size="small">
          {r.duration != null && <span>{r.duration}ms</span>}
          {r.tokensUsed != null && <Tag>{r.tokensUsed} tokens</Tag>}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <Space>
          <Typography.Title level={4} style={{ margin: 0 }}>📋 实时日志</Typography.Title>
          <Select
            mode="multiple"
            value={filter}
            onChange={setFilter}
            options={[
              { label: 'INFO', value: 'info' },
              { label: 'WARN', value: 'warn' },
              { label: 'ERROR', value: 'error' },
              { label: 'DEBUG', value: 'debug' },
            ]}
            style={{ width: 200 }}
          />
        </Space>
        <Space>
          <span>暂停滚动</span>
          <Switch checked={paused} onChange={setPaused} />
        </Space>
      </div>
      <div ref={containerRef} style={{ flex: 1, overflow: 'auto' }}>
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey={(_, i) => String(i)}
          size="small"
          pagination={false}
          sticky
        />
      </div>
    </div>
  );
}