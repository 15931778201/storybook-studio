# 嵌入模型可配置 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将嵌入模型名称、API Key、Base URL 纳入 ModelConfig 体系，用户可在前端设置页面独立配置。

**Architecture:** ModelConfig 增加三个嵌入字段，存入 SQLite 同一张表。`embeddings.ts` 通过模块级默认配置 + 调用方参数读取嵌入配置，fallback 到环境变量。前端 SettingsPage 改为 Tabs 布局，嵌入配置独立 Tab。

**Tech Stack:** TypeScript, Bun SQLite, Ant Design, Hono

---

### Task 1: 更新类型定义和持久化层

**Files:**
- Modify: `src/types/config.ts`
- Modify: `src/storage/model-config-store.ts`
- Modify: `server/routes/model-config.ts`

- [ ] **Step 1: ModelConfig 增加嵌入字段**

```typescript
// src/types/config.ts:18-28
export interface ModelConfig {
  id: string;
  model: string;
  apiKey: string;
  baseURL: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  embeddingModel: string;
  embeddingApiKey: string;
  embeddingBaseURL: string;
}
```

- [ ] **Step 2: DEFAULT_CONFIG 增加默认值**

```typescript
// src/storage/model-config-store.ts:4-14
const DEFAULT_CONFIG: ModelConfig = {
  id: crypto.randomUUID(),
  model: process.env.OPENAI_MODEL || "gpt-4o",
  apiKey: process.env.OPENAI_API_KEY || "",
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  temperature: 0.7,
  maxTokens: 8192,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
  embeddingApiKey: "",
  embeddingBaseURL: "",
};
```

- [ ] **Step 3: SQLite 表增加三列 + 迁移逻辑**

