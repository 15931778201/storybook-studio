import { useState } from 'react';
import { Upload, Button, Image, message, Space } from 'antd';
import { UploadOutlined, DeleteOutlined, PictureOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';

interface Props {
  onImageReady: (base64: string) => void;
  onClear: () => void;
  disabled?: boolean;
}

export default function ImageUpload({ onImageReady, onClear, disabled }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch('/api/upload/image', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (data.success) {
      setPreviewUrl(data.dataUri);
      onImageReady(data.dataUri.split(',')[1]); // 提取 Base64
      message.success('图片已上传');
    } else {
      message.error('上传失败');
    }
    return false; // 阻止默认上传行为
  };

  const handleClear = () => {
    setPreviewUrl(null);
    onClear();
  };

  return (
    <div style={{ padding: '8px 0' }}>
      {previewUrl ? (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <Image src={previewUrl} width={100} height={100} style={{ borderRadius: 8, objectFit: 'cover' }} />
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={handleClear}
            style={{ position: 'absolute', top: -8, right: -8, borderRadius: '50%' }}
          />
        </div>
      ) : (
        <Upload
          beforeUpload={handleUpload}
          showUploadList={false}
          accept="image/*"
          disabled={disabled}
        >
          <Button icon={<PictureOutlined />} disabled={disabled}>
            上传图片
          </Button>
        </Upload>
      )}
    </div>
  );
}