import { useState } from 'react';
import { Upload, message, Card, Typography } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
const { Dragger } = Upload;
export default function KnowledgePage() {
  const [indexing, setIndexing] = useState(false);
  const props = {
    name: 'files', multiple: true, action: '/api/rag/upload',
    onChange(info: any) { if (info.file.status === 'done') { message.success(info.file.name + ' 上传成功'); setIndexing(true); setTimeout(() => setIndexing(false), 2000); } else if (info.file.status === 'error') message.error(info.file.name + ' 上传失败'); },
    showUploadList: false, accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.md,.csv,.ts,.tsx,.js,.py,.java,.c,.cpp,.h,.go,.rs,.vue,.css,.html,.sh,.sql',
  };
  return (
    <div style={{ padding: 24, margin: '0 auto' }}>
      <Typography.Title level={4}>📚 知识库</Typography.Title>
      <Card>
        <Dragger {...props} style={{ padding: 20 }}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击或拖拽文件上传</p>
          <p className="ant-upload-hint">支持 PDF、Word、Excel、PPT、ZIP、代码文件等</p>
        </Dragger>
        {indexing && <Typography.Text type="secondary" style={{ display: 'block', marginTop: 12 }}>正在索引文档…</Typography.Text>}
      </Card>
    </div>
  );
}