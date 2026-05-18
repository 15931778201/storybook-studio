import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Input, message, Typography } from 'antd';
import { SaveOutlined, ArrowLeftOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import { XMarkdown } from '@ant-design/x-markdown';
import CodeBlock from '../components/CodeBlock';

const { TextArea } = Input;
const { Title } = Typography;

export default function NewKnowledgeFilePage() {
  const { kbId } = useParams<{ kbId: string }>();
  const navigate = useNavigate();
  const [fileName, setFileName] = useState(`note-${new Date().toISOString().slice(0, 10)}-001.md`);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(true);
  const isMarkdown = fileName.endsWith('.md');

  const handleSave = async () => {
    if (!fileName.trim()) {
      message.error('File name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/knowledge/${kbId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: fileName.trim(), content }),
      });
      if (!res.ok) {
        const err = await res.json();
        message.error(err.error || 'Save failed');
        setSaving(false);
        return;
      }
      message.success('File saved');
      navigate('/knowledge');
    } catch {
      message.error('Save failed');
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/knowledge')}>Back</Button>
        <Title level={4} style={{ margin: 0, flex: 1 }}>New File</Title>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>Save</Button>
      </div>
      <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
        <Input
          placeholder="File name"
          value={fileName}
          onChange={e => setFileName(e.target.value)}
          style={{ fontFamily: 'monospace', flex: 1 }}
          addonBefore="Filename"
        />
        {isMarkdown && (
          <Button
            icon={preview ? <EditOutlined /> : <EyeOutlined />}
            onClick={() => setPreview(p => !p)}
          >
            {preview ? 'Editor Only' : 'Preview'}
          </Button>
        )}
      </div>
      <div style={{ flex: 1, display: 'flex', gap: 12, overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: preview && isMarkdown ? '40%' : '100%' }}>
          <TextArea
            placeholder="Paste or type content here..."
            value={content}
            onChange={e => setContent(e.target.value)}
            style={{ flex: 1, fontFamily: 'monospace', fontSize: 14, resize: 'none' }}
          />
        </div>
        {isMarkdown && preview && (
          <div style={{ flex: 1, overflow: 'auto', borderLeft: '1px solid #e8e8e8', paddingLeft: 12 }}>
            <div style={{ maxWidth: 860 }}>
              <XMarkdown
                content={content}
                components={{
                  code({ inline, className, children }: any) {
                    if (!inline && className) {
                      return (
                        <CodeBlock language={className.replace('language-', '')}>
                          {String(children).replace(/\n$/, '')}
                        </CodeBlock>
                      );
                    }
                    return <code className={className}>{children}</code>;
                  },
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
