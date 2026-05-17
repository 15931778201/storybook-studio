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
export function loadModelConfig(): ModelConfig { try { const stored = localStorage.getItem('modelConfig'); if (stored) return { ...DEFAULT_MODEL_CONFIG, ...JSON.parse(stored) }; } catch {} return { ...DEFAULT_MODEL_CONFIG }; }
export function saveModelConfig(config: ModelConfig) {
  localStorage.setItem('modelConfig', JSON.stringify(config));
  // 同步到后端数据库
  fetch('/api/model-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  }).catch(err => console.warn('同步模型配置到后端失败:', err));
}
