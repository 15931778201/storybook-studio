import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { ReadingEventInput } from "@storybook-mvp/shared-types";
import { getPool } from "../config/database";

interface AggregateRow extends RowDataPacket {
  event_type: string;
  count: number;
}

export async function insertReadingEvents(events: ReadingEventInput[]): Promise<number> {
  if (!events.length) {
    return 0;
  }

  const db = getPool();
  const now = new Date();

  const values = events.map((event) => [
    event.sessionId,
    event.bookId,
    event.pageNo ?? null,
    event.eventType,
    JSON.stringify(event.eventPayload ?? {}),
    new Date(event.clientTs),
    now
  ]);

  const [result] = await db.query<ResultSetHeader>(
    `INSERT INTO reading_events (
      session_id, book_id, page_no, event_type, event_payload, client_ts, server_ts
    ) VALUES ?`,
    [values]
  );

  return result.affectedRows;
}

export async function getReadingSummary(): Promise<{
  totalEvents: number;
  byType: Record<string, number>;
}> {
  const db = getPool();

  const [countRows] = await db.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS totalEvents FROM reading_events"
  );

  const [byTypeRows] = await db.query<AggregateRow[]>(
    "SELECT event_type, COUNT(*) AS count FROM reading_events GROUP BY event_type"
  );

  const byType = byTypeRows.reduce<Record<string, number>>((acc, item) => {
    acc[item.event_type] = Number(item.count);
    return acc;
  }, {});

  return {
    totalEvents: Number(countRows[0]?.totalEvents ?? 0),
    byType
  };
}
