import { useState, useEffect } from 'react';
import { Card, Typography, Button, Modal, Input, message, List, Upload, Space, Popconfirm, Spin } from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined, InboxOutlined, EditOutlined, FolderOutlined, FileOutlined } from '@ant-design/icons';

const { Dragger } = Upload;
const { Title, Text } = Typography;

interface KBItem {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  docCount: number;
}

interface FileItem {
  name: string;
  size: number;
  mtime: string;
}

export default function KnowledgePage() {
  const [kbList, setKbList] = useState<KBItem[]>([]);
  const [selectedKb, setSelectedKb] = useState<KBItem | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const [showRename, setShowRename] = useState(false);
  const [renameId, setRenameId] = useState('');
  const [renameName, setRenameName] = useState('');

  const fetchKbList = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/knowledge');
      const data = await res.json();
      setKbList(data);
    } catch { message.error('Failed to load knowledge bases'); }
    setLoading(false);
  };

  const fetchFiles = async (kbId: string) => {
    try {
      const res = await fetch(`/api/knowledge/${kbId}/files`);
      const data = await res.json();
      setFiles(data.files || []);
    } catch { setFiles([]); }
  };

  useEffect(() => { fetchKbList(); }, []);

  const handleSelect = (kb: KBItem) => {
    setSelectedKb(kb);
    fetchFiles(kb.id);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() }),
      });
      if (!res.ok) { const err = await res.json(); message.error(err.error); return; }
      message.success('Knowledge base created');
      setShowCreate(false); setNewName(''); setNewDesc('');
      fetchKbList();
    } catch { message.error('Create failed'); }
  };

  const handleRename = async () => {
    if (!renameName.trim()) return;
    try {
      await fetch(`/api/knowledge/${renameId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameName.trim() }),
      });
      message.success('Renamed');
      setShowRename(false);
      fetchKbList();
      if (selectedKb?.id === renameId) {
        setSelectedKb(prev => prev ? { ...prev, name: renameName.trim() } : null);
      }
    } catch { message.error('Rename failed'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/knowledge/${id}`, { method: 'DELETE' });
      message.success('Deleted');
      if (selectedKb?.id === id) { setSelectedKb(null); setFiles([]); }
      fetchKbList();
    } catch { message.error('Delete failed'); }
  };

  const handleReindex = async () => {
    if (!selectedKb) return;
    setIndexing(true);
    try {
      await fetch(`/api/knowledge/${selectedKb.id}/reindex`, { method: 'POST' });
      message.success('Reindex complete');
    } catch { message.error('Reindex failed'); }
    setIndexing(false);
  };

  const handleDeleteFile = async (fileName: string) => {
    if (!selectedKb) return;
    try {
      await fetch(`/api/knowledge/${selectedKb.id}/files/${encodeURIComponent(fileName)}`, { method: 'DELETE' });
      message.success('File deleted');
      fetchFiles(selectedKb.id);
    } catch { message.error('Delete failed'); }
  };

  return (
    <div style={{ padding: 24, display: 'flex', gap: 16, height: '100%' }}>
      {/* Left: KB List */}
      <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Space>
          <Title level={4} style={{ margin: 0 }}>Knowledge Bases</Title>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setShowCreate(true)}>New</Button>
          <Button size="small" icon={<ReloadOutlined />} onClick={fetchKbList} loading={loading} />
        </Space>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <List
            dataSource={kbList}
            loading={loading}
            renderItem={item => (
              <List.Item
                onClick={() => handleSelect(item)}
                style={{
                  cursor: 'pointer',
                  background: selectedKb?.id === item.id ? '#e6f4ff' : undefined,
                  borderRadius: 8, padding: '8px 12px', marginBottom: 4,
                }}
                actions={[
                  <Button type="text" size="small" icon={<EditOutlined />}
                    onClick={(e) => { e.stopPropagation(); setRenameId(item.id); setRenameName(item.name); setShowRename(true); }} />,
                  <Popconfirm title="Are you sure?" onConfirm={() => handleDelete(item.id)}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()} />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  avatar={<FolderOutlined style={{ fontSize: 20, color: '#1677ff' }} />}
                  title={item.name}
                  description={`${item.docCount} files`}
                />
              </List.Item>
            )}
          />
        </div>
      </div>

      {/* Right: KB Detail */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {selectedKb ? (
          <>
            <Space>
              <Title level={4} style={{ margin: 0 }}>{selectedKb.name}</Title>
              <Button size="small" icon={<ReloadOutlined />} onClick={handleReindex} loading={indexing}>Reindex</Button>
            </Space>
            <Text type="secondary">{selectedKb.description}</Text>

            <Dragger
              name="files"
              multiple
              action={`/api/knowledge/${selectedKb.id}/upload`}
              showUploadList={false}
              accept=".md,.txt,.ts,.tsx,.js,.py,.java,.c,.cpp,.h,.go,.rs,.vue,.css,.html,.sh,.sql,.json,.xml,.yaml,.yml,.csv"
              onChange={(info) => {
                if (info.file.status === 'done') {
                  message.success(`${info.file.name} uploaded`);
                  fetchFiles(selectedKb.id);
                  fetchKbList();
                } else if (info.file.status === 'error') {
                  message.error(`${info.file.name} upload failed`);
                }
              }}
              style={{ padding: 16 }}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">Click or drag files to upload</p>
            </Dragger>

            <List
              header={<Text strong>Files ({files.length})</Text>}
              dataSource={files}
              locale={{ emptyText: 'No files' }}
              renderItem={file => (
                <List.Item
                  actions={[
                    <Popconfirm title="Delete this file?" onConfirm={() => handleDeleteFile(file.name)}>
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<FileOutlined />}
                    title={file.name}
                    description={`${(file.size / 1024).toFixed(1)} KB`}
                  />
                </List.Item>
              )}
            />
          </>
        ) : (
          <div style={{ textAlign: 'center', paddingTop: 80, opacity: 0.5 }}>
            <FolderOutlined style={{ fontSize: 48 }} />
            <p>Select a knowledge base to view details</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal title="New Knowledge Base" open={showCreate} onOk={handleCreate} onCancel={() => setShowCreate(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input placeholder="Name" value={newName} onChange={e => setNewName(e.target.value)} />
          <Input placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
        </div>
      </Modal>

      {/* Rename Modal */}
      <Modal title="Rename" open={showRename} onOk={handleRename} onCancel={() => setShowRename(false)}>
        <Input placeholder="New name" value={renameName} onChange={e => setRenameName(e.target.value)} />
      </Modal>
    </div>
  );
}
