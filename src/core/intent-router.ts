import OpenAI from 'openai';

export type TaskCategory = 'chitchat' | 'simple_query' | 'complex_task' | 'dangerous_op';

export interface IntentResult {
  category: TaskCategory;
  confidence: number;
  reasoning: string;
  suggestedStrategy: 'fast' | 'standard' | 'deep';
}

const ROUTER_PROMPT = `分析用户意图，严格输出JSON格式：
{
  "category": "chitchat|simple_query|complex_task|dangerous_op",
  "confidence": 0.0-1.0,
  "reasoning": "简述判断依据"
}
分类标准：
- chitchat: 寒暄、闲聊
- simple_query: 简单事实查询，1步可完成
- complex_task: 需要多步操作、文件修改、代码生成
- dangerous_op: 删除文件、执行危险命令`;

export async function routeIntent(
  openai: OpenAI,
  userInput: string,
  model: string = 'gpt-4o-mini'
): Promise<IntentResult> {
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: ROUTER_PROMPT },
      { role: 'user', content: userInput },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });

  const parsed = JSON.parse(response.choices[0].message.content || '{}');

  // 根据类别推荐策略
  const strategyMap: Record<string, 'fast' | 'standard' | 'deep'> = {
    chitchat: 'fast',
    simple_query: 'fast',
    complex_task: 'standard',
    dangerous_op: 'deep',
  };

  return {
    category: parsed.category || 'simple_query',
    confidence: parsed.confidence || 0.5,
    reasoning: parsed.reasoning || '',
    suggestedStrategy: strategyMap[parsed.category] || 'standard',
  };
}