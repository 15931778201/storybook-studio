export interface ModelConfig { model: string; apiKey: string; baseURL: string; temperature: number; maxTokens: number; }
export const DEFAULT_MODEL_CONFIG: ModelConfig = { model: 'gpt-4o', apiKey: '', baseURL: '', temperature: 0.7, maxTokens: 8000 };
export function loadModelConfig(): ModelConfig { try { const stored = localStorage.getItem('modelConfig'); if (stored) return { ...DEFAULT_MODEL_CONFIG, ...JSON.parse(stored) }; } catch {} return { ...DEFAULT_MODEL_CONFIG }; }
export function saveModelConfig(config: ModelConfig) { localStorage.setItem('modelConfig', JSON.stringify(config)); }