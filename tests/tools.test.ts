import { describe, it, expect } from "bun:test";
import { Tool, ToolError } from "../src/core/tool";
import { z } from "zod";

class MockTool extends Tool {
  name = "mock";
  description = "mock";
  parameters = z.object({ value: z.string() });
  async execute(params: { value: string }) {
    return { success: true, output: params.value };
  }
}

describe("Tool", () => {
  it("should execute correctly", async () => {
    const tool = new MockTool();
    const result = await tool.execute({ value: "test" });
    expect(result.success).toBe(true);
    expect(result.output).toBe("test");
  });
});