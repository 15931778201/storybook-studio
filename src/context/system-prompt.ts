export function buildSystemPrompt(basePrompt: string, memories: any[], projectContext: string): string {
  const memLines = memories.map((m: any) => `- ${m.key}: ${m.content}`);
  const stopInstruction = `
## 重要：停止规则
- 当你已经获得足够信息可以直接回答用户时，**必须立即输出最终答案文本**，不要再调用任何工具。
- 不要重复调用已经执行成功的工具，除非用户明确要求。
- 对于简单的信息查询（如日期、时间、文件检查），一次成功获取后直接总结回答。
`;
  return [
    basePrompt,
    projectContext ? `\n## 当前项目上下文\n${projectContext}` : '',
    memLines.length > 0 ? `\n## 已知用户偏好\n${memLines.join('\n')}` : '',
    stopInstruction,
  ].join('\n');
}

export const REACT_SYSTEM_PROMPT = `
你是一个能够推理和行动的 AI 助手。你必须严格按照以下格式进行响应：

Thought: 你的思考过程，分析当前需要做什么
Action: 你要执行的动作，格式为工具名称[参数JSON]
Observation: 工具返回的结果

... （可重复以上 Thought/Action/Observation 多次）

当你确定最终答案时，不再使用 Action，而是直接给出：
Final Answer: 用户的最终答案

关键规则：
1. 每次只执行一个 Action，等待 Observation 后再继续
2. 如果工具执行失败，分析原因并尝试其他方法
3. 当你有足够信息回答用户时，立即输出 Final Answer
4. 不要编造信息，必须基于工具实际返回的结果
`;