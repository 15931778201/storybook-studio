import React, { useState } from 'react';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';

export default function CodeBlock({ language, children }: { language?: string; children: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: 'relative', margin: '12px 0' }}>
      <div style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 1,
      }}>
        <Tooltip title={copied ? '已复制' : '复制代码'}>
          <Button
            size="small"
            type="text"
            icon={copied ? <CheckOutlined style={{ color: '#52c41a' }} /> : <CopyOutlined />}
            onClick={handleCopy}
          />
        </Tooltip>
      </div>
      <pre className="code-block" style={{ margin: 0 }}>
        {language && <div style={{ color: '#888', fontSize: 12, padding: '4px 8px' }}>{language}</div>}
        <code>{children}</code>
      </pre>
    </div>
  );
}