```typescript
// src/storage/model-config-store.ts:29-44
private init() {
  this.db.run(`
    CREATE TABLE IF NOT EXISTS model_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      model TEXT NOT NULL,
      api_key TEXT NOT NULL,
      base_url TEXT NOT NULL,
      temperature REAL NOT NULL DEFAULT 0.7,
      max_tokens INTEGER NOT NULL DEFAULT 4096,
      top_p REAL NOT NULL DEFAULT 1.0,
      frequency_penalty REAL NOT NULL DEFAULT 0.0,
      presence_penalty REAL NOT NULL DEFAULT 0.0,
      embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
      embedding_api_key TEXT NOT NULL DEFAULT '',
      embedding_base_url TEXT NOT NULL DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  // 兼容旧表：安全地增加嵌入配置列（已存在时报错，忽略即可）
  try { this.db.run("ALTER TABLE model_config ADD COLUMN embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-small'"); } catch {}
  try { this.db.run("ALTER TABLE model_config ADD COLUMN embedding_api_key TEXT NOT NULL DEFAULT ''"); } catch {}
  try { this.db.run("ALTER TABLE model_config ADD COLUMN embedding_base_url TEXT NOT NULL DEFAULT ''"); } catch {}
}
```

- [ ] **Step 4: ModelConfigStore.save 写入嵌入字段**

```typescript
// src/storage/model-config-store.ts:62-78
save(config: ModelConfig): void {
  this.db.run(
    `INSERT OR REPLACE INTO model_config 
      (id, model, api_key, base_url, temperature, max_tokens, top_p, frequency_penalty, presence_penalty, embedding_model, embedding_api_key, embedding_base_url) 
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      config.model,
      config.apiKey,
      config.baseURL,
      config.temperature,
      config.maxTokens,
      config.topP,
      config.frequencyPenalty,
      config.presencePenalty,
      config.embeddingModel,
      config.embeddingApiKey,
      config.embeddingBaseURL,
    ]
  );
}
```

- [ ] **Step 5: ModelConfigStore.get 读取嵌入字段**

```typescript
// src/storage/model-config-store.ts:46-60
get(): ModelConfig | null {
  const row = this.db.query("SELECT * FROM model_config WHERE id = 1").get() as any;
  if (!row) return null;
  return {
    id: row.id,
    model: row.model,
    apiKey: row.api_key,
    baseURL: row.base_url,
    temperature: row.temperature,
    maxTokens: row.max_tokens,
    topP: row.top_p,
    frequencyPenalty: row.frequency_penalty,
    presencePenalty: row.presence_penalty,
    embeddingModel: row.embedding_model,
    embeddingApiKey: row.embedding_api_key,
    embeddingBaseURL: row.embedding_base_url,
  };
}
```

- [ ] **Step 6: POST route 包含嵌入字段**

```typescript
// server/routes/model-config.ts:22-40
modelConfig.post('/', async (c) => {
  try {
    const config = await c.req.json();
    modelConfigStore.save({
      id: crypto.randomUUID(),
      model: config.model,
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      embeddingModel: config.embeddingModel || process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      embeddingApiKey: config.embeddingApiKey || '',
      embeddingBaseURL: config.embeddingBaseURL || '',
    });
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});
```

- [ ] **Step 7: 提交**

```bash
git add src/types/config.ts src/storage/model-config-store.ts server/routes/model-config.ts
git commit -m "feat: add embedding model fields to ModelConfig types and persistence"
```

---

### Task 2: 重构 embedding 函数支持配置

**Files:**
- Modify: `src/vector/embeddings.ts`

- [ ] **Step 1: 添加模块级默认配置和 setter**

```typescript
// src/vector/embeddings.ts
import OpenAI from 'openai';

type EmbeddingOptions = { model?: string; apiKey?: string; baseURL?: string };

let defaultEmbeddingConfig: EmbeddingOptions = {};

export function setDefaultEmbeddingConfig(config: EmbeddingOptions) {
  defaultEmbeddingConfig = config;
}
```

- [ ] **Step 2: 重写 generateEmbeddings 支持选项参数**

```typescript
// src/vector/embeddings.ts
export async function generateEmbeddings(texts: string[], options?: EmbeddingOptions): Promise<number[][]> {
  if (process.env.DISABLE_VECTOR_SEARCH === 'true') return texts.map(() => []);

  const model = options?.model || defaultEmbeddingConfig.model || process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  const apiKey = options?.apiKey || defaultEmbeddingConfig.apiKey || process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY;
  const baseURL = options?.baseURL || defaultEmbeddingConfig.baseURL || process.env.EMBEDDING_BASE_URL || process.env.OPENAI_BASE_URL;

  const client = new OpenAI({ apiKey, baseURL, timeout: 30000 });

  try {
    const res = await client.embeddings.create({ model, input: texts });
    return res.data.map(d => d.embedding);
  } catch (e: any) {
    if (e.status === 404) {
      try {
        const fallback = await client.embeddings.create({ model: "text-embedding-ada-002", input: texts });
        return fallback.data.map(d => d.embedding);
      } catch (fallbackErr: any) {
        console.warn("嵌入模型回退也失败，将返回空嵌入:", fallbackErr?.message || fallbackErr);
        return texts.map(() => []);
      }
    }
    if (e.status === 403) {
      console.warn("嵌入请求被阻止(403)，请检查 API Key 权限或账户状态，将返回空嵌入:", e?.message || e);
      return texts.map(() => []);
    }
    throw e;
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add src/vector/embeddings.ts
git commit -m "feat: refactor generateEmbeddings to accept configurable model/apiKey/baseURL"
```

---

### Task 3: 在 server 启动时注入嵌入配置

**Files:**
- Modify: `server/context.ts`

- [ ] **Step 1: 创建 modelConfigStore 后注入嵌入配置**

```typescript
// server/context.ts:18 之后增加
import { setDefaultEmbeddingConfig } from '../src/vector/embeddings';

// ...

export const modelConfigStore = new ModelConfigStore('.agent/config.db');

// 从存储的配置中读取嵌入配置作为默认值
const storedConfig = modelConfigStore.get();
if (storedConfig) {
  setDefaultEmbeddingConfig({
    model: storedConfig.embeddingModel,
    apiKey: storedConfig.embeddingApiKey,
    baseURL: storedConfig.embeddingBaseURL,
  });
}
```

- [ ] **Step 2: 提交**

```bash
git add server/context.ts
git commit -m "feat: wire up embedding config from ModelConfigStore on startup"
```

---

### Task 4: 更新前端类型

**Files:**
- Modify: `web/src/types/models.ts`

- [ ] **Step 1: ModelConfig + 嵌入字段**

```typescript
// web/src/types/models.ts
export interface ModelConfig {
  model: string;
  apiKey: string;
  baseURL: string;
  temperature: number;
  maxTokens: number;
  embeddingModel: string;
  embeddingApiKey: string;
  embeddingBaseURL: string;
}
```

- [ ] **Step 2: 更新默认值和 loadModelConfig 的后向兼容**

```typescript
// web/src/types/models.ts
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  model: 'gpt-4o',
  apiKey: '',
  baseURL: '',
  temperature: 0.7,
  maxTokens: 8000,
  embeddingModel: 'text-embedding-3-small',
  embeddingApiKey: '',
  embeddingBaseURL: '',
};

export function loadModelConfig(): ModelConfig {
  try {
    const stored = localStorage.getItem('modelConfig');
    if (stored) return { ...DEFAULT_MODEL_CONFIG, ...JSON.parse(stored) };
  } catch {}
  return { ...DEFAULT_MODEL_CONFIG };
}
```

- [ ] **Step 3: 提交**

```bash
git add web/src/types/models.ts
git commit -m "feat: add embedding model fields to frontend ModelConfig"
```

---

### Task 5: 重构 SettingsPage 为 Tabs 布局 + 嵌入配置表单

**Files:**
- Modify: `web/src/pages/SettingsPage.tsx`

- [ ] **Step 1: 改为 Tabs 布局，LLM 配置和嵌入模型各一个 Tab**

```tsx
// web/src/pages/SettingsPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form, Input, InputNumber, Button, Card, message, Typography, Space, Divider, Tabs,
} from 'antd';
import { UserOutlined, CloudOutlined, RobotOutlined } from '@ant-design/icons';
import { loadModelConfig, saveModelConfig, ModelConfig } from '../types/models';
import { useChatContext } from '../providers/ChatProvider';

export default function SettingsPage() {
  const [llmForm] = Form.useForm();
  const [embedForm] = Form.useForm();
  const [savingLlm, setSavingLlm] = useState(false);
  const [savingEmbed, setSavingEmbed] = useState(false);
  const navigate = useNavigate();
  const { activeRole, setActiveRole } = useChatContext();

  useEffect(() => {
    const config = loadModelConfig();
    llmForm.setFieldsValue(config);
    embedForm.setFieldsValue({
      embeddingModel: config.embeddingModel,
      embeddingApiKey: config.embeddingApiKey,
      embeddingBaseURL: config.embeddingBaseURL,
    });
  }, []);

  const handleSaveLlm = async () => {
    try {
      const values = await llmForm.validateFields();
      const current = loadModelConfig();
      saveModelConfig({ ...current, ...values });
      message.success('模型配置已保存');
      setSavingLlm(false);
    } catch {}
  };

  const handleSaveEmbed = async () => {
    try {
      const values = await embedForm.validateFields();
      const current = loadModelConfig();
      saveModelConfig({
        ...current,
        embeddingModel: values.embeddingModel,
        embeddingApiKey: values.embeddingApiKey,
        embeddingBaseURL: values.embeddingBaseURL,
      });
      message.success('嵌入模型配置已保存');
      setSavingEmbed(false);
    } catch {}
  };

  const tabItems = [
    {
      key: 'llm',
      label: <span><CloudOutlined /> LLM 配置</span>,
      children: (
        <Card>
          <Form form={llmForm} layout="vertical">
            <Form.Item name="model" label="模型名称" rules={[{ required: true }]}>
              <Input placeholder="gpt-4o" />
            </Form.Item>
            <Form.Item name="apiKey" label="API Key（留空使用环境变量）">
              <Input.Password placeholder="sk-..." />
            </Form.Item>
            <Form.Item name="baseURL" label="Base URL">
              <Input placeholder="https://api.openai.com/v1" />
            </Form.Item>
            <Space size="large">
              <Form.Item name="temperature" label="温度" rules={[{ required: true }]}>
                <InputNumber min={0} max={2} step={0.1} />
              </Form.Item>
              <Form.Item name="maxTokens" label="最大 Tokens" rules={[{ required: true }]}>
                <InputNumber min={100} max={128000} step={100} />
              </Form.Item>
            </Space>
            <Button type="primary" onClick={handleSaveLlm} loading={savingLlm}>
              保存模型配置
            </Button>
          </Form>
        </Card>
      ),
    },
    {
      key: 'embed',
      label: <span><RobotOutlined /> 嵌入模型</span>,
      children: (
        <Card>
          <Typography.Paragraph type="secondary">
            留空则依次回退到 EMBEDDING_xxx 环境变量和 LLM 配置
          </Typography.Paragraph>
          <Form form={embedForm} layout="vertical">
            <Form.Item name="embeddingModel" label="嵌入模型名称" rules={[{ required: true }]}>
              <Input placeholder="text-embedding-3-small" />
            </Form.Item>
            <Form.Item name="embeddingApiKey" label="API Key（留空回退环境变量）">
              <Input.Password placeholder="sk-..." />
            </Form.Item>
            <Form.Item name="embeddingBaseURL" label="Base URL（留空回退环境变量）">
              <Input placeholder="https://api.openai.com/v1" />
            </Form.Item>
            <Button type="primary" onClick={handleSaveEmbed} loading={savingEmbed}>
              保存嵌入配置
            </Button>
          </Form>
        </Card>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Typography.Title level={4}>⚙️ 设置</Typography.Title>

      <Tabs items={tabItems} style={{ marginBottom: 24 }} />

      <Card
        title="角色管理"
        extra={
          <Button size="small" icon={<UserOutlined />} onClick={() => navigate('/roles')}>
            管理角色
          </Button>
        }
        style={{ marginBottom: 24 }}
      >
        <Typography.Paragraph type="secondary">
          {activeRole
            ? `当前角色：${activeRole.name}（${activeRole.title || '自定义'}）`
            : '当前角色：无角色（正常对话模式）'}
        </Typography.Paragraph>
        <Button type="link" onClick={() => setActiveRole(null)}>取消角色</Button>
        <Button type="link" onClick={() => navigate('/roles')}>前往角色管理</Button>
      </Card>

      <Divider />

      <Card title="关于 AgentKit">
        <Typography.Paragraph>
          AgentKit v0.1.0 — 企业级 AI Agent 开发框架，集成了 Skills、MCP、RAG、工作流等能力。
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add web/src/pages/SettingsPage.tsx
git commit -m "feat: add embedding model config tab in SettingsPage"
```

---

### Task 6: 验证构建

- [ ] **Step 1: 检查 TypeScript 编译**

Run: `bun run typecheck` 或 `npx tsc --noEmit`
Expected: PASS — zero type errors

- [ ] **Step 2: 如有 lint 脚本则运行**

Run: `bun run lint` (如果存在)
Expected: PASS
