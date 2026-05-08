
import OpenAI from 'openai';
const getClient = () => new OpenAI({ apiKey: process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY, baseURL: process.env.EMBEDDING_BASE_URL || process.env.OPENAI_BASE_URL, timeout: 30000 });
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (process.env.DISABLE_VECTOR_SEARCH === 'true') return texts.map(() => []);
  try { const res = await getClient().embeddings.create({ model: 'text-embedding-3-small', input: texts }); return res.data.map(d => d.embedding); }
  catch (e: any) { if (e.status === 404 || e.status === 403) { const fallback = await getClient().embeddings.create({ model: 'text-embedding-ada-002', input: texts }); return fallback.data.map(d => d.embedding); } throw e; }
}
export async function generateSingleEmbedding(text: string): Promise<number[]> { return (await generateEmbeddings([text]))[0] || []; }
