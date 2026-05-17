import { useState, useEffect, useRef, useCallback } from 'react';
import { Table, Tag, Space, Select, Switch, Typography, Input, Button, Tabs, Segmented, message } from 'antd';
import { SearchOutlined, ClearOutlined, PauseCircleOutlined, PlayCircleOutlined, FolderOpenOutlined } from '@ant-design/icons';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  sessionId?: string;
  duration?: number;
  tokensUsed?: number;
  toolName?: string;
}

interface LogFileInfo {
  name: string;
  size: number;
  modifiedAt: string;
}

const LEVEL_ORDER = ['error', 'warn', 'info', 'debug'];
const LEVEL_COLOR: Record<string, string> = { info: 'blue', warn: 'orange', error: 'red', debug: 'default' };

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string[]>(['info', 'warn', 'error']);
  const [paused, setPaused] = useState(false);
  const [keyword, setKeyword] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentLevel, setCurrentLevel] = useState<string>('info');
  const [files, setFiles] = useState<LogFileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | undefined>(undefined);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [tabKey, setTabKey] = useState('realtime');

  useEffect(() => {
    const es = new EventSource('/api/logs/stream');
    es.onmessage = (event) => {
      try {
        const entry = JSON.parse(event.data);
        setLogs((prev) => [...prev.slice(-500), entry]);
      } catch {}
    };
    es.onerror = () => {};
    return () => es.close();
  }, []);

  useEffect(() => {
    if (!paused && containerRef.current && tabKey === 'realtime') {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, paused, tabKey]);

  useEffect(() => {
    fetch('/api/logs/level').then(r => r.json()).then(d => setCurrentLevel(d.level)).catch(() => {});
  }, []);

  const filtered = logs.filter((l) => {
    if (!filter.includes(l.level)) return false;
    if (keyword && !l.message.toLowerCase().includes(keyword.toLowerCase())) return false;
    return true;
  });

  const handleLevelChange = async (level: string) => {
    try {
      const res = await fetch('/api/logs/level', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level }),
      });
      if (res.ok) {
        setCurrentLevel(level);
        message.success(`日志级别已切换为 ${level.toUpperCase()}`);
      }
    } catch { message.error('设置失败'); }
  };

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/logs/files');
      setFiles(await res.json());
    } catch {}
  }, []);

  const fetchHistory = useCallback(async (pageNum = 1) => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), pageSize: '50' });
      if (selectedFile) params.set('file', selectedFile);
      if (keyword) params.set('keyword', keyword);
      const res = await fetch(`/api/logs/query?${params}`);
      const data = await res.json();
      setHistoryData(data.data || []);
      setHistoryTotal(data.total || 0);
      setHistoryPage(pageNum);
    } catch { message.error('查询失败'); }
    setHistoryLoading(false);
  }, [selectedFile, keyword]);

  useEffect(() => {
    if (tabKey === 'history') {
      fetchFiles();
      fetchHistory(1);
    }
  }, [tabKey, fetchFiles, fetchHistory]);

  const columns = [
    {
      title: '时间', dataIndex: 'timestamp', key: 'timestamp', width: 180,
      render: (v: string) => new Date(v).toLocaleTimeString(),
    },
    {
      title: '级别', dataIndex: 'level', key: 'level', width: 70,
      render: (v: string) => <Tag color={LEVEL_COLOR[v]}>{v.toUpperCase()}</Tag>,
    },
    { title: '消息', dataIndex: 'message', key: 'message', ellipsis: true },
    { title: '会话', dataIndex: 'sessionId', key: 'sessionId', width: 120, ellipsis: true },
    { title: '工具', dataIndex: 'toolName', key: 'toolName', width: 100, ellipsis: true },
    {
      title: '耗时/Tokens', key: 'meta', width: 120,
      render: (_: any, r: any) => (
        <Space size="small">
          {r.duration != null && <span>{r.duration}ms</span>}
          {r.tokensUsed != null && <Tag>{r.tokensUsed} tokens</Tag>}
        </Space>
      ),
    },
  ];

  const realtimeContent = (
    <div ref={containerRef} style={{ flex: 1, overflow: 'auto' }}>
      <Table
        dataSource={filtered}
        columns={columns}
        rowKey={(r) => `${r.timestamp}-${r.level}-${r.message.slice(0, 20)}`}
        size="small"
        pagination={false}
        sticky
      />
    </div>
  );

  const historyContent = (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <Table
        dataSource={historyData}
        columns={columns}
        rowKey={(r) => `${r.timestamp}-${historyPage}`}
        size="small"
        loading={historyLoading}
        pagination={{
          current: historyPage,
          total: historyTotal,
          pageSize: 50,
          onChange: fetchHistory,
          showTotal: (t) => `共 ${t} 条`,
        }}
        sticky
      />
    </div>
  );

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <Space>
          <Typography.Title level={4} style={{ margin: 0 }}>📋 日志管理</Typography.Title>
          <Segmented
            value={tabKey}
            onChange={(v) => setTabKey(v as string)}
            options={[
              { label: '实时日志', value: 'realtime' },
              { label: '历史查询', value: 'history' },
            ]}
          />
        </Space>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <Space wrap>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>筛选条件：</Typography.Text>
          {tabKey === 'realtime' && (
            <>
              <Select
                mode="multiple"
                value={filter}
                onChange={setFilter}
                options={LEVEL_ORDER.map(l => ({ label: l.toUpperCase(), value: l }))}
                style={{ width: 400 }}
                size="small"
              />
              <Input
                placeholder="搜索关键词..."
                prefix={<SearchOutlined />}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                style={{ width: 160 }}
                size="small"
                allowClear
              />
            </>
          )}
        </Space>
        <Space wrap>
          {tabKey === 'realtime' && (
            <>
              <Button
                icon={paused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
                onClick={() => setPaused(!paused)}
                size="small"
              >
                {paused ? '继续' : '暂停'}
              </Button>
              <Button icon={<ClearOutlined />} onClick={() => setLogs([])} size="small">清除</Button>
            </>
          )}
          {tabKey === 'history' && (
            <>
              <Select
                placeholder="选择日志文件"
                value={selectedFile}
                onChange={setSelectedFile}
                style={{ width: 200 }}
                size="small"
                allowClear
                options={files.map(f => ({
                  label: `${f.name} (${(f.size / 1024).toFixed(1)}KB)`,
                  value: f.name,
                }))}
              />
              <Input
                placeholder="搜索关键词..."
                prefix={<SearchOutlined />}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                style={{ width: 160 }}
                size="small"
                allowClear
              />
              <Button type="primary" icon={<SearchOutlined />} onClick={() => fetchHistory(1)} size="small">查询</Button>
            </>
          )}
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>全局级别：</Typography.Text>
          <Select
            value={currentLevel}
            onChange={handleLevelChange}
            style={{ width: 120 }}
            size="small"
            options={LEVEL_ORDER.map(l => ({ label: `${l.toUpperCase()}`, value: l }))}
          />
        </Space>
      </div>
      {tabKey === 'realtime' ? realtimeContent : historyContent}
    </div>
  );
}
