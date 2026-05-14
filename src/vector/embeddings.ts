
import OpenAI from 'openai';
const getClient = () => new OpenAI({ apiKey: process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY, baseURL: process.env.EMBEDDING_BASE_URL || process.env.OPENAI_BASE_URL, timeout: 30000 });
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (process.env.DISABLE_VECTOR_SEARCH === 'true') return texts.map(() => []);
  try { const res = await getClient().embeddings.create({ model: 'text-embedding-3-small', input: texts }); return res.data.map(d => d.embedding); }
  catch (e: any) { if (e.status === 404) { try { const fallback = await getClient().embeddings.create({ model: "text-embedding-ada-002", input: texts }); return fallback.data.map(d => d.embedding); } catch (fallbackErr: any) { console.warn("嵌入模型回退也失败，将返回空嵌入:", fallbackErr?.message || fallbackErr); return texts.map(() => []); } } if (e.status === 403) { console.warn("嵌入请求被阻止(403)，请检查 API Key 权限或账户状态，将返回空嵌入:", e?.message || e); return texts.map(() => []); } throw e; }
}
export async function generateSingleEmbedding(text: string): Promise<number[]> { return (await generateEmbeddings([text]))[0] || []; }
