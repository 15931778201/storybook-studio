import { describe, it, expect } from "bun:test";
import { retryWithBackoff } from "../src/utils/retry";

describe("retryWithBackoff", () => {
  it("should succeed on first try", async () => {
    const result = await retryWithBackoff(() => Promise.resolve("ok"));
    expect(result).toBe("ok");
  });

  it("should retry and eventually fail if always throwing", async () => {
    let calls = 0;
    const fn = () => { calls++; throw new Error("timeout"); };
    await expect(retryWithBackoff(fn, { maxRetries: 2, initialDelayMs: 10 })).rejects.toThrow();
    expect(calls).toBe(3); // initial + 2 retries
  });

  it("should succeed after retries if error becomes resolved", async () => {
    let count = 0;
    const fn = () => {
      count++;
      if (count < 3) throw new Error("500 Internal Server Error");
      return Promise.resolve("recovered");
    };
    const result = await retryWithBackoff(fn, { maxRetries: 3, initialDelayMs: 10 });
    expect(result).toBe("recovered");
  });
});