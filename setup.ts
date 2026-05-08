#!/usr/bin/env bun
/**
 * AgentKit 多路由前端脚手架 v2.0
 * 包含：会话管理、工作区、角色管理、多层路由
 * 运行: bun run setup.ts
 */
import fs from 'fs';
import path from 'path';

const webRoot = path.join(process.cwd(), 'web');

const FILES: Record<string, string> = {
  // ================= 项目配置 =================
  'package.json': JSON.stringify({
    name: 'agentkit-web',
    private: true,
    type: 'module',
    scripts: { dev: 'vite', build: 'tsc && vite build' },
    dependencies: {
      '@ant-design/x': '^2.7.0',
      '@ant-design/x-markdown': '^2.7.0',
      antd: '^6.0.0',
      react: '^18.2.0',
      'react-dom': '^18.2.0',
      'react-router-dom': '^6.20.0',
      'react-markdown': '^9.0.0',
      'remark-gfm': '^4.0.0',
      'rehype-highlight': '^7.0.0',
      'highlight.js': '^11.9.0',
      'dompurify': '^3.0.0',
      '@monaco-editor/react': '^4.6.0',
    },
    devDependencies: {
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
      '@vitejs/plugin-react': '^4.2.0',
      typescript: '^5.3.0',
      vite: '^5.0.0',
    },
  }, null, 2),

  'vite.config.ts': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
});`,

  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      target: 'ES2020', lib: ['ES2020', 'DOM', 'DOM.Iterable'], module: 'ESNext',
      skipLibCheck: true, moduleResolution: 'bundler', allowImportingTsExtensions: true,
      resolveJsonModule: true, isolatedModules: true, noEmit: true, jsx: 'react-jsx', strict: true,
    },
    include: ['src', 'vite-env.d.ts'],
  }, null, 2),

  'vite-env.d.ts': '/// <reference types="vite/client" />',

  'index.html': `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AgentKit</title>
  <link rel="preload" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
