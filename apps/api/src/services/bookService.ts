import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { Book, BookImportPayload, BookPage } from "@storybook-mvp/shared-types";
import { getPool } from "../config/database";

interface BookRow extends RowDataPacket {
  id: number;
  title: string;
  subtitle: string | null;
  cover_url: string;
  age_range: unknown;
  tags: unknown;
  status: "draft" | "published";
  source_type: "json_import";
  page_count: number;
  pages: unknown;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
}

function decodePotentialBuffer(value: unknown): unknown {
  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "data" in value &&
    (value as { type?: unknown }).type === "Buffer" &&
    Array.isArray((value as { data?: unknown }).data)
  ) {
    return Buffer.from((value as { data: number[] }).data).toString("utf8");
  }

  return value;
}

function parseJsonField<T>(value: unknown, fallback: T): T {
  const decoded = decodePotentialBuffer(value);

  if (decoded === null || decoded === undefined) {
    return fallback;
  }

  if (typeof decoded === "string") {
    try {
      return JSON.parse(decoded) as T;
    } catch {
      return fallback;
    }
  }

  return decoded as T;
}

function toIsoString(value: Date | string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
}

function mapRowToBook(row: BookRow, includePages: boolean): Book {
  const parsedPages = parseJsonField<unknown>(row.pages, []);
  const pages = Array.isArray(parsedPages) ? (parsedPages as BookPage[]) : [];
  const parsedAgeRange = parseJsonField<unknown>(row.age_range, []);
  const parsedTags = parseJsonField<unknown>(row.tags, []);

  return {
    id: String(row.id),
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    coverUrl: row.cover_url,
    ageRange: Array.isArray(parsedAgeRange) ? parsedAgeRange.map((item) => String(item)) : [],
    tags: Array.isArray(parsedTags) ? parsedTags.map((item) => String(item)) : [],
    status: row.status,
    sourceType: row.source_type,
    pageCount: row.page_count,
    pages: includePages ? pages : undefined,
    createdAt: toIsoString(row.created_at) as string,
    updatedAt: toIsoString(row.updated_at) as string,
    publishedAt: toIsoString(row.published_at)
  };
}

export async function createDraftBook(payload: BookImportPayload): Promise<Book> {
  const db = getPool();

  const orderedPages = [...payload.pages].sort((a, b) => a.pageNo - b.pageNo);

  const [result] = await db.query<ResultSetHeader>(
    `INSERT INTO books (
      title, subtitle, cover_url, age_range, tags, status, source_type, page_count, pages
    ) VALUES (?, ?, ?, ?, ?, 'draft', 'json_import', ?, ?)`,
    [
      payload.bookMeta.title,
      payload.bookMeta.subtitle ?? null,
      payload.bookMeta.coverUrl,
      JSON.stringify(payload.bookMeta.ageRange),
      JSON.stringify(payload.bookMeta.tags),
      orderedPages.length,
      JSON.stringify(orderedPages)
    ]
  );

  const created = await getBookById(result.insertId);
  if (!created) {
    throw new Error("Failed to load created book.");
  }

  return created;
}

async function getBookById(bookId: number): Promise<Book | null> {
  const db = getPool();
  const [rows] = await db.query<BookRow[]>("SELECT * FROM books WHERE id = ? LIMIT 1", [bookId]);
  const row = rows[0];
  if (!row) {
    return null;
  }

  return mapRowToBook(row, true);
}

export async function getAdminBookById(bookId: string): Promise<Book | null> {
  const db = getPool();
  const [rows] = await db.query<BookRow[]>("SELECT * FROM books WHERE id = ? LIMIT 1", [bookId]);
  const row = rows[0];
  return row ? mapRowToBook(row, true) : null;
}

export async function updateBookFromImportPayload(
  bookId: string,
  payload: BookImportPayload
): Promise<Book | null> {
  const db = getPool();

  const orderedPages = [...payload.pages].sort((a, b) => a.pageNo - b.pageNo);

  const [result] = await db.query<ResultSetHeader>(
    `UPDATE books
      SET title = ?,
          subtitle = ?,
          cover_url = ?,
          age_range = ?,
          tags = ?,
          page_count = ?,
          pages = ?
      WHERE id = ?`,
    [
      payload.bookMeta.title,
      payload.bookMeta.subtitle ?? null,
      payload.bookMeta.coverUrl,
      JSON.stringify(payload.bookMeta.ageRange),
      JSON.stringify(payload.bookMeta.tags),
      orderedPages.length,
      JSON.stringify(orderedPages),
      bookId
    ]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  const [rows] = await db.query<BookRow[]>("SELECT * FROM books WHERE id = ? LIMIT 1", [bookId]);
  const row = rows[0];
  return row ? mapRowToBook(row, true) : null;
}

export async function deleteBookById(bookId: string): Promise<boolean> {
  const db = getPool();
  const [result] = await db.query<ResultSetHeader>("DELETE FROM books WHERE id = ?", [bookId]);
  return result.affectedRows > 0;
}

export async function listAdminBooks(): Promise<Book[]> {
  const db = getPool();
  const [rows] = await db.query<BookRow[]>("SELECT * FROM books ORDER BY updated_at DESC");

  return rows.map((row) => mapRowToBook(row, false));
}

export async function setBookPublishedState(bookId: string, publish: boolean): Promise<Book | null> {
  const db = getPool();

  const [result] = await db.query<ResultSetHeader>(
    `UPDATE books SET status = ?, published_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [publish ? "published" : "draft", publish ? new Date() : null, bookId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  const [rows] = await db.query<BookRow[]>("SELECT * FROM books WHERE id = ? LIMIT 1", [bookId]);
  const row = rows[0];
  return row ? mapRowToBook(row, false) : null;
}

export async function listPublishedBooks(filters: {
  age?: string;
  tag?: string;
  q?: string;
}): Promise<Book[]> {
  const db = getPool();

  let sql = "SELECT * FROM books WHERE status = 'published'";
  const args: unknown[] = [];

  if (filters.q?.trim()) {
    sql += " AND title LIKE ?";
    args.push(`%${filters.q.trim()}%`);
  }

  sql += " ORDER BY published_at DESC, updated_at DESC";

  const [rows] = await db.query<BookRow[]>(sql, args);

  return rows
    .map((row) => mapRowToBook(row, false))
    .filter((item) => {
      if (filters.age?.trim() && !item.ageRange.includes(filters.age.trim())) {
        return false;
      }
      if (filters.tag?.trim() && !item.tags.includes(filters.tag.trim())) {
        return false;
      }
      return true;
    });
}

export async function getPublishedBookById(bookId: string): Promise<Book | null> {
  const db = getPool();
  const [rows] = await db.query<BookRow[]>(
    "SELECT * FROM books WHERE id = ? AND status = 'published' LIMIT 1",
    [bookId]
  );

  const row = rows[0];
  return row ? mapRowToBook(row, true) : null;
}
