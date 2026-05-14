// server/routes/model-config.ts
import { Hono } from 'hono';
import { modelConfigStore } from '../context';
import type { ModelConfig } from '../../src/types/config';

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
  return c.json({ success: true });
});

// 模型配置 API
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
    });
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export { modelConfig };