import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Input, message, Typography, Spin, Space } from 'antd';
import { ArrowLeftOutlined, EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import { XMarkdown } from '@ant-design/x-markdown';

const { TextArea } = Input;
const { Title, Text } = Typography;

export default function FileViewPage() {
  const { kbId, fileName } = useParams<{ kbId: string; fileName: string }>();
  const navigate = useNavigate();

  const [content, setContent] = useState('');
  const [isMarkdown, setIsMarkdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!kbId || !fileName) return;
    setLoading(true);
    fetch(`/api/knowledge/${kbId}/files/${encodeURIComponent(fileName)}`)
      .then(res => res.json())
      .then(data => {
        setContent(data.content || '');
        setEditContent(data.content || '');
        setIsMarkdown(data.isMarkdown || false);
      })
      .catch(() => message.error('Failed to load file'))
      .finally(() => setLoading(false));
  }, [kbId, fileName]);

  const handleSave = async () => {
    if (!kbId || !fileName) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/knowledge/${kbId}/files/${encodeURIComponent(fileName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      });
      if (!res.ok) {
        const err = await res.json();
        message.error(err.error || 'Save failed');
        setSaving(false);
        return;
      }
      setContent(editContent);
      setEditing(false);
      message.success('File saved');
    } catch {
      message.error('Save failed');
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setEditContent(content);
    setEditing(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/knowledge')}>Back</Button>
        <Title level={4} style={{ margin: 0, flex: 1 }}>{fileName}</Title>
        {editing ? (
          <Space>
            <Button icon={<CloseOutlined />} onClick={handleCancel}>Cancel</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>Save</Button>
          </Space>
        ) : (
          <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>Edit</Button>
        )}
      </div>

      {editing ? (
        <TextArea
          value={editContent}
          onChange={e => setEditContent(e.target.value)}
          style={{ flex: 1, fontFamily: 'monospace', fontSize: 14, resize: 'none' }}
        />
      ) : (
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 0' }}>
          {isMarkdown ? (
            <XMarkdown content={content} />
          ) : (
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
              {content}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
