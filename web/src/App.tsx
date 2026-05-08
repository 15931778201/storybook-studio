import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme as antTheme, App as AntApp } from 'antd';
import { XProvider } from '@ant-design/x';
import { ChatProvider } from './providers/ChatProvider';
import AppLayout from './layouts/AppLayout';
import { SunOutlined } from '@ant-design/icons'; // 实际图标根据需要引入

// 懒加载页面
const ChatPage = lazy(() => import('./pages/ChatPage'));
const SkillsPage = lazy(() => import('./pages/SkillsPage'));
const MarketPage = lazy(() => import('./pages/MarketPage'));
const LogsPage = lazy(() => import('./pages/LogsPage'));
const CronPage = lazy(() => import('./pages/CronPage'));
const ApiKeysPage = lazy(() => import('./pages/ApiKeysPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

export default function App() {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', next);
      return next;
    });
  }, []);
  
  return (
    <ConfigProvider theme={{
      algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
      token: { borderRadius: 8 },
    }}>
      <XProvider>
        <ChatProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout isDark={isDark} toggleTheme={toggleTheme} />}>
                <Route path="/" element={<Suspense fallback="加载中"><ChatPage /></Suspense>} />
                <Route path="/skills" element={<Suspense fallback="加载中"><SkillsPage /></Suspense>} />
                <Route path="/market" element={<Suspense fallback="加载中"><MarketPage /></Suspense>} />
                <Route path="/apikeys" element={<Suspense fallback="加载中"><ApiKeysPage /></Suspense>} />
                <Route path="/logs" element={<Suspense fallback="加载中"><LogsPage /></Suspense>} />
                <Route path="/cron" element={<Suspense fallback="加载中"><CronPage /></Suspense>} />
                <Route path="/settings" element={<Suspense fallback="加载中"><SettingsPage /></Suspense>} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ChatProvider>
      </XProvider>
    </ConfigProvider>
  );
}