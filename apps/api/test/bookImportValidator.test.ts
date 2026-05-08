import { describe, expect, it } from "vitest";
import { validateBookImportPayload } from "../src/validators/bookImportValidator";

describe("validateBookImportPayload", () => {
  it("accepts valid payload", () => {
    const payload = {
      bookMeta: {
        title: "小恐龙学分享",
        coverUrl: "https://example.com/cover.jpg",
        ageRange: ["3-4", "5-6"],
        tags: ["习惯养成"]
      },
      pages: [
        {
          id: "page-1",
          pageNo: 1,
          elements: [
            {
              id: "el-1",
              type: "text",
              x: 20,
              y: 60,
              width: 300,
              height: 80,
              payload: { text: "今天，小恐龙决定分享玩具。" }
            }
          ],
          hotspots: []
        }
      ]
    };

    const result = validateBookImportPayload(payload);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects invalid payload", () => {
    const payload = {
      bookMeta: {
        title: "",
        coverUrl: "",
        ageRange: [],
        tags: []
      },
      pages: []
    };

    const result = validateBookImportPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
