import React, { useState, useEffect } from 'react';
import { Drawer, Tabs, Table, Button, Tag, message, Space } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';

interface SkillItem {
  name: string;
  title: string;
  description: string;
  author: string;
  tags: string[];
  stepsCount: number;
  installCount: number;
}

interface McpItem {
  name: string;
  package: string;
  description: string;
  command: string;
  args: string[];
}

interface PluginItem {
  name: string;
  description: string;
  author: string;
  version: string;
  type: string;
}

export default function MarketPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [mcps, setMcps] = useState<McpItem[]>([]);
  const [plugins, setPlugins] = useState<PluginItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [skillsRes, mcpRes, pluginsRes] = await Promise.all([
        fetch('/api/market/skills'),
        fetch('/api/market/mcp'),
        fetch('/api/market/plugins'),
      ]);
      setSkills(await skillsRes.json());
      setMcps(await mcpRes.json());
      setPlugins(await pluginsRes.json());
    } catch {
      message.error('加载市场数据失败');
    }
    setLoading(false);
  };
  useEffect(() => {
    if (open) fetchData();
  }, [open]);

  const installSkill = async (name: string) => {
    try {
      await fetch('/api/market/skills/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      message.success(`技能 ${name} 安装成功`);
    } catch { message.error('安装失败'); }
  };

  const installMcp = async (pkg: string) => {
    try {
      await fetch('/api/market/mcp/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package: pkg }),
      });
      message.success(`MCP ${pkg} 安装成功`);
    } catch { message.error('安装失败'); }
  };

  const installPlugin = async (name: string) => {
    try {
      await fetch('/api/market/plugins/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      message.success(`插件 ${name} 安装成功`);
    } catch { message.error('安装失败'); }
  };

  const skillColumns = [
    { title: '名称', dataIndex: 'title', key: 'title' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '作者', dataIndex: 'author', key: 'author' },
    { title: '步骤', dataIndex: 'stepsCount', key: 'stepsCount' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: SkillItem) => (
        <Button size="small" type="primary" icon={<DownloadOutlined />} onClick={() => installSkill(record.name)}>
          安装
        </Button>
      ),
    },
  ];

  const mcpColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '包名', dataIndex: 'package', key: 'package' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: McpItem) => (
        <Button size="small" type="primary" icon={<DownloadOutlined />} onClick={() => installMcp(record.package)}>
          安装
        </Button>
      ),
    },
  ];

  const pluginColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '作者', dataIndex: 'author', key: 'author' },
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: '类型', dataIndex: 'type', key: 'type', render: (t: string) => <Tag>{t}</Tag> },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: PluginItem) => (
        <Button size="small" type="primary" icon={<DownloadOutlined />} onClick={() => installPlugin(record.name)}>
          安装
        </Button>
      ),
    },
  ];

  return (
    <>
      <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>刷新</Button>  
      <Tabs items={[
        {
          key: 'skills',
          label: 'Skills 市场',
          children: (
            <Table dataSource={skills} columns={skillColumns} rowKey="name" size="small" pagination={false} loading={loading} />
          ),
        },
        {
          key: 'mcp',
          label: 'MCP 市场',
          children: (
            <Table dataSource={mcps} columns={mcpColumns} rowKey="name" size="small" pagination={false} loading={loading} />
          ),
        },
        {
          key: 'plugins',
          label: '插件市场',
          children: (
            <Table dataSource={plugins} columns={pluginColumns} rowKey="name" size="small" pagination={false} loading={loading} />
          ),
        },
      ]} />
    </>
  );
}