import { Modal, Tag, Typography, Space, Card } from 'antd';
import type { RoleProfile } from '../types/roles';

interface Props {
  role: RoleProfile | null;
  open: boolean;
  onClose: () => void;
}

export default function RoleDetailModal({ role, open, onClose }: Props) {
  if (!role) return null;

  return (
    <Modal
      title={
        <span>
          {role.name}
          {role.title && <span style={{ fontSize: 13, color: '#888', marginLeft: 8 }}>{role.title}</span>}
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
    >
      <div style={{ maxHeight: 500, overflowY: 'auto', paddingRight: 8 }}>

        {/* 基础信息 */}
        <Section title="基础信息">
          <Field label="角色描述">
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>
              {role.description || '-'}
            </div>
          </Field>
          <Field label="语气风格">
            <Tag color="blue">{role.tone || '-'}</Tag>
          </Field>
        </Section>

        {/* 进阶配置 */}
        {(role.thinkingFramework || role.outputFormat || role.constraints?.length || role.preferredTools?.length) && (
          <Section title="进阶配置">
            {role.thinkingFramework && (
              <Field label="思考框架">
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f5f5f5', padding: 8, borderRadius: 4, fontSize: 13, lineHeight: 1.6 }}>
                  {role.thinkingFramework}
                </div>
              </Field>
            )}
            {role.outputFormat && (
              <Field label="输出格式">
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>
                  {role.outputFormat}
                </div>
              </Field>
            )}
            {role.constraints && role.constraints.length > 0 && (
              <Field label="约束条件">
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {role.constraints.map((c, i) => (
                    <li key={i} style={{ marginBottom: 4, fontSize: 13 }}>{c}</li>
                  ))}
                </ul>
              </Field>
            )}
            {role.preferredTools && role.preferredTools.length > 0 && (
              <Field label="偏好工具">
                <Space wrap>
                  {role.preferredTools.map(t => <Tag key={t}>{t}</Tag>)}
                </Space>
              </Field>
            )}
          </Section>
        )}

        {/* 示例对话 */}
        {role.examples && role.examples.length > 0 && (
          <Section title="示例对话">
            {role.examples.map((ex, i) => (
              <Card key={i} size="small" style={{ marginBottom: 8, background: '#fafafa' }}>
                <Typography.Text type="warning" style={{ fontSize: 12, fontWeight: 'bold' }}>🧑 用户</Typography.Text>
                <pre style={{ margin: '4px 0 10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13, lineHeight: 1.6, fontFamily: 'inherit', background: '#fff', padding: 6, borderRadius: 4, border: '1px solid #eee' }}>
                  {ex.user}
                </pre>
                <Typography.Text type="success" style={{ fontSize: 12, fontWeight: 'bold' }}>🤖 助手</Typography.Text>
                <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13, lineHeight: 1.6, fontFamily: 'monospace', background: '#f5f5f5', padding: 8, borderRadius: 4, border: '1px solid #e0e0e0', maxHeight: 300, overflow: 'auto' }}>
                  {ex.assistant}
                </pre>
              </Card>
            ))}
          </Section>
        )}

        {/* 自定义 */}
        {role.customPrompt && (
          <Section title="额外提示词">
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f5f5f5', padding: 8, borderRadius: 4, fontSize: 13, lineHeight: 1.6 }}>
              {role.customPrompt}
            </div>
          </Section>
        )}
      </div>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <Typography.Text strong style={{ display: 'block', marginBottom: 8, fontSize: 14, color: '#555' }}>
        {title}
      </Typography.Text>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
        {label}
      </Typography.Text>
      {children}
    </div>
  );
}
