import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import * as bookService from "../src/services/bookService";

// Note: this suite requires opening ephemeral ports, which is blocked in this sandbox.
vi.mock("../src/services/bookService", () => ({
  listPublishedBooks: vi.fn(),
  getPublishedBookById: vi.fn()
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe.skip("books routes", () => {
  it("GET /api/books returns published list", async () => {
    vi.mocked(bookService.listPublishedBooks).mockResolvedValue([
      {
        id: "book-1",
        title: "小恐龙学分享",
        subtitle: "副标题",
        coverUrl: "https://example.com/cover.jpg",
        ageRange: ["3-4"],
        tags: ["成长"],
        status: "published",
        sourceType: "json_import",
        pageCount: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        publishedAt: new Date().toISOString()
      }
    ] as any);

    const app = createApp();
    const response = await request(app).get("/api/books").query({ q: "小恐龙" });

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(bookService.listPublishedBooks).toHaveBeenCalledWith({
      age: undefined,
      tag: undefined,
      q: "小恐龙"
    });
  });

  it("GET /api/books/:id returns 404 when missing", async () => {
    vi.mocked(bookService.getPublishedBookById).mockResolvedValue(null);

    const app = createApp();
    const response = await request(app).get("/api/books/not-found-id");

    expect(response.status).toBe(404);
    expect(response.body.message).toContain("Book not found");
  });
});
