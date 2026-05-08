import { useState } from 'react';
import { Upload, Button, message, Image } from 'antd';
import { PictureOutlined, DeleteOutlined } from '@ant-design/icons';
export default function ImageUpload({ onImageReady, onClear, disabled }: { onImageReady: (b64: string) => void; onClear: () => void; disabled?: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);
  const handleUpload = async (file: File) => {
    const fd = new FormData(); fd.append('image', file);
    const res = await fetch('/api/upload/image', { method: 'POST', body: fd }); const data = await res.json();
    if (data.success) { setPreview(data.dataUri); onImageReady(data.dataUri.split(',')[1]); message.success('已上传'); } else message.error('失败');
    return false;
  };
  const clear = () => { setPreview(null); onClear(); };
  return (
    <div style={{ padding: '8px 0' }}>
      {preview ? <div style={{ position: 'relative', display: 'inline-block' }}><Image src={preview} width={100} height={100} style={{ borderRadius: 8, objectFit: 'cover' }} /><Button size="small" danger icon={<DeleteOutlined />} onClick={clear} style={{ position: 'absolute', top: -8, right: -8, borderRadius: '50%' }} /></div>
        : <Upload beforeUpload={handleUpload} showUploadList={false} accept="image/*" disabled={disabled}><Button icon={<PictureOutlined />} disabled={disabled}>上传图片</Button></Upload>}
    </div>
  );
}