</head>
<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>`,

  // ================= 入口 =================
  'src/main.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './App.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>
);`,

  // ================= 主布局（路由 + 侧边栏 + 工作区 + 角色） =================
  'src/App.tsx': `import { useState, useCallback, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Layout, ConfigProvider, theme as antTheme, Button, Tooltip, Space, Menu } from 'antd';
import { SunOutlined, MoonOutlined, MessageOutlined, AppstoreOutlined, ShoppingOutlined, SettingOutlined, BookOutlined } from '@ant-design/icons';
import { XProvider } from '@ant-design/x';
import { ChatProvider, useChatContext } from './providers/ChatProvider';
import Sidebar from './components/Sidebar';
import WorkspaceTabs from './components/WorkspaceTabs';
import RoleSelector from './components/RoleSelector';
import ChatPage from './pages/ChatPage';
import SkillsPage from './pages/SkillsPage';
import MarketPage from './pages/MarketPage';
import SettingsPage from './pages/SettingsPage';
import KnowledgePage from './pages/KnowledgePage';
import './App.css';

const { Sider, Content, Header } = Layout;

function AppInner() {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const { workspaces, activeWorkspaceId, setActiveWorkspaceId, addWorkspace, activeRole, setActiveRole } = useChatContext();
  const { token } = antTheme.useToken();
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const toggleTheme = useCallback(() => setIsDark(prev => !prev), []);

  const navItems = [
    { key: '/', icon: <MessageOutlined />, label: '对话' },
    { key: '/skills', icon: <AppstoreOutlined />, label: '技能' },
    { key: '/market', icon: <ShoppingOutlined />, label: '市场' },
    { key: '/knowledge', icon: <BookOutlined />, label: '知识库' },
    { key: '/settings', icon: <SettingOutlined />, label: '设置' },
  ];

  return (
    <Layout style={{ height: '100vh' }}>
      {sidebarOpen && (
        <Sider width={280} style={{ background: token.colorBgElevated, borderRight: \`1px solid \${token.colorBorderSecondary}\`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px', fontWeight: 'bold', fontSize: 16, borderBottom: \`1px solid \${token.colorBorderSecondary}\` }}>
            🤖 AgentKit
          </div>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={navItems}
            onClick={({ key }) => navigate(key)}
            style={{ background: 'transparent', borderRight: 0, marginTop: 8 }}
          />
          <div style={{ flex: 1, overflow: 'auto', borderTop: \`1px solid \${token.colorBorderSecondary}\`, marginTop: 8, padding: '8px 0' }}>
            <Sidebar />
          </div>
        </Sider>
      )}

      <Layout>
        <Header style={{ background: token.colorBgContainer, borderBottom: \`1px solid \${token.colorBorderSecondary}\`, display: 'flex', alignItems: 'center', padding: '0 16px', height: 56 }}>
          <Button type="text" onClick={() => setSidebarOpen(!sidebarOpen)} style={{ fontSize: 18, marginRight: 12 }}>☰</Button>
          <h3 style={{ margin: 0, minWidth: 100 }}>AgentKit</h3>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <WorkspaceTabs />
          </div>
          <Space style={{ marginLeft: 16 }}>
            <RoleSelector activeRole={activeRole} onSelectRole={setActiveRole} />
            <Tooltip title={isDark ? '切换亮色模式' : '切换暗色模式'}>
              <Button type="text" icon={isDark ? <SunOutlined /> : <MoonOutlined />} onClick={toggleTheme} />
            </Tooltip>
          </Space>
        </Header>

        <Content style={{ overflow: 'auto', padding: 0, display: 'flex', flexDirection: 'column' }}>
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/skills" element={<SkillsPage />} />
            <Route path="/market" element={<MarketPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default function App() {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  return (
    <ConfigProvider theme={{ algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm, token: { borderRadius: 8 } }}>
      <XProvider>
        <ChatProvider><AppInner /></ChatProvider>
      </XProvider>
    </ConfigProvider>
  );
}`,

  // ================= 全局样式 =================
  'src/App.css': `body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
:root { --border-color: #eee; }
.dark { --border-color: #333; }
.app-loading { display: flex; align-items: center; justify-content: center; height: 100vh; }
.code-block { background: #1e1e1e; color: #d4d4d4; padding: 12px; border-radius: 8px; overflow-x: auto; }
.dark .code-block { border: 1px solid #444; }`,

  // ================= Providers（会话/消息/角色/工作区） =================
  'src/providers/ChatProvider.tsx': `import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
export interface ChatMessage { id: string; role: 'user' | 'assistant' | 'system' | 'thinking'; content: string; timestamp?: number; steps?: any[]; imageBase64?: string; }
export interface ConfirmRequest { toolCallId: string; toolName: string; args: any; diff: string; }
export interface Workspace { id: string; name: string; projectPath: string; }
interface ChatContextValue {
  messages: ChatMessage[]; setMessages: (v: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  sendMessage: (text: string, image?: string | null) => void; isRequesting: boolean; abort: () => void;
  activeConversationId: string; setActiveConversationId: (id: string) => void;
  confirmRequest: ConfirmRequest | null; resolveConfirm: (approved: boolean) => void;
  workspaces: Workspace[]; activeWorkspaceId: string; setActiveWorkspaceId: (id: string) => void; addWorkspace: (n: string, p: string) => void;
  activeRole: any | null; setActiveRole: (r: any | null) => void;
}
const ChatContext = createContext<ChatContextValue>(null!);
export function useChatContext() { return useContext(ChatContext); }
function safeString(v: any): string { if (typeof v === 'string') return v; if (v && typeof v === 'object') return v.text ?? v.message ?? JSON.stringify(v); return String(v ?? ''); }

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [activeConversationId, setActiveConversationId] = useState('conv-' + Date.now());
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('default');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([{ id: 'default', name: '默认工作区', projectPath: '.' }]);
  const [activeRole, setActiveRole] = useState<any | null>(null);
  const [messageStore, setMessageStore] = useState<Record<string, ChatMessage[]>>({});
  const currentKey = activeWorkspaceId + ':' + activeConversationId;
  const messages = messageStore[currentKey] || [];
  const updateMessages = (updater: (prev: ChatMessage[]) => ChatMessage[]) => setMessageStore(prev => ({ ...prev, [currentKey]: updater(prev[currentKey] || []) }));
  const setMessages = (action: any) => updateMessages(prev => typeof action === 'function' ? action(prev) : action);
  const [isRequesting, setIsRequesting] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const confirmResolverRef = useRef<((b: boolean) => void) | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const thinkingIdRef = useRef<string | null>(null);
  const abort = () => { esRef.current?.close(); setIsRequesting(false); };
  const resolveConfirm = (approved: boolean) => {
    if (confirmResolverRef.current) { confirmResolverRef.current(approved); confirmResolverRef.current = null; }
    fetch('/api/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: activeConversationId, approved }) }).catch(console.error);
    setConfirmRequest(null);
  };
  const addWorkspace = (name: string, projectPath: string) => {
    const ws: Workspace = { id: 'ws-' + Date.now(), name, projectPath };
    setWorkspaces(prev => [...prev, ws]);
    setActiveWorkspaceId(ws.id);
  };

  const sendMessage = useCallback((text: string, image?: string | null) => {
    if (!text.trim() || isRequesting) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text.trim(), timestamp: Date.now(), imageBase64: image || undefined };
    updateMessages(prev => [...prev, userMsg]); setIsRequesting(true);
    const thinkId = crypto.randomUUID(); thinkingIdRef.current = thinkId;
    const thinkMsg: ChatMessage = { id: thinkId, role: 'thinking', content: '思考中…', steps: [], timestamp: Date.now() };
    updateMessages(prev => [...prev, thinkMsg]);
    const params = new URLSearchParams({ input: text });
    if (activeRole) params.append('role', JSON.stringify(activeRole));
    if (image) params.append('image', 'true');
    const url = '/api/stream/' + activeConversationId + '?' + params.toString();
    const es = new EventSource(url); esRef.current = es;
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data); const content = safeString(data.content);
        switch (data.type) {
          case 'text': updateMessages(prev => { const last = prev[prev.length - 1]; if (last && last.role === 'assistant') return [...prev.slice(0, -1), { ...last, content: last.content + content }]; else return [...prev, { id: crypto.randomUUID(), role: 'assistant', content, timestamp: Date.now() }]; }); break;
          case 'tool-start': updateMessages(prev => prev.map(m => { if (m.id !== thinkingIdRef.current) return m; const step = { id: crypto.randomUUID(), toolName: data.toolName, args: data.args, result: '', status: 'running' }; return { ...m, steps: [...(m.steps || []), step] }; })); break;
          case 'tool-end': updateMessages(prev => prev.map(m => { if (m.id !== thinkingIdRef.current) return m; return { ...m, steps: (m.steps || []).map((s: any) => s.toolName === data.toolName && s.status === 'running' ? { ...s, result: data.result, status: data.status || 'done' } : s) }; })); break;
          case 'confirm': setConfirmRequest({ toolCallId: data.toolCallId, toolName: data.toolName, args: data.args, diff: safeString(data.diff) }); break;
          case 'final': updateMessages(prev => prev.filter(m => m.id !== thinkingIdRef.current && m.role !== 'assistant').concat({ id: crypto.randomUUID(), role: 'assistant', content, timestamp: Date.now() })); es.close(); setIsRequesting(false); break;
          case 'error': updateMessages(prev => prev.filter(m => m.id !== thinkingIdRef.current).concat({ id: crypto.randomUUID(), role: 'system', content: '错误: ' + content, timestamp: Date.now() })); es.close(); setIsRequesting(false); break;
        }
      } catch { }
    };
    es.onerror = () => { es.close(); setIsRequesting(false); };
  }, [activeConversationId, activeRole, isRequesting, updateMessages]);

  useEffect(() => { setIsRequesting(false); }, [activeConversationId, activeWorkspaceId]);

  return (
    <ChatContext.Provider value={{ messages, setMessages, sendMessage, isRequesting, abort, activeConversationId, setActiveConversationId, confirmRequest, resolveConfirm, workspaces, activeWorkspaceId, setActiveWorkspaceId, addWorkspace, activeRole, setActiveRole }}>
      {children}
    </ChatContext.Provider>
  );
}`,

  // ================= 页面组件 =================
  'src/pages/ChatPage.tsx': `import { lazy, Suspense } from 'react';
import ChatLayout from '../components/ChatLayout';
const ConfirmDialog = lazy(() => import('../components/ConfirmDialog'));
import { useChatContext } from '../providers/ChatProvider';
import { useConfirm } from '../hooks/useConfirm';
export default function ChatPage() {
  const { confirmRequest } = useChatContext();
  const { handleConfirm, handleReject } = useConfirm();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ChatLayout />
      {confirmRequest && (
        <Suspense fallback={<div>加载中...</div>}>
          <ConfirmDialog toolName={confirmRequest.toolName} diff={confirmRequest.diff} onConfirm={handleConfirm} onReject={handleReject} />
        </Suspense>
      )}
    </div>
  );
}`,

  'src/pages/SkillsPage.tsx': `import { useState, useEffect } from 'react';
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
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}><Typography.Title level={4} style={{ margin: 0 }}>🧩 技能管理</Typography.Title><Button icon={<ReloadOutlined />} onClick={fetchSkills} loading={loading}>刷新</Button></Space>
      <Table dataSource={skills} columns={cols} rowKey="name" loading={loading} pagination={false} />
    </div>
  );
}`,

  'src/pages/MarketPage.tsx': `import { useState, useEffect } from 'react';
import { Tabs, Table, Button, Tag, message, Space, Typography } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
export default function MarketPage() {
  const [skills, setSkills] = useState<any[]>([]); const [mcps, setMcps] = useState<any[]>([]); const [loading, setLoading] = useState(false);
  const fetch = async () => { setLoading(true); try { const [s, m] = await Promise.all([fetch('/api/market/skills'), fetch('/api/market/mcp')]); setSkills(await s.json()); setMcps(await m.json()); } catch { } setLoading(false); };
  useEffect(() => { fetch(); }, []);
  const installSkill = async (name: string) => { await fetch('/api/market/skills/install', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); message.success('安装成功'); };
  const installMcp = async (pkg: string) => { await fetch('/api/market/mcp/install', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ package: pkg }) }); message.success('安装成功'); };
  const skillCols = [{ title: '名称', dataIndex: 'title' }, { title: '描述', dataIndex: 'description', ellipsis: true }, { title: '标签', dataIndex: 'tags', render: (t: string[]) => t?.map(x => <Tag key={x}>{x}</Tag>) }, { title: '操作', render: (_: any, r: any) => <Button size="small" type="primary" icon={<DownloadOutlined />} onClick={() => installSkill(r.name)}>安装</Button> }];
  const mcpCols = [{ title: '名称', dataIndex: 'name' }, { title: '包名', dataIndex: 'package' }, { title: '描述', dataIndex: 'description', ellipsis: true }, { title: '操作', render: (_: any, r: any) => <Button size="small" type="primary" icon={<DownloadOutlined />} onClick={() => installMcp(r.package)}>安装</Button> }];
  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}><Typography.Title level={4} style={{ margin: 0 }}>🛒 市场</Typography.Title><Button icon={<ReloadOutlined />} onClick={fetch} loading={loading}>刷新</Button></Space>
      <Tabs items={[{ key: 'skills', label: 'Skills', children: <Table dataSource={skills} columns={skillCols} rowKey="name" pagination={false} loading={loading} /> }, { key: 'mcp', label: 'MCP', children: <Table dataSource={mcps} columns={mcpCols} rowKey="name" pagination={false} loading={loading} /> }]} />
    </div>
  );
}`,

  'src/pages/SettingsPage.tsx': `import { useState } from 'react';
import { Form, Input, InputNumber, Button, Card, message, Typography, Space } from 'antd';
import { loadModelConfig, saveModelConfig, ModelConfig } from '../types/models';
export default function SettingsPage() {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const handleSave = () => {
    form.validateFields().then((values: ModelConfig) => {
      saveModelConfig(values); message.success('配置已保存'); setSaving(false);
    });
  };
  const load = () => { form.setFieldsValue(loadModelConfig()); };
  useState(() => { load(); });
  return (
    <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <Typography.Title level={4}>⚙️ 设置</Typography.Title>
      <Card title="模型配置" style={{ marginBottom: 24 }}>
        <Form form={form} layout="vertical">
          <Form.Item name="model" label="模型名称" rules={[{ required: true }]}><Input placeholder="gpt-4o" /></Form.Item>
          <Form.Item name="apiKey" label="API Key（留空使用环境变量）"><Input.Password placeholder="sk-..." /></Form.Item>
          <Form.Item name="baseURL" label="Base URL"><Input placeholder="https://api.openai.com/v1" /></Form.Item>
          <Space size="large">
            <Form.Item name="temperature" label="温度" rules={[{ required: true }]}><InputNumber min={0} max={2} step={0.1} /></Form.Item>
            <Form.Item name="maxTokens" label="最大 Tokens" rules={[{ required: true }]}><InputNumber min={100} max={128000} step={100} /></Form.Item>
          </Space>
          <Button type="primary" onClick={handleSave} loading={saving}>保存</Button>
        </Form>
      </Card>
      <Card title="关于 AgentKit">
        <Typography.Paragraph>AgentKit v0.1.0 — 企业级 AI Agent 开发框架。</Typography.Paragraph>
      </Card>
    </div>
  );
}`,

  'src/pages/KnowledgePage.tsx': `import { useState } from 'react';
import { Upload, message, Card, Typography } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
const { Dragger } = Upload;
export default function KnowledgePage() {
  const [indexing, setIndexing] = useState(false);
  const props = {
    name: 'files', multiple: true, action: '/api/rag/upload',
    onChange(info: any) { if (info.file.status === 'done') { message.success(info.file.name + ' 上传成功'); setIndexing(true); setTimeout(() => setIndexing(false), 2000); } else if (info.file.status === 'error') message.error(info.file.name + ' 上传失败'); },
    showUploadList: false, accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.md,.csv,.ts,.tsx,.js,.py,.java,.c,.cpp,.h,.go,.rs,.vue,.css,.html,.sh,.sql',
  };
  return (
    <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <Typography.Title level={4}>📚 知识库</Typography.Title>
      <Card>
        <Dragger {...props} style={{ padding: 20 }}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击或拖拽文件上传</p>
          <p className="ant-upload-hint">支持 PDF、Word、Excel、PPT、ZIP、代码文件等</p>
        </Dragger>
        {indexing && <Typography.Text type="secondary" style={{ display: 'block', marginTop: 12 }}>正在索引文档…</Typography.Text>}
      </Card>
    </div>
  );
}`,

  // ================= 核心组件 =================
  'src/components/ChatLayout.tsx': `import { useCallback, useEffect, useRef, useState } from 'react';
import { Bubble, Sender } from '@ant-design/x';
import { XMarkdown } from '@ant-design/x-markdown';
import rehypeHighlight from 'rehype-highlight';
import { Button, Tooltip, message, Space } from 'antd';
import { CopyOutlined, RedoOutlined, StopOutlined, EditOutlined, ExportOutlined } from '@ant-design/icons';
import { useChatContext } from '../providers/ChatProvider';
import ImageUpload from './ImageUpload';

export default function ChatLayout() {
  const { messages, sendMessage, isRequesting, abort } = useChatContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputVal, setInputVal] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const handleSubmit = useCallback((text: string) => { sendMessage(text, imageBase64); setInputVal(''); setImageBase64(null); }, [sendMessage, imageBase64]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);
  useEffect(() => { (document.querySelector('.ant-sender-input') as HTMLElement)?.focus(); }, []);

  const items = messages.filter(m => m.role !== 'thinking').map(msg => ({
    key: msg.id, role: msg.role, placement: (msg.role === 'user' ? 'end' : 'start') as 'end' | 'start',
    content: msg.content, avatar: msg.role === 'user' ? '👤' : '🤖',
    footer: <Space size="small">
      {msg.role === 'user' ? <>
        <Tooltip title="编辑"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => { setInputVal(msg.content); }} /></Tooltip>
        <Tooltip title="重发"><Button type="text" size="small" icon={<RedoOutlined />} onClick={() => sendMessage(msg.content)} /></Tooltip>
      </> : <>
        <Tooltip title="复制"><Button type="text" size="small" icon={<CopyOutlined />} onClick={async () => { await navigator.clipboard.writeText(msg.content); message.success('已复制'); }} /></Tooltip>
        <Tooltip title="导出"><Button type="text" size="small" icon={<ExportOutlined />} onClick={() => { const blob = new Blob([msg.content], { type: 'text/markdown' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'agent-answer.md'; a.click(); }} /></Tooltip>
      </>}
    </Space>,
  }));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        {items.length === 0 && !isRequesting && <div style={{ textAlign: 'center', paddingTop: 60, opacity: 0.6 }}><h2>👋 准备开始</h2><p>输入任务并与 Agent 对话</p></div>}
        <Bubble.List items={items} style={{ maxWidth: 800, margin: '0 auto' }} contentRender={(c: string) => <XMarkdown content={c} rehypePlugins={[rehypeHighlight]} />} />
      </div>
      <div style={{ padding: '0 24px' }}><ImageUpload onImageReady={setImageBase64} onClear={() => setImageBase64(null)} disabled={isRequesting} /></div>
      <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border-color)', maxWidth: 800, margin: '0 auto', width: '100%', display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}><Sender value={inputVal} onChange={setInputVal} loading={isRequesting} placeholder="输入任务… (Enter 发送)" onSubmit={handleSubmit} /></div>
        {isRequesting && <Tooltip title="停止生成"><Button danger icon={<StopOutlined />} onClick={abort} size="large" /></Tooltip>}
      </div>
    </div>
  );
}`,

  'src/components/ImageUpload.tsx': `import { useState } from 'react';
import { Upload, Button, message, Image } from 'antd';
import { PictureOutlined, DeleteOutlined } from '@ant-design/icons';
export default function ImageUpload({ onImageReady, onClear, disabled }: { onImageReady: (b64: string) => void; onClear: () => void; disabled?: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);
  const handleUpload = async (file: File) => {
    const fd = new FormData(); fd.append('image', file);
    const res = await fetch('/api/upload/image', { method: 'POST', body: fd }); const data = await res.json();
    if (data.success) { setPreview(data.dataUri); onImageReady(data.dataUri.split(',')[1]); message.success('已上传'); } else message.error('失败');
    return false;
  };
  const clear = () => { setPreview(null); onClear(); };
  return (
    <div style={{ padding: '8px 0' }}>
      {preview ? <div style={{ position: 'relative', display: 'inline-block' }}><Image src={preview} width={100} height={100} style={{ borderRadius: 8, objectFit: 'cover' }} /><Button size="small" danger icon={<DeleteOutlined />} onClick={clear} style={{ position: 'absolute', top: -8, right: -8, borderRadius: '50%' }} /></div>
        : <Upload beforeUpload={handleUpload} showUploadList={false} accept="image/*" disabled={disabled}><Button icon={<PictureOutlined />} disabled={disabled}>上传图片</Button></Upload>}
    </div>
  );
}`,

  'src/components/ConfirmDialog.tsx': `import { lazy, Suspense } from 'react';
import { Modal, Button } from 'antd';
const DiffEditor = lazy(() => import('./DiffEditor'));
export default function ConfirmDialog({ toolName, diff, onConfirm, onReject }: { toolName: string; diff: string; onConfirm: () => void; onReject: () => void }) {
  const parseDiff = (d: string) => { const o: string[] = [], m: string[] = []; d.split('\\n').forEach(l => { if (l.startsWith('-')) o.push(l.slice(1)); else if (l.startsWith('+')) m.push(l.slice(1)); else { o.push(l); m.push(l); } }); return { original: o.join('\\n'), modified: m.join('\\n') }; };
  const { original, modified } = parseDiff(diff);
  return (
    <Modal title={'确认执行修改 - ' + toolName} open onCancel={onReject} footer={<><Button onClick={onReject}>拒绝</Button><Button type="primary" onClick={onConfirm}>确认执行</Button></>} width={900}>
      <Suspense fallback={<div>加载差异编辑器...</div>}><DiffEditor original={original} modified={modified} /></Suspense>
    </Modal>
  );
}`,

  'src/components/DiffEditor.tsx': `import { DiffEditor } from '@monaco-editor/react';
export default function CodeDiffEditor({ original, modified }: { original: string; modified: string }) {
  return <DiffEditor height="400px" language="text" original={original} modified={modified} theme="vs-dark" options={{ readOnly: true, renderSideBySide: true, minimap: { enabled: false } }} />;
}`,

  // ================= 会话列表侧边栏组件（Conversations） =================
  'src/components/Sidebar.tsx': `import { Conversations } from '@ant-design/x';
import { useCallback, useState } from 'react';
import { useChatContext } from '../providers/ChatProvider';

export default function Sidebar() {
  const { activeConversationId, setActiveConversationId, setMessages } = useChatContext();
  const [items, setItems] = useState([{ key: activeConversationId, label: '默认对话' }]);

  const handleCreate = useCallback(() => {
    const newKey = 'conv-' + Date.now();
    setItems(prev => [{ key: newKey, label: '新对话' }, ...prev]);
    setActiveConversationId(newKey);
    setMessages([]);
  }, [setActiveConversationId, setMessages]);

  const handleDelete = useCallback((key: string) => {
    setItems(prev => prev.filter(i => i.key !== key));
    if (key === activeConversationId) {
      const remaining = items.filter(i => i.key !== key);
      if (remaining.length > 0) setActiveConversationId(remaining[0].key);
    }
  }, [activeConversationId, items, setActiveConversationId]);

  return (
    <Conversations
      items={items}
      activeKey={activeConversationId}
      onActiveChange={setActiveConversationId}
      creation={{ onClick: handleCreate }}
      style={{ height: '100%' }}
      menu={(item) => ({
        items: [
          { label: '删除', key: 'delete', danger: true, onClick: () => handleDelete(item.key) },
        ],
      })}
    />
  );
}`,

  // ================= 工作区标签组件 =================
  'src/components/WorkspaceTabs.tsx': `import { Tabs, Button, Modal, Input, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useChatContext } from '../providers/ChatProvider';

export default function WorkspaceTabs() {
  const { workspaces, activeWorkspaceId, setActiveWorkspaceId, addWorkspace } = useChatContext();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');

  const handleAdd = () => {
    if (newName.trim() && newPath.trim()) {
      addWorkspace(newName.trim(), newPath.trim());
      message.success('工作区已添加');
      setNewName(''); setNewPath(''); setShowAdd(false);
    }
  };

  return (
    <>
      <Tabs
        activeKey={activeWorkspaceId}
        onChange={setActiveWorkspaceId}
        type="editable-card"
        hideAdd
        size="small"
        items={workspaces.map(ws => ({
          key: ws.id,
          label: ws.name,
          closable: ws.id !== 'default',
        }))}
        tabBarExtraContent={
          <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => setShowAdd(true)} />
        }
        style={{ margin: 0, '.ant-tabs-nav': { marginBottom: 0 } }}
      />
      <Modal title="添加工作区" open={showAdd} onOk={handleAdd} onCancel={() => setShowAdd(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input placeholder="工作区名称" value={newName} onChange={e => setNewName(e.target.value)} />
          <Input placeholder="项目路径" value={newPath} onChange={e => setNewPath(e.target.value)} />
        </div>
      </Modal>
    </>
  );
}`,

  // ================= 角色选择器组件 =================
  'src/components/RoleSelector.tsx': `import { useState } from 'react';
import { Dropdown, Button, Modal, Form, Input, Space, message, Tag } from 'antd';
import { UserOutlined, PlusOutlined } from '@ant-design/icons';
import type { RoleProfile } from '../types/roles';
import { BUILTIN_ROLES } from '../data/builtinRoles';

interface Props {
  activeRole: RoleProfile | null;
  onSelectRole: (role: RoleProfile | null) => void;
}

export default function RoleSelector({ activeRole, onSelectRole }: Props) {
  const [customRoles, setCustomRoles] = useState<RoleProfile[]>(() => {
    try { return JSON.parse(localStorage.getItem('customRoles') || '[]'); } catch { return []; }
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const saveCustom = (roles: RoleProfile[]) => {
    setCustomRoles(roles);
    localStorage.setItem('customRoles', JSON.stringify(roles));
  };

  const handleCreate = () => {
    form.validateFields().then((values: any) => {
      const newRole: RoleProfile = { id: 'custom-' + Date.now(), ...values };
      const updated = [...customRoles, newRole];
      saveCustom(updated);
      setModalOpen(false);
      form.resetFields();
      message.success('角色已创建');
    });
  };

  const allRoles = [...BUILTIN_ROLES, ...customRoles];

  const menuItems = [
    { key: 'none', label: '无角色', onClick: () => onSelectRole(null) },
    { type: 'divider' as const },
    ...allRoles.map(role => ({
      key: role.id,
      label: role.name,
      onClick: () => onSelectRole(role),
    })),
    { type: 'divider' as const },
    { key: 'create', icon: <PlusOutlined />, label: '创建自定义角色', onClick: () => setModalOpen(true) },
  ];

  return (
    <>
      <Dropdown menu={{ items: menuItems }} trigger={['click']}>
        <Button size="small" icon={<UserOutlined />}>
          {activeRole ? activeRole.name : '角色'}
        </Button>
      </Dropdown>
      <Modal title="创建自定义角色" open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="角色名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="title" label="职业称谓"><Input /></Form.Item>
          <Form.Item name="tone" label="语气风格"><Input /></Form.Item>
          <Form.Item name="customPrompt" label="额外提示词"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}`,

  // ================= 数据 & 类型 =================
  'src/data/builtinRoles.ts': `import type { RoleProfile } from '../types/roles';
export const BUILTIN_ROLES: RoleProfile[] = [
  { id: 'programmer', name: '资深程序员', title: 'Senior Developer', description: '精通多种编程语言，擅长系统架构和代码优化。', tone: '技术性强、逻辑清晰、直截了当', customPrompt: '提供代码示例时请附上解释。' },
  { id: 'pm', name: '产品经理', title: 'Product Manager', description: '擅长需求分析、市场调研和产品规划。', tone: '商业导向、以用户为中心', customPrompt: '用结构化的方式回答，善用 SWOT 分析。' },
  { id: 'teacher', name: '知识导师', title: 'Teacher', description: '善于用通俗易懂的语言解释复杂概念。', tone: '耐心、循循善诱、举例说明', customPrompt: '如果解释技术术语，请先给出生活化的类比。' },
  { id: 'translator', name: '翻译官', title: 'Professional Translator', description: '精通中英文互译，保持原文风格和准确性。', tone: '精准、雅致、符合源语言习惯', customPrompt: '仅输出翻译结果，不添加额外评论。' },
];`,

  'src/types/roles.ts': `export interface RoleProfile {
  id: string; name: string; title: string; description: string; tone: string; customPrompt: string;
}`,

  'src/types/models.ts': `export interface ModelConfig { model: string; apiKey: string; baseURL: string; temperature: number; maxTokens: number; }
export const DEFAULT_MODEL_CONFIG: ModelConfig = { model: 'gpt-4o', apiKey: '', baseURL: '', temperature: 0.7, maxTokens: 8000 };
export function loadModelConfig(): ModelConfig { try { const stored = localStorage.getItem('modelConfig'); if (stored) return { ...DEFAULT_MODEL_CONFIG, ...JSON.parse(stored) }; } catch {} return { ...DEFAULT_MODEL_CONFIG }; }
export function saveModelConfig(config: ModelConfig) { localStorage.setItem('modelConfig', JSON.stringify(config)); }`,

  // ================= Hooks =================
  'src/hooks/useConfirm.ts': `import { useCallback } from 'react';
import { useChatContext } from '../providers/ChatProvider';
export function useConfirm(_sessionId?: string) {
  const { confirmRequest, resolveConfirm } = useChatContext();
  const handleConfirm = useCallback(() => resolveConfirm(true), [resolveConfirm]);
  const handleReject = useCallback(() => resolveConfirm(false), [resolveConfirm]);
  return { confirmRequest, handleConfirm, handleReject };
}`,
};

// ── 写入文件 ──
function ensureDir(dirPath: string) { fs.mkdirSync(dirPath, { recursive: true }); }

console.log('🚀 正在生成 AgentKit 多路由前端...\n');

for (const [relativePath, content] of Object.entries(FILES)) {
  const fullPath = path.join(webRoot, relativePath);
  ensureDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, content, 'utf-8');
  console.log('✓ ' + relativePath);
}

console.log('\n✅ 前端代码生成完成！');
console.log('1. cd web');
console.log('2. bun install');
console.log('3. bun run dev');
console.log('4. 浏览器访问 http://localhost:5173');