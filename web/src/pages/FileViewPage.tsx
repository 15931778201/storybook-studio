import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Input, message, Typography, Spin, Space, Tag, Segmented } from 'antd';
import { ArrowLeftOutlined, EditOutlined, SaveOutlined, CloseOutlined, ApartmentOutlined, FileTextOutlined } from '@ant-design/icons';
import { XMarkdown } from '@ant-design/x-markdown';
import CodeBlock from '../components/CodeBlock';

const { TextArea } = Input;
const { Title, Text } = Typography;

interface ChunkInfo {
  index: number;
  content: string;
  charCount: number;
}

export default function FileViewPage() {
  const { kbId, fileName } = useParams<{ kbId: string; fileName: string }>();
  const navigate = useNavigate();

  const [content, setContent] = useState('');
  const [isMarkdown, setIsMarkdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'chunks'>('preview');
  const [chunks, setChunks] = useState<ChunkInfo[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);

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

  const loadChunks = async () => {
    if (!kbId || !fileName || chunks.length > 0) return;
    setChunksLoading(true);
    try {
      const res = await fetch(`/api/knowledge/${kbId}/files/${encodeURIComponent(fileName)}/chunks`);
      if (res.ok) {
        const data = await res.json();
        setChunks(data.chunks || []);
      }
    } catch {}
    setChunksLoading(false);
  };

  const handleViewModeChange = (mode: string) => {
    setViewMode(mode as 'preview' | 'chunks');
    if (mode === 'chunks') loadChunks();
  };

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
      setChunks([]);
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
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/knowledge')}>Back</Button>
        <Title level={4} style={{ margin: 0, flex: 1 }}>{fileName}</Title>
        {!editing && (
          <Segmented
            options={[
              { value: 'preview', icon: <FileTextOutlined /> },
              { value: 'chunks', icon: <ApartmentOutlined /> },
            ]}
            value={viewMode}
            onChange={handleViewModeChange}
          />
        )}
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
        <div style={{ flex: 1, display: 'flex', gap: 12, overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <TextArea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              style={{ flex: 1, fontFamily: 'monospace', fontSize: 14, resize: 'none' }}
            />
          </div>
          {isMarkdown && (
            <div style={{ flex: 1, overflow: 'auto', borderLeft: '1px solid #e8e8e8', paddingLeft: 12 }}>
              <div style={{ maxWidth: 860 }}>
                <XMarkdown
                  content={editContent}
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
      ) : viewMode === 'chunks' ? (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {chunksLoading ? (
            <div style={{ textAlign: 'center', paddingTop: 40 }}><Spin /></div>
          ) : chunks.length === 0 ? (
            <Text type="secondary">No chunks available</Text>
          ) : (
            chunks.map((chunk, idx) => (
              <div key={idx} style={{
                marginBottom: 12,
                border: '1px solid #e8e8e8',
                borderRadius: 8,
                overflow: 'hidden',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '4px 12px', background: '#fafafa', borderBottom: '1px solid #e8e8e8',
                }}>
                  <Text strong style={{ fontSize: 13 }}>Chunk #{chunk.index}</Text>
                  <Tag>{chunk.charCount} chars</Tag>
                </div>
                <pre style={{
                  margin: 0, padding: 12, fontSize: 13, fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto',
                }}>
                  {chunk.content}
                </pre>
              </div>
            ))
          )}
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {isMarkdown ? (
            <div style={{ maxWidth: 860, padding: '0 24px 24px' }}>
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
          ) : (
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6, margin: 0, padding: '0 24px 24px' }}>
              {content}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
