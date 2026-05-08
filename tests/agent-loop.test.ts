import { describe, it, expect, mock } from "bun:test";
import { AgentLoop } from "../src/core/agent-loop";

// 模拟 OpenAI 客户端
mock.module("openai", () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: { content: "Hello", tool_calls: undefined }
          }],
          usage: { total_tokens: 10 }
        }),
      },
    },
  })),
}));

describe("AgentLoop", () => {
  it("should return a text response", async () => {
    const config = {
      model: "gpt-4o",
      apiKey: "fake",
      tools: [],
      memory: { getAll: async () => [] },
      contextMgr: { compress: async (m: any) => m, injectSystemPrompt: (m: any) => m },
      policy: { preExecute: async () => ({ allowed: true }), postExecute: async () => {} },
      maxIterations: 1,
    };
    const agent = new AgentLoop(config, "test");
    const answer = await agent.run("Hi");
    expect(answer).toBeDefined();
  });
});