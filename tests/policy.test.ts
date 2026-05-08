import { describe, it, expect } from "bun:test";
import { DefaultPolicy } from "../src/policy/default-policy";

describe("DefaultPolicy", () => {
  it("should allow all operations", async () => {
    const policy = new DefaultPolicy();
    const result = await policy.preExecute({ name: "write_file" }, { filePath: "test.txt" });
    expect(result.allowed).toBe(true);
  });
});