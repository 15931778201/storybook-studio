import mysql, { Pool } from "mysql2/promise";
import { env } from "./env";

let pool: Pool | null = null;

export async function connectDatabase(): Promise<void> {
  const bootstrapConnection = await mysql.createConnection({
    host: env.mysqlHost,
    port: env.mysqlPort,
    user: env.mysqlUser,
    password: env.mysqlPassword,
    multipleStatements: true
  });

  await bootstrapConnection.query(
    `CREATE DATABASE IF NOT EXISTS \`${env.mysqlDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await bootstrapConnection.end();

  pool = mysql.createPool({
    host: env.mysqlHost,
    port: env.mysqlPort,
    user: env.mysqlUser,
    password: env.mysqlPassword,
    database: env.mysqlDatabase,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    namedPlaceholders: true
  });
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error("Database pool not initialized. Call connectDatabase() first.");
  }
  return pool;
}

export async function initializeSchema(): Promise<void> {
  const db = getPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(64) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS books (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      title VARCHAR(200) NOT NULL,
      subtitle VARCHAR(300) NULL,
      cover_url TEXT NOT NULL,
      age_range JSON NOT NULL,
      tags JSON NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      source_type VARCHAR(30) NOT NULL DEFAULT 'json_import',
      page_count INT NOT NULL,
      pages JSON NOT NULL,
      published_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_books_status (status),
      INDEX idx_books_updated_at (updated_at),
      INDEX idx_books_published_at (published_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS reading_events (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      session_id VARCHAR(128) NOT NULL,
      book_id VARCHAR(64) NOT NULL,
      page_no INT NULL,
      event_type VARCHAR(32) NOT NULL,
      event_payload JSON NULL,
      client_ts DATETIME NOT NULL,
      server_ts DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_reading_events_book_id (book_id),
      INDEX idx_reading_events_event_type (event_type),
      INDEX idx_reading_events_server_ts (server_ts)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}
