import { Modal, Button, Space, Tag, Typography } from 'antd';
import CodeDiffEditor from './DiffEditor';

interface Props {
  toolName: string;
  diff: string;
  onConfirm: () => void;
  onReject: () => void;
}

// 从 diff 字符串中提取原始和修改内容
function parseDiff(diffText: string): { original: string; modified: string } {
  const originalLines: string[] = [];
  const modifiedLines: string[] = [];

  for (const line of diffText.split('\n')) {
    if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@')) {
      continue;
    }
    if (line.startsWith('-')) {
      originalLines.push(line.slice(1));
    } else if (line.startsWith('+')) {
      modifiedLines.push(line.slice(1));
    } else {
      originalLines.push(line);
      modifiedLines.push(line);
    }
  }

  return {
    original: originalLines.join('\n'),
    modified: modifiedLines.join('\n'),
  };
}

export default function ConfirmDialog({ toolName, diff, onConfirm, onReject }: Props) {
  const { original, modified } = parseDiff(diff);

  // 判断语言类型
  const getLanguage = () => {
    if (diff.includes('.tsx') || diff.includes('.ts')) return 'typescript';
    if (diff.includes('.jsx') || diff.includes('.js')) return 'javascript';
    if (diff.includes('.py')) return 'python';
    if (diff.includes('.html')) return 'html';
    if (diff.includes('.css')) return 'css';
    if (diff.includes('.json')) return 'json';
    return 'text';
  };

  return (
    <Modal
      title={
        <Space>
          <span>确认执行修改</span>
          <Tag color="blue">{toolName}</Tag>
        </Space>
      }
      open
      onCancel={onReject}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onReject} size="large">
            拒绝
          </Button>
          <Button type="primary" onClick={onConfirm} size="large">
            确认执行
          </Button>
        </div>
      }
      width={900}
      style={{ top: 20 }}
    >
      <Typography.Text type="secondary" style={{ marginBottom: 12, display: 'block' }}>
        左侧为原始文件，右侧为修改后文件
      </Typography.Text>
      <CodeDiffEditor
        original={original}
        modified={modified}
        language={getLanguage()}
      />
    </Modal>
  );
}