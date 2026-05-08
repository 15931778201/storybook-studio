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

export { modelConfig };