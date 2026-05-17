# 知识库全面优化方案

## 概述

对现有知识库系统进行 5 层渐进式优化：增量索引 → BM25 + Reranker → Embedding 缓存 + SQLite → 前端体验 → 知识图谱。

## Layer 1 — 基础架构：增量索引

### 现状问题

当前每次文件增删改都触发 `indexOne()`，内部 `indexDocuments(clearFirst=true)` 清空所有向量和关键词后全量重算。改 1 个文件也要重算所有文件的 embedding（远程 API 调用）。

### 方案

`KnowledgeBase` 新增 `indexManifest.json` 文件，记录每个文件的 `contentHash` + `lastModified`。`indexDocuments()` 改为增量模式：

1. 扫描 `docsDir` 下所有文件
2. 读取 manifest 对比 hash
3. 新增/修改的文件 → 生成 embedding + 提取关键词
4. 已删除的文件 → 从向量库和关键词索引中移除
5. 未变更的文件 → 跳过
6. 更新 manifest

### 接口变更

- `FileVectorStore` 新增 `deleteByPrefix(prefix)` 按文件 ID 前缀批量删除
- 上层 API 完全透明

## Layer 2 — 检索质量

### 2.1 BM25 替代关键词命中计数

当前 `KeywordIndex.search()` 返回 `Map<chunkId, hitCount>`。替换为 BM25 算法：

- **存储变更**：从 `Map<term, chunkId[]>` 改为 `Map<term, { chunkId, tf }[]>`，存储词频
- **BM25 公式**：`score = IDF * TF * (k1+1) / (TF + k1 * (1 - b + b * docLen/avgDocLen))`
  - `k1 = 1.5`, `b = 0.75`（标准参数）
  - `IDF = log((N - n + 0.5) / (n + 0.5) + 1)`
- **融合公式保留**：`finalScore = (1 - kwWeight) * vectorScore + kwWeight * bm25Score`

### 2.2 自适应关键词权重

当前 `keywordWeight = 0.3` 固定。改为动态调整：
- 查询含大写标识符、代码符号（`::`、`.`、`->`、`<`等）→ 提高至 0.5
- 查询为纯自然语言 → 保持 0.3
- 中等混排 → 0.4

### 2.3 Reranker 重排序

- 混合召回 `topK * 5` 候选
- 使用 reranker 对候选对 `<query, chunk>` 重新打分
- 取 rerank 后 topK
- 使用 `@xenova/transformers` 运行本地 BGE-reranker（可选轻量 `BAAI/bge-reranker-v2-m3`）

### 2.4 查询改写

对查询做轻量改写：
- 代码查询自动提取符号名
- 中英文混排优化

## Layer 3 — 性能

### 3.1 Embedding 缓存

- `src/rag/embedding-cache.ts`：SQLite 缓存表
  - `CREATE TABLE embedding_cache (text_hash TEXT PRIMARY KEY, model TEXT, embedding TEXT, created_at INT)`
  - key = `md5(content)` + modelName
  - 先查缓存，未命中再调 API

### 3.2 SQLite 向量存储

`FileVectorStore` 后端从 JSON 改为 SQLite：
- `vectors` 表：`(id TEXT, content TEXT, embedding TEXT, metadata TEXT)`
- 支持增量增删（`INSERT/ DELETE WHERE id LIKE prefix`）
- 无需全量读/写 JSON，大文件不 OOM
- 余弦相似度计算：全表扫描 + JS 计算（和之前一致）

## Layer 4 — 前端体验

### 4.1 配置面板

知识库详情页增加"设置"区域：
- chunkSize / chunkOverlap / keywordWeight 滑块 + 数值输入
- 保存后调用 API `/api/knowledge/:id/config` 更新，自动重索引

### 4.2 检索测试工具

在知识库页面增加"检索测试"面板：
- 输入查询语句
- 显示召回结果：chunk 列表 + 来源文件 + 分数
- 可对比不同配置的效果

### 4.3 分块可视化

FileViewPage 增加"分块视图"模式：
- 卡片展示每个 chunk
- 显示块编号、字符数

### 4.4 文件搜索/过滤

文件列表增加搜索输入框，前端实时过滤。

## Layer 5 — 知识图谱

### 5.1 实体提取

从文档 chunk 提取实体：
- **代码实体**：`function\s+(\w+)`、`class\s+(\w+)`、`interface\s+(\w+)`、`const\s+(\w+)` 等
- **文本实体**：高频词（复用 tokenizer，按 IDF 筛选 top term）
- **文件实体**：文件名作为顶级实体

### 5.2 关系构建

| 关系类型 | 规则 |
|---------|------|
| co_occur | 同一 chunk 中出现 → 关联 |
| imports | 代码中 import/require → 关联 |
| hierarchy | 类 → 方法 / 文件 → 实体 |

存储格式：邻接表 JSON（`-graph.json` 与 `vectors.json` 同目录）

```
{
  "entities": [
    { "id": "e1", "label": "KnowledgeBase", "type": "class", "chunkIds": ["..."] }
  ],
  "edges": [
    { "from": "e1", "to": "e2", "type": "co_occur" }
  ]
}
```

### 5.3 图谱增强检索

1. 从查询中提取实体 → 匹配图谱节点
2. BFS 遍历 1-2 hop → 收集关联实体
3. 收集关联实体的 chunkId → 作为补充候选
4. 与向量+BM25 结果合并去重 → rerank

### 5.4 前端图谱可视化

- 使用 `vis-network` 渲染力导向图
- 节点颜色按类型区分
- 点击节点显示关联文档
- 缩放/拖拽/过滤

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/rag/knowledge-base.ts` | 修改 | 增量索引 + BM25 + 自适应权重 + Reranker + 图谱集成 |
| `src/rag/keyword-index.ts` | 修改 | BM25 存储结构 + 计算 |
| `src/rag/knowledge-graph.ts` | 新增 | 实体提取 + 关系构建 + 图遍历 |
| `src/rag/embedding-cache.ts` | 新增 | SQLite embedding 缓存 |
| `src/vector/file-vector-store.ts` | 修改 | SQLite 后端 + deleteByPrefix |
| `src/rag/knowledge-manager.ts` | 修改 | KB 配置读写 |
| `server/routes/knowledge.ts` | 修改 | 配置 API + 图谱 API |
| `server/context.ts` | 修改 | 传递缓存实例 |
| `web/src/pages/KnowledgePage.tsx` | 修改 | 配置面板 + 检索测试 + 文件搜索 + 图谱标签 |
| `web/src/pages/FileViewPage.tsx` | 修改 | 分块可视化 |
| `web/src/components/KnowledgeGraphView.tsx` | 新增 | 图谱可视化组件 |
| `web/package.json` | 修改 | 新增 vis-network |

## 实施顺序

Layer 1 → Layer 2 → Layer 3 → Layer 4 → Layer 5

每层独立可测试，不阻塞后续层。
