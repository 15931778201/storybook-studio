import OpenAI from 'openai';

type EmbeddingOptions = { model?: string; apiKey?: string; baseURL?: string };
let defaultEmbeddingConfig: EmbeddingOptions = {};

export function setDefaultEmbeddingConfig(config: EmbeddingOptions) {
  defaultEmbeddingConfig = config;
}

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

export async function generateSingleEmbedding(text: string, options?: EmbeddingOptions): Promise<number[]> {
  return (await generateEmbeddings([text], options))[0] || [];
}
