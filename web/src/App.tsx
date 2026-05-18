import { useState, useCallback, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Layout, ConfigProvider, theme as antTheme, Button, Tooltip, Space, Menu } from 'antd';
import { SunOutlined, MoonOutlined, MessageOutlined, AppstoreOutlined, ShoppingOutlined, SettingOutlined, BookOutlined, ClockCircleOutlined, UserOutlined, FileTextOutlined, DiffOutlined, ToolOutlined } from '@ant-design/icons';
import { XProvider } from '@ant-design/x';
import { ChatProvider, useChatContext } from './providers/ChatProvider';

import RoleSelector from './components/RoleSelector';
import ChatPage from './pages/ChatPage';
import SkillsPage from './pages/SkillsPage';
import MarketPage from './pages/MarketPage';
import SettingsPage from './pages/SettingsPage';
import KnowledgePage from './pages/KnowledgePage';
import NewKnowledgeFilePage from './pages/NewKnowledgeFilePage';
import FileViewPage from './pages/FileViewPage';
import RoleManagementPage from './pages/RoleManagementPage';
import ToolsPage from './pages/ToolsPage';
import './App.css';
import CronPage from './pages/CronPage';
import LogsPage from './pages/LogsPage';
import ChangelogPage from './pages/ChangelogPage';

const { Sider, Content, Header } = Layout;

function AppInner() {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const { activeRole, setActiveRole } = useChatContext();
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
    { key: '/tools', icon: <ToolOutlined />, label: '工具' },
    { key: '/market', icon: <ShoppingOutlined />, label: '市场' },
    { key: '/knowledge', icon: <BookOutlined />, label: '知识库' },
    { key: '/roles', icon: <UserOutlined />, label: '角色' },
    { key: '/cron', icon: <ClockCircleOutlined />, label: '定时任务' },
    { key: '/logs', icon: <FileTextOutlined />, label: '日志' },
    { key: '/changelog', icon: <DiffOutlined />, label: '变更日志' },
    { key: '/settings', icon: <SettingOutlined />, label: '设置' },
  ];

  return (
    <Layout style={{ height: '100vh' }}>
      {sidebarOpen && (
        <Sider width={280} style={{ background: token.colorBgElevated, borderRight: `1px solid ${token.colorBorderSecondary}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px', fontWeight: 'bold', fontSize: 16, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
            🤖 AgentKit
          </div>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={navItems}
            onClick={({ key }) => navigate(key)}
            style={{ background: 'transparent', borderRight: 0, marginTop: 8 }}
          />

        </Sider>
      )}

      <Layout>
        <Header style={{ background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorderSecondary}`, display: 'flex', alignItems: 'center', padding: '0 16px', height: 56 }}>
          <Button type="text" onClick={() => setSidebarOpen(!sidebarOpen)} style={{ fontSize: 18, marginRight: 12 }}>☰</Button>
          <div style={{ flex: 1 }} />
          <h3 style={{ margin: 0, minWidth: 100 }}>AgentKit</h3>
          <div style={{ flex: 1 }} />
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
            <Route path="/tools" element={<ToolsPage />} />
            <Route path="/market" element={<MarketPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/knowledge/:kbId/new" element={<NewKnowledgeFilePage />} />
            <Route path="/knowledge/:kbId/files/:fileName" element={<FileViewPage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="/roles" element={<RoleManagementPage />} />
            <Route path="/cron" element={<CronPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/changelog" element={<ChangelogPage />} />
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
}