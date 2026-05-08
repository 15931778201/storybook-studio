import { Tabs, Button, Modal, Input, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useChatContext } from '../providers/ChatProvider';

export default function WorkspaceTabs() {
  const { workspaces, activeWorkspaceId, setActiveWorkspaceId, addWorkspace } = useChatContext();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');

  const handleAdd = () => {
    if (newName.trim() && newPath.trim()) {
      addWorkspace(newName.trim(), newPath.trim());
      setNewName('');
      setNewPath('');
      setShowAdd(false);
    }
  };

  return (
    <>
      <Tabs
        activeKey={activeWorkspaceId}
        onChange={setActiveWorkspaceId}
        type="editable-card"
        hideAdd
        items={workspaces.map((ws) => ({
          key: ws.id,
          label: ws.name,
        }))}
        tabBarExtraContent={
          <Button
            type="text"
            icon={<PlusOutlined />}
            onClick={() => setShowAdd(true)}
          />
        }
        style={{ marginBottom: 0, background: '#fafafa', padding: '0 16px' }}
      />

      <Modal
        title="添加工作区"
        open={showAdd}
        onOk={handleAdd}
        onCancel={() => setShowAdd(false)}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            placeholder="工作区名称"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Input
            placeholder="项目路径（如 /path/to/project）"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
          />
        </Space>
      </Modal>
    </>
  );
}