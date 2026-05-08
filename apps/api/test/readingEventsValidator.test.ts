import { describe, expect, it } from "vitest";
import { validateReadingEventsPayload } from "../src/validators/readingEventsValidator";

describe("validateReadingEventsPayload", () => {
  it("accepts valid events payload", () => {
    const payload = {
      events: [
        {
          sessionId: "session-1",
          bookId: "book-1",
          eventType: "open_book",
          clientTs: new Date().toISOString()
        }
      ]
    };

    const result = validateReadingEventsPayload(payload);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects empty events", () => {
    const payload = {
      events: []
    };

    const result = validateReadingEventsPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
