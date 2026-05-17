# 嵌入模型可配置设计

## 背景

当前嵌入模型名称在 `src/vector/embeddings.ts` 中硬编码为 `text-embedding-3-small`，虽然 `.env` 中定义了 `OPENAI_EMBEDDING_MODEL` 变量，但代码并未读取。用户需要在 UI/API 层面将嵌入模型（含独立 API Key、Base URL）纳入模型配置体系。

## 目标

- 允许用户在设置页面独立配置嵌入模型的模型名称、API Key、Base URL
- 配置持久化到 SQLite `ModelConfigStore`，与 LLM 配置共享同一张表
- 前端通过 Settings 页面的独立 Tab 展示嵌入配置
- 向后兼容：环境变量 `EMBEDDING_API_KEY`、`EMBEDDING_BASE_URL`、`OPENAI_EMBEDDING_MODEL` 仍然生效

## 类型变更

### 服务端 `src/types/config.ts`

```typescript
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
  // 新增
  embeddingModel: string;
  embeddingApiKey: string;
  embeddingBaseURL: string;
}
```

### 前端 `web/src/types/models.ts`

```typescript
export interface ModelConfig {
  model: string;
  apiKey: string;
  baseURL: string;
  temperature: number;
  maxTokens: number;
  // 新增
  embeddingModel: string;
  embeddingApiKey: string;
  embeddingBaseURL: string;
}
```

### 默认值

| 字段 | 默认值 |
|------|--------|
| `embeddingModel` | `'text-embedding-3-small'` |
| `embeddingApiKey` | `''`（空，触发 fallback） |
| `embeddingBaseURL` | `''`（空，触发 fallback） |

## 数据持久化

`ModelConfigStore` 在 SQLite 创建表时增加三列：

```sql
ALTER TABLE model_config ADD COLUMN embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-small';
ALTER TABLE model_config ADD COLUMN embedding_api_key TEXT NOT NULL DEFAULT '';
ALTER TABLE model_config ADD COLUMN embedding_base_url TEXT NOT NULL DEFAULT '';
```

新的 `ModelConfigStore.get()` 返回完整对象包含新字段，现有 REST API（GET/PUT `/api/model-config`）自动支持。

## Embedding 函数重构

### Fallback 链

```
embeddingModel:  调用方参数 → process.env.OPENAI_EMBEDDING_MODEL → 'text-embedding-3-small'
embeddingApiKey: 调用方参数 → process.env.EMBEDDING_API_KEY → process.env.OPENAI_API_KEY
embeddingBaseURL:调用方参数 → process.env.EMBEDDING_BASE_URL → process.env.OPENAI_BASE_URL
```

### API 签名

```typescript
export async function generateEmbeddings(
  texts: string[],
  options?: { model?: string; apiKey?: string; baseURL?: string }
): Promise<number[][]>
```

内部使用 `options` 传入的值，缺失时按 fallback 链逐级回退。所有现有调用方（无 `options` 参数）向后兼容。

## 调用链路

```
buildAgentConfig()
  → 从 ModelConfigStore 读取 embeddingModel/apiKey/baseURL
  → 组装到 AgentConfig 中

AgentLoop → pipeline
  → knowledge-base / skill-manager 从 AgentConfig 获取嵌入配置
  → 调用 generateEmbeddings(texts, { model, apiKey, baseURL })
```

`EmbeddingCache` 构造时接受可配置的 model 名称，不再硬编码。

## 前端 UI

SettingsPage 从垂直 Card 布局改为 Ant Design `<Tabs>` 布局：

- **Tab 1: LLM 配置** — 现有表单（模型名称、API Key、Base URL、温度、Max Tokens）
- **Tab 2: 嵌入模型** — 新表单（模型名称、API Key、Base URL）

嵌入 Tab 的表单项：
- 模型名称：必填，默认 `text-embedding-3-small`
- API Key：可选，placeholder 提示"留空使用环境变量"
- Base URL：可选，placeholder 提示"留空使用环境变量"

两个 Tab 共用同一份保存逻辑（`saveModelConfig`），统一持久化到 localStorage 和后端 `ModelConfigStore`。

## 向后兼容

- 现有 `.env` 文件的 `EMBEDDING_API_KEY`、`EMBEDDING_BASE_URL`、`OPENAI_EMBEDDING_MODEL` 继续生效
- `generateEmbeddings()` 无参数调用行为不变（fallback 到 env 再 fallback 到硬编码默认值）
- 旧数据库升级：通过 ALTER TABLE ADD COLUMN 增加新列，已有数据自动补默认值
- 前端已有 localStorage 数据缺少新字段，`loadModelConfig` 用默认值补充

## 未覆盖事项

- 嵌入模型的 provider 切换（如 Ollama 本地嵌入模型）不在本次范围内
- 嵌入配置的独立验证/连通性测试不在本次范围内
- 向量维度随模型变化的自动适配不在本次范围内
