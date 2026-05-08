import request from "supertest";
import jwt from "jsonwebtoken";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { env } from "../src/config/env";
import * as bookService from "../src/services/bookService";
import * as readingService from "../src/services/readingService";

// Note: this suite requires opening ephemeral ports, which is blocked in this sandbox.
vi.mock("../src/services/bookService", () => ({
  createDraftBook: vi.fn(),
  listAdminBooks: vi.fn(),
  setBookPublishedState: vi.fn(),
  listPublishedBooks: vi.fn(),
  getPublishedBookById: vi.fn()
}));

vi.mock("../src/services/readingService", () => ({
  insertReadingEvents: vi.fn(),
  getReadingSummary: vi.fn()
}));

function createAdminToken() {
  return jwt.sign(
    {
      userId: "admin-1",
      role: "admin"
    },
    env.jwtSecret,
    {
      expiresIn: 3600
    }
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe.skip("admin and reading routes", () => {
  it("POST /api/admin/books/import rejects invalid payload", async () => {
    const app = createApp();
    const token = createAdminToken();

    const response = await request(app)
      .post("/api/admin/books/import")
      .set("Authorization", `Bearer ${token}`)
      .send({
        bookMeta: { title: "" },
        pages: []
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Invalid import payload");
  });

  it("POST /api/admin/books/import accepts valid payload and creates draft", async () => {
    const app = createApp();
    const token = createAdminToken();

    vi.mocked(bookService.createDraftBook).mockResolvedValue({
      id: "book-2",
      title: "小狐狸",
      subtitle: "",
      coverUrl: "https://example.com/cover.jpg",
      ageRange: ["3-4"],
      tags: ["成长"],
      status: "draft",
      sourceType: "json_import",
      pageCount: 1,
      pages: [
        {
          id: "p1",
          pageNo: 1,
          elements: [],
          hotspots: []
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: undefined
    } as any);

    const response = await request(app)
      .post("/api/admin/books/import")
      .set("Authorization", `Bearer ${token}`)
      .send({
        bookMeta: {
          title: "小狐狸",
          coverUrl: "https://example.com/cover.jpg",
          ageRange: ["3-4"],
          tags: ["成长"]
        },
        pages: [
          {
            id: "p1",
            pageNo: 1,
            elements: [],
            hotspots: []
          }
        ]
      });

    expect(response.status).toBe(201);
    expect(response.body.item.status).toBe("draft");
  });

  it("POST /api/reading/events/batch inserts events", async () => {
    vi.mocked(readingService.insertReadingEvents).mockResolvedValue(1);

    const app = createApp();
    const response = await request(app)
      .post("/api/reading/events/batch")
      .send({
        events: [
          {
            sessionId: "session-1",
            bookId: "book-1",
            eventType: "open_book",
            clientTs: new Date().toISOString()
          }
        ]
      });

    expect(response.status).toBe(201);
    expect(response.body.inserted).toBe(1);
    expect(readingService.insertReadingEvents).toHaveBeenCalledTimes(1);
  });
});
