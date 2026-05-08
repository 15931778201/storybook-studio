import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { Layout, Button, Space, Tooltip, theme, Menu } from 'antd';
import {
  SunOutlined, MoonOutlined, MessageOutlined,
  CodeOutlined, ShoppingCartOutlined, SettingOutlined,
  ProjectOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useChatContext } from '../providers/ChatProvider';
import RoleSelector from '../components/RoleSelector';
import { BUILTIN_ROLES } from '../data/roles';

const { Sider, Content, Header } = Layout;

interface Props {
  isDark: boolean;
  toggleTheme: () => void;
}

export default function AppLayout({ isDark, toggleTheme }: Props) {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth <= 768);
  const location = useLocation();
  const navigate = useNavigate();
  const { activeRole, setActiveRole } = useChatContext();
  const { token } = theme.useToken();

  useEffect(() => {
    const handleResize = () => setCollapsed(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const menuItems = [
    { key: '/', icon: <MessageOutlined />, label: '对话' },
    { key: '/skills', icon: <CodeOutlined />, label: '技能' },
    { key: '/market', icon: <ShoppingCartOutlined />, label: '市场' },
    { key: '/cron', icon: <ClockCircleOutlined />, label: '定时任务' },
    { key: '/settings', icon: <SettingOutlined />, label: '设置' },
  ];

  return (
    <Layout style={{ height: '100vh' }}>
      {!collapsed && (
        <Sider width={220} style={{
          background: token.colorBgElevated,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        }}>
          <div style={{ padding: '16px', fontWeight: 'bold', textAlign: 'center', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
            ⚡ AgentKit
          </div>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ borderRight: 0 }}
          />
        </Sider>
      )}

      <Layout>
        <Header style={{
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex', alignItems: 'center',
          padding: '0 16px', height: 56,
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ marginRight: 12 }}
          />
          <div style={{ flex: 1 }} />
          <Space>
            <RoleSelector activeRole={activeRole} onSelectRole={setActiveRole} />
            <Tooltip title={isDark ? '亮色模式' : '暗色模式'}>
              <Button
                type="text"
                icon={isDark ? <SunOutlined /> : <MoonOutlined />}
                onClick={toggleTheme}
              />
            </Tooltip>
          </Space>
        </Header>

        <Content style={{ overflow: 'auto' }}>
          <Outlet /> {/* 子路由页面在此渲染 */}
        </Content>
      </Layout>
    </Layout>
  );
}