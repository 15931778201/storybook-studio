export interface AgentConfig {
  model: string;
  apiKey?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
  tools: any[];
  memory: any;
  contextMgr: any;
  policy: any;
  maxIterations: number;
  skillManager?: any;
  knowledgeBase?: any;
  mcpClient?: any;
  supportsVision?: boolean;
}

export interface ModelConfig {
  id: string;
  model: string;
  apiKey: string;
  baseURL: string;
  temperature: number;
  maxTokens: number;           // 最大输出 token 数
  topP: number;                // 0-1
  frequencyPenalty: number;    // -2.0-2.0
  presencePenalty: number;     // -2.0-2.0
  embeddingModel: string;
  embeddingApiKey: string;
  embeddingBaseURL: string;
}

