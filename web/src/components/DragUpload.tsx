import { Upload, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';

const { Dragger } = Upload;

export default function DragUpload() {
  const props = {
    name: 'file',
    multiple: true,
    action: '/api/rag/upload',
    onChange(info: any) {
      const { status } = info.file;
      if (status === 'done') message.success(`${info.file.name} 上传成功，已加入知识库`);
      else if (status === 'error') message.error(`${info.file.name} 上传失败`);
    },
    showUploadList: false,
  };

  return (
    <Dragger {...props} style={{ padding: 20, marginTop: 20 }}>
      <p className="ant-upload-drag-icon">
        <InboxOutlined />
      </p>
      <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
      <p className="ant-upload-hint">支持 Markdown、TXT，将自动加入知识库</p>
    </Dragger>
  );
}