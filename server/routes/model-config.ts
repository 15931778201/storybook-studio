// server/routes/model-config.ts
import { Hono } from 'hono';
import { modelConfigStore } from '../context';
import type { ModelConfig } from '../../src/types/config';
import { setDefaultEmbeddingConfig } from '../../src/vector/embeddings';

const modelConfig = new Hono();

modelConfig.get('/', (c) => {
  const config = modelConfigStore.get();
  return c.json(config);
});

modelConfig.put('/', async (c) => {
  const body = await c.req.json();
  const current = modelConfigStore.get()!;
  const updated: ModelConfig = { ...current, ...body };
  modelConfigStore.save(updated);
  setDefaultEmbeddingConfig({
    model: updated.embeddingModel,
    apiKey: updated.embeddingApiKey,
    baseURL: updated.embeddingBaseURL,
  });
  return c.json({ success: true });
});

// 模型配置 API
  modelConfig.post('/', async (c) => {
    try {
      const config = await c.req.json();
      const saved = {
        model: config.model,
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        topP: config.topP ?? 1,
        frequencyPenalty: config.frequencyPenalty ?? 0,
        presencePenalty: config.presencePenalty ?? 0,
        embeddingModel: config.embeddingModel || process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
        embeddingApiKey: config.embeddingApiKey || process.env.EMBEDDING_API_KEY || '',
        embeddingBaseURL: config.embeddingBaseURL || process.env.EMBEDDING_BASE_URL || '',
      };
      modelConfigStore.save({ id: crypto.randomUUID(), ...saved } as ModelConfig);
      setDefaultEmbeddingConfig({
        model: saved.embeddingModel,
        apiKey: saved.embeddingApiKey,
        baseURL: saved.embeddingBaseURL,
      });
      return c.json({ success: true });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

export { modelConfig };