import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { ApiError } from "../utils/apiError";
import type { AuthUser } from "../types/auth";

export function requireAdminAuth(req: Request, _res: Response, next: NextFunction): void {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith("Bearer ")) {
    next(new ApiError(401, "Missing or invalid authorization header."));
    return;
  }

  const token = authorization.slice("Bearer ".length).trim();
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as AuthUser;
    if (decoded.role !== "admin") {
      next(new ApiError(403, "Admin permission required."));
      return;
    }

    req.authUser = decoded;
    next();
  } catch {
    next(new ApiError(401, "Token is invalid or expired."));
  }
}
