import OpenAI from 'openai';

const extractorModel = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
  timeout: 30000,
});

export async function extractMemories(messages: any[]): Promise<{ key: string; content: string }[]> {
  const prompt = `你是一个知识提取器。请分析以下对话历史，提取出用户的编程偏好、项目约定、个人常用指令等有价值的信息。
每条信息需要有一个简短的 key（如 coding_style、test_framework）和一段详细的说明 value。
如果未发现新信息，返回空数组 []。
严格输出 JSON 格式，不要添加任何额外文本。

对话历史：
${JSON.stringify(messages.slice(-10))}`;

  try {
    const res = await extractorModel.chat.completions.create({
      model: process.env.OPENAI_MODEL ||'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });
    const raw = res.choices[0].message.content || '[]';
    // 尝试解析，避免 JSON 前后有 markdown 标记
    const clean = raw.replace(/^```json\s*/, '').replace(/```$/, '');
    return JSON.parse(clean);
  } catch (e) {
    console.error('记忆提取失败:', e);
    return [];
  }
}