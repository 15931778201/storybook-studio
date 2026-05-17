import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Typography, Button, Modal, Input, message, List, Upload, Space, Popconfirm, Spin, Tabs, Slider, Tag, Divider, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined, InboxOutlined, EditOutlined, FolderOutlined, FileOutlined, FileAddOutlined, SearchOutlined, SettingOutlined, ApartmentOutlined, ShareAltOutlined } from '@ant-design/icons';
import KnowledgeGraphView from '../components/KnowledgeGraphView';

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

interface SearchResult {
  content: string;
  source: string;
  score: number;
}

export default function KnowledgePage() {
  const navigate = useNavigate();
  const [kbList, setKbList] = useState<KBItem[]>([]);
  const [selectedKb, setSelectedKb] = useState<KBItem | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [fileFilter, setFileFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const [showRename, setShowRename] = useState(false);
  const [renameId, setRenameId] = useState('');
  const [renameName, setRenameName] = useState('');

  const [chunkSize, setChunkSize] = useState(1500);
  const [chunkOverlap, setChunkOverlap] = useState(200);
  const [keywordWeight, setKeywordWeight] = useState(0.3);
  const [configLoaded, setConfigLoaded] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [graphData, setGraphData] = useState<any>(null);
  const [graphLoading, setGraphLoading] = useState(false);

  const [detailTab, setDetailTab] = useState('files');

  const fetchGraph = async (kbId: string) => {
    setGraphLoading(true);
    try {
      const res = await fetch(`/api/knowledge/${kbId}/graph`);
      if (res.ok) setGraphData(await res.json());
    } catch {}
    setGraphLoading(false);
  };

  const handleTabChange = (key: string) => {
    setDetailTab(key);
    if (key === 'graph' && !graphData) fetchGraph(selectedKb!.id);
  };

  const fetchKbList = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/knowledge');
      const data = await res.json();
      setKbList(data);
    } catch { message.error('加载知识库失败'); }
    setLoading(false);
  };

  const fetchFiles = async (kbId: string) => {
    try {
      const res = await fetch(`/api/knowledge/${kbId}/files`);
      const data = await res.json();
      setFiles(data.files || []);
    } catch { setFiles([]); }
  };

  const fetchConfig = async (kbId: string) => {
    try {
      const res = await fetch(`/api/knowledge/${kbId}/config`);
      if (res.ok) {
        const data = await res.json();
        setChunkSize(data.chunkSize ?? 1500);
        setChunkOverlap(data.chunkOverlap ?? 200);
        setKeywordWeight(data.keywordWeight ?? 0.3);
        setConfigLoaded(true);
      }
    } catch {}
  };

  useEffect(() => { fetchKbList(); }, []);

  const handleSelect = (kb: KBItem) => {
    setSelectedKb(kb);
    setSearchResults(null);
    setDetailTab('files');
    setConfigLoaded(false);
    setGraphData(null);
    fetchFiles(kb.id);
    fetchConfig(kb.id);
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
      message.success('知识库创建成功');
      setShowCreate(false); setNewName(''); setNewDesc('');
      fetchKbList();
    } catch { message.error('创建失败'); }
  };

  const handleRename = async () => {
    if (!renameName.trim()) return;
    try {
      await fetch(`/api/knowledge/${renameId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameName.trim() }),
      });
      message.success('重命名成功');
      setShowRename(false);
      fetchKbList();
      if (selectedKb?.id === renameId) {
        setSelectedKb(prev => prev ? { ...prev, name: renameName.trim() } : null);
      }
    } catch { message.error('重命名失败'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/knowledge/${id}`, { method: 'DELETE' });
      message.success('已删除');
      if (selectedKb?.id === id) { setSelectedKb(null); setFiles([]); }
      fetchKbList();
    } catch { message.error('删除失败'); }
  };

  const handleReindex = async () => {
    if (!selectedKb) return;
    setIndexing(true);
    try {
      await fetch(`/api/knowledge/${selectedKb.id}/reindex`, { method: 'POST' });
      message.success('重新索引完成');
    } catch { message.error('重新索引失败'); }
    setIndexing(false);
  };

  const handleSaveConfig = async () => {
    if (!selectedKb) return;
    try {
      const res = await fetch(`/api/knowledge/${selectedKb.id}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunkSize, chunkOverlap, keywordWeight }),
      });
      if (res.ok) message.success('配置已保存，重新索引后生效');
      else message.error('保存配置失败');
    } catch { message.error('保存配置失败'); }
  };

  const handleSearch = async () => {
    if (!selectedKb || !searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/knowledge/${selectedKb.id}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery.trim(), topK: 10 }),
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results);
      }
    } catch { message.error('搜索失败'); }
    setSearching(false);
  };

  const handleDeleteFile = async (fileName: string) => {
    if (!selectedKb) return;
    try {
      await fetch(`/api/knowledge/${selectedKb.id}/files/${encodeURIComponent(fileName)}`, { method: 'DELETE' });
      message.success('文件已删除');
      fetchFiles(selectedKb.id);
    } catch { message.error('删除失败'); }
  };

  const filteredFiles = files.filter(f =>
    f.name.toLowerCase().includes(fileFilter.toLowerCase())
  );

  const renderFileList = () => (
    <>
      <div style={{ marginBottom: 8, padding: '8px 12px', background: '#fff7e6', borderRadius: 6, fontSize: 12, color: '#d48806' }}>
        点击文件名查看/编辑内容。支持 Markdown 文件分屏预览、代码高亮、Mermaid 图表渲染。
      </div>
      <Input
        placeholder="搜索文件..."
        prefix={<SearchOutlined />}
        value={fileFilter}
        onChange={e => setFileFilter(e.target.value)}
        style={{ marginBottom: 8 }}
        allowClear
      />
      <List
        header={<Text strong>文件 ({filteredFiles.length})</Text>}
        dataSource={filteredFiles}
        locale={{ emptyText: '暂无文件' }}
        renderItem={file => (
          <List.Item
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/knowledge/${selectedKb!.id}/files/${encodeURIComponent(file.name)}`)}
            actions={[
              <Popconfirm title="删除此文件？" onConfirm={(e) => { e?.stopPropagation(); handleDeleteFile(file.name); }}>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={e => e.stopPropagation()} />
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
  );

  const renderConfigPanel = () => (
    <div style={{ padding: '8px 0' }}>
      <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fff7e6', borderRadius: 6, fontSize: 12, color: '#d48806' }}>
         调整分块参数影响检索效果。修改后需点击"重新索引"生效。分块大小越大每个片段包含信息越多，重叠越大上下文连贯性越好，关键词权重越高越侧重精确匹配。
      </div>
      <div style={{ marginBottom: 16 }}>
        <Text strong>分块大小: {chunkSize}</Text>
        <Slider min={200} max={4000} step={100} value={chunkSize} onChange={setChunkSize} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <Text strong>分块重叠: {chunkOverlap}</Text>
        <Slider min={0} max={1000} step={50} value={chunkOverlap} onChange={setChunkOverlap} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <Text strong>关键词权重: {keywordWeight.toFixed(2)}</Text>
        <Slider min={0} max={1} step={0.05} value={keywordWeight} onChange={setKeywordWeight} />
      </div>
      <Button type="primary" onClick={handleSaveConfig}>保存配置</Button>
    </div>
  );

  const renderSearchPanel = () => (
    <div>
      <div style={{ marginBottom: 8, padding: '8px 12px', background: '#fff7e6', borderRadius: 6, fontSize: 12, color: '#d48806' }}>
        输入检索语句测试知识库的召回效果。结果按混合检索得分（向量×权重 + BM25×权重 + 图谱增强）排序，分数越高越相关。
      </div>
      <Space style={{ marginBottom: 12, width: '100%' }}>
        <Input.Search
          placeholder="输入检索查询..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onSearch={handleSearch}
          loading={searching}
          enterButton="检索"
          style={{ flex: 1 }}
        />
      </Space>
      {searchResults && (
        <div>
          <Text strong>{searchResults.length} 条结果</Text>
          <List
            dataSource={searchResults}
            renderItem={(r, i) => (
              <List.Item>
                <div style={{ width: '100%' }}>
                  <Space>
                    <Tag color={r.score > 0.5 ? 'blue' : 'default'}>{(r.score * 100).toFixed(1)}%</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>{r.source}</Text>
                  </Space>
                  <div style={{
                    marginTop: 4,
                    background: '#f5f5f5',
                    padding: 8,
                    borderRadius: 4,
                    fontSize: 13,
                    maxHeight: 120,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                  }}>
                    {r.content}
                  </div>
                </div>
              </List.Item>
            )}
          />
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: 24, display: 'flex', gap: 16, height: '100%' }}>
      {/* Left: KB List */}
      <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Space>
          <Title level={4} style={{ margin: 0 }}>知识库</Title>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setShowCreate(true)}>新建</Button>
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
                  <Popconfirm title="确认删除？" onConfirm={() => handleDelete(item.id)}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()} />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  avatar={<FolderOutlined style={{ fontSize: 20, color: '#1677ff' }} />}
                  title={item.name}
                  description={`${item.docCount} 个文件`}
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
              <Button size="small" icon={<FileAddOutlined />} onClick={() => navigate(`/knowledge/${selectedKb.id}/new`)}>新建文件</Button>
              <Button size="small" icon={<ReloadOutlined />} onClick={handleReindex} loading={indexing}>重新索引</Button>
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
                  message.success(`${info.file.name} 上传成功`);
                  fetchFiles(selectedKb.id);
                  fetchKbList();
                } else if (info.file.status === 'error') {
                  message.error(`${info.file.name} 上传失败`);
                }
              }}
              style={{ padding: 16 }}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">点击或拖拽文件上传</p>
            </Dragger>

            <Tabs
              activeKey={detailTab}
              onChange={handleTabChange}
              items={[
                { key: 'files', label: '文件', children: renderFileList() },
                { key: 'search', label: <><SearchOutlined /> 检索测试</>, children: renderSearchPanel() },
                { key: 'config', label: <><SettingOutlined /> 配置</>, children: renderConfigPanel() },
                { key: 'graph', label: <><ShareAltOutlined /> 图谱</>, children: <KnowledgeGraphView data={graphData} loading={graphLoading} /> },
              ]}
            />
          </>
        ) : (
          <div style={{ textAlign: 'center', paddingTop: 80, opacity: 0.5 }}>
            <FolderOutlined style={{ fontSize: 48 }} />
            <p>请选择一个知识库查看详情</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal title="新建知识库" open={showCreate} onOk={handleCreate} onCancel={() => setShowCreate(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input placeholder="名称" value={newName} onChange={e => setNewName(e.target.value)} />
          <Input placeholder="描述（可选）" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
        </div>
      </Modal>

      {/* Rename Modal */}
      <Modal title="重命名" open={showRename} onOk={handleRename} onCancel={() => setShowRename(false)}>
        <Input placeholder="新名称" value={renameName} onChange={e => setRenameName(e.target.value)} />
      </Modal>
    </div>
  );
}
