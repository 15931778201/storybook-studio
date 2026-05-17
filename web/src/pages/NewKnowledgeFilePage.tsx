import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Input, message, Typography } from 'antd';
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Title } = Typography;

export default function NewKnowledgeFilePage() {
  const { kbId } = useParams<{ kbId: string }>();
  const navigate = useNavigate();
  const [fileName, setFileName] = useState(`note-${new Date().toISOString().slice(0, 10)}-001.md`);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

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
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/knowledge')}>Back</Button>
        <Title level={4} style={{ margin: 0, flex: 1 }}>New File</Title>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>Save</Button>
      </div>
      <div style={{ marginBottom: 12 }}>
        <Input
          placeholder="File name"
          value={fileName}
          onChange={e => setFileName(e.target.value)}
          style={{ fontFamily: 'monospace' }}
          addonBefore="Filename"
        />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TextArea
          placeholder="Paste or type content here..."
          value={content}
          onChange={e => setContent(e.target.value)}
          style={{ flex: 1, fontFamily: 'monospace', fontSize: 14, resize: 'none' }}
        />
      </div>
    </div>
  );
}
