import { Tabs, Button, Modal, Input, Select, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useChatContext } from '../providers/ChatProvider';
import '../style/WorkspaceTabs.css';

interface KBItem {
  id: string;
  name: string;
}

export default function WorkspaceTabs() {
  const { workspaces, activeWorkspaceId, setActiveWorkspaceId, addWorkspace } = useChatContext();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([]);
  const [kbList, setKbList] = useState<KBItem[]>([]);

  useEffect(() => {
    fetch('/api/knowledge')
      .then(res => res.json())
      .then((data: KBItem[]) => setKbList(data))
      .catch(() => {});
  }, []);

  const handleAdd = () => {
    if (newName.trim() && newPath.trim()) {
      addWorkspace(newName.trim(), newPath.trim(), selectedKbIds);
      message.success('工作区已添加');
      setNewName(''); setNewPath(''); setSelectedKbIds([]); setShowAdd(false);
    }
  };

  return (
    <>
      <Tabs
        activeKey={activeWorkspaceId}
        onChange={setActiveWorkspaceId}
        type="editable-card"
        hideAdd
        size="small"
        items={workspaces.map(ws => ({
          key: ws.id,
          label: ws.name,
          closable: ws.id !== 'default',
        }))}
        tabBarExtraContent={
          <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => setShowAdd(true)} />
        }
        style={{ margin: 0 }}
      />
      <Modal title="添加工作区" open={showAdd} onOk={handleAdd} onCancel={() => setShowAdd(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input placeholder="工作区名称" value={newName} onChange={e => setNewName(e.target.value)} />
          <Input placeholder="项目路径" value={newPath} onChange={e => setNewPath(e.target.value)} />
          <Select
            mode="multiple"
            placeholder="关联知识库（可选）"
            value={selectedKbIds}
            onChange={setSelectedKbIds}
            options={kbList.map(kb => ({ label: kb.name, value: kb.id }))}
            style={{ width: '100%' }}
          />
        </div>
      </Modal>
    </>
  );
}
