import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';
import ErrorBoundary from './components/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<div className="app-loading">🔄 正在加载应用 …</div>}>
        <App />
      </Suspense>
    </ErrorBoundary>
  </React.StrictMode>
);