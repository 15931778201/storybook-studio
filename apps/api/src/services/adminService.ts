import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { RowDataPacket } from "mysql2/promise";
import { env } from "../config/env";
import { getPool } from "../config/database";
import { ApiError } from "../utils/apiError";
import type { AdminLoginResponse } from "@storybook-mvp/shared-types";

const SALT_ROUNDS = 10;

interface AdminUserRow extends RowDataPacket {
  id: number;
  username: string;
  password_hash: string;
  role: "admin";
}

export async function ensureDefaultAdmin(): Promise<void> {
  const db = getPool();

  const [rows] = await db.query<AdminUserRow[]>(
    "SELECT id FROM admin_users WHERE username = ? LIMIT 1",
    [env.adminUsername]
  );

  if (rows.length > 0) {
    return;
  }

  const passwordHash = await bcrypt.hash(env.adminPassword, SALT_ROUNDS);
  await db.query(
    "INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, 'admin')",
    [env.adminUsername, passwordHash]
  );
}

export async function adminLogin(username: string, password: string): Promise<AdminLoginResponse> {
  const db = getPool();
  const [rows] = await db.query<AdminUserRow[]>(
    "SELECT id, username, password_hash, role FROM admin_users WHERE username = ? LIMIT 1",
    [username.trim()]
  );

  const user = rows[0];
  if (!user) {
    throw new ApiError(401, "Invalid username or password.");
  }

  const matched = await bcrypt.compare(password, user.password_hash);
  if (!matched) {
    throw new ApiError(401, "Invalid username or password.");
  }

  const token = jwt.sign(
    {
      userId: String(user.id),
      role: "admin"
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresInSeconds
    }
  );

  return {
    token,
    expiresIn: env.jwtExpiresInSeconds
  };
}
