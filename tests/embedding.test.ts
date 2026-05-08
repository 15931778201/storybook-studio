// tests/embedding.test.ts
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
  timeout: 30000,
});

async function testEmbedding(model: string) {
  console.log(`\n🔍 测试模型: ${model}`);
  try {
    const res = await openai.embeddings.create({
      model,
      input: ['测试文本'],
    });

    // 输出完整的响应结构（仅在需要时放开注释，避免泄露 Key）
    // console.log('完整响应:', JSON.stringify(res, null, 2));

    if (!res.data || !Array.isArray(res.data) || res.data.length === 0) {
      console.error('❌ 返回数据格式异常:', res);
      return false;
    }

    const embedding = res.data[0].embedding;
    console.log(`✅ 成功！模型: ${model}, 向量维度: ${embedding.length}, 前5个值: ${embedding.slice(0, 5).join(', ')}`);
    return true;
  } catch (e: any) {
    console.error(`❌ 请求失败 [${e.status}]: ${e.message}`);
    if (e.status === 403 || e.status === 404) {
      console.warn('   → 可能原因：代理不支持 Embedding 或模型名称错误');
    }
    // 打印可能的原始响应头或错误体（如果有）
    if (e.response?.body) console.warn('   → 响应体:', e.response.body);
    return false;
  }
}

(async () => {
  console.log('🧪 开始 Embedding 连通性测试...');

  // 测试主流模型
  const models = [process.env.OPENAI_EMBEDDING_MODEL || '', 'text-embedding-3-small', 'text-embedding-ada-002'];
  let success = false;

  for (const model of models) {
    if (await testEmbedding(model)) {
      success = true;
      break;
    }
  }

  if (!success) {
    console.log('\n⚠️ 所有模型均失败。请检查：');
    console.log('1. 代理是否支持 /v1/embeddings 端点');
    console.log('2. API Key 是否有 Embedding 权限');
    console.log('3. 代理返回的内容是否为 OpenAI 兼容格式');
    console.log('4. 模型名称是否被服务商替换（如 huggingface 等自定义名称）');
  }
})();