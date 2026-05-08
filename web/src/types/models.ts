export interface ModelConfig {
  model: string;
  apiKey: string;
  baseURL: string;
  temperature: number;
  maxTokens: number;
}

// 默认配置（从环境变量读取初始值，后续用户可覆盖）
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  model: "gpt-4o",
  apiKey: "",
  baseURL: "",
  temperature: 0.7,
  maxTokens: 8000,
};

// 从 localStorage 读取配置，若无则用默认值
export function loadModelConfig(): ModelConfig {
  try {
    const stored = localStorage.getItem("modelConfig");
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_MODEL_CONFIG,
        ...parsed,
      };
    }
  } catch {}
  return { ...DEFAULT_MODEL_CONFIG };
}

// 保存到 localStorage
export function saveModelConfig(config: ModelConfig) {
  localStorage.setItem("modelConfig", JSON.stringify(config));
}