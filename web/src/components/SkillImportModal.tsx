import { useState } from 'react';
import { Modal, Tabs, Input, Upload, Button, message, List, Tag, Alert, Typography, Space } from 'antd';
import { UploadOutlined, LinkOutlined, InboxOutlined } from '@ant-design/icons';

const { Dragger } = Upload;
const { TextArea } = Input;

interface ImportResultItem {
  name: string;
  title: string;
  overwritten?: boolean;
  reason?: string;
  error?: string;
}

interface ImportResponse {
  imported: ImportResultItem[];
  skipped: ImportResultItem[];
  errors: ImportResultItem[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export default function SkillImportModal({ open, onClose, onImported }: Props) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);

  const reset = () => {
    setUrl('');
    setZipFile(null);
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const importFromUrl = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/skills/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'url', value: url.trim(), force: false }),
      });
      const data: ImportResponse = await res.json();
      setResult(data);
      if (data.imported.length > 0) onImported();
    } catch (e: any) {
      message.error('导入请求失败');
    } finally {
      setLoading(false);
    }
  };

  const importFromZip = async () => {
    if (!zipFile) return;
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('type', 'zip');
      formData.append('file', zipFile);
      formData.append('force', 'false');
      const res = await fetch('/api/skills/import', {
        method: 'POST',
        body: formData,
      });
      const data: ImportResponse = await res.json();
      setResult(data);
      if (data.imported.length > 0) onImported();
    } catch (e: any) {
      message.error('导入请求失败');
    } finally {
      setLoading(false);
    }
  };

  const renderResult = () => {
    if (!result) return null;
    return (
      <div style={{ marginTop: 16 }}>
        {result.imported.length > 0 && (
          <Alert
            type="success"
            showIcon
            message={`成功导入 ${result.imported.length} 个技能`}
            description={
              <List
                size="small"
                dataSource={result.imported}
                renderItem={item => (
                  <List.Item>
                    <Space>
                      <Tag color="green">{item.name}</Tag>
                      <span>{item.title}</span>
                      {item.overwritten && <Tag>已覆盖</Tag>}
                    </Space>
                  </List.Item>
                )}
              />
            }
            style={{ marginBottom: 8 }}
          />
        )}
        {result.skipped.length > 0 && (
          <Alert
            type="warning"
            showIcon
            message={`${result.skipped.length} 个技能已跳过`}
            description={
              <List
                size="small"
                dataSource={result.skipped}
                renderItem={item => (
                  <List.Item>
                    <Space>
                      <Tag color="orange">{item.name}</Tag>
                      <span>{item.reason}</span>
                    </Space>
                  </List.Item>
                )}
              />
            }
            style={{ marginBottom: 8 }}
          />
        )}
        {result.errors.length > 0 && (
          <Alert
            type="error"
            showIcon
            message={`${result.errors.length} 个技能导入失败`}
            description={
              <List
                size="small"
                dataSource={result.errors}
                renderItem={item => (
                  <List.Item>
                    <Space>
                      <Tag color="red">{item.name}</Tag>
                      <span>{item.error}</span>
                    </Space>
                  </List.Item>
                )}
              />
            }
          />
        )}
      </div>
    );
  };

  const urlTab = (
    <div style={{ padding: '16px 0' }}>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        支持 GitHub 仓库 URL（如 https://github.com/user/skill-repo）或任意 Markdown 技能文件直链
      </Typography.Text>
      <Space direction="vertical" style={{ width: '100%' }}>
        <TextArea
          rows={2}
          placeholder="https://github.com/user/skill-repo"
          value={url}
          onChange={e => setUrl(e.target.value)}
        />
        <Button type="primary" icon={<LinkOutlined />} onClick={importFromUrl} loading={loading} disabled={!url.trim()}>
          导入
        </Button>
      </Space>
      {renderResult()}
    </div>
  );

  const zipTab = (
    <div style={{ padding: '16px 0' }}>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        上传 ZIP 文件，系统将扫描 skills/ 目录或根目录下的 .md 文件
      </Typography.Text>
      <Dragger
        accept=".zip"
        showUploadList={true}
        beforeUpload={file => {
          setZipFile(file);
          return false;
        }}
        onRemove={() => setZipFile(null)}
        maxCount={1}
      >
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">点击或拖拽 ZIP 文件到此区域</p>
        <p className="ant-upload-hint">仅支持 .zip 格式</p>
      </Dragger>
      <Button
        type="primary"
        icon={<UploadOutlined />}
        onClick={importFromZip}
        loading={loading}
        disabled={!zipFile}
        style={{ marginTop: 16 }}
      >
        导入
      </Button>
      {renderResult()}
    </div>
  );

  return (
    <Modal
      title="导入技能"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={640}
      destroyOnClose
    >
      <Tabs
        items={[
          { key: 'url', label: 'URL 导入', children: urlTab },
          { key: 'zip', label: 'ZIP 导入', children: zipTab },
        ]}
      />
    </Modal>
  );
}
