export interface ValidationResult {
  valid: boolean;
  confidence: number;
  reason: string;
}

const VALIDATION_PROMPT = `评估工具执行结果是否满足用户需求。严格输出JSON：{"valid": true/false, "confidence": 0.0-1.0, "reason": "简述原因"}`;

export async function validateToolResult(
  openai: OpenAI,
  toolName: string,
  toolOutput: string,
  userGoal: string
): Promise<ValidationResult> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: VALIDATION_PROMPT },
      {
        role: 'user',
        content: `用户目标: ${userGoal}\n工具: ${toolName}\n执行结果: ${toolOutput.slice(0, 2000)}`,
      },
    ],
    temperature: 0,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content || '{"valid":true,"confidence":0.5}');
}