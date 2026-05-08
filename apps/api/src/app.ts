import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { env } from "./config/env";
import { healthRouter } from "./routes/health";
import { aiRouter } from "./routes/ai";
import { adminRouter } from "./routes/admin";
import { booksRouter } from "./routes/books";
import { readingRouter } from "./routes/reading";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true
    })
  );
  app.use(helmet());
  app.use(morgan("dev"));
  app.use(express.json({ limit: "2mb" }));

  const staticDir = path.resolve(process.cwd(), "public");
  app.use("/public", express.static(staticDir));

  app.use("/api", healthRouter);
  app.use("/api/ai", aiRouter);
  app.use("/api", adminRouter);
  app.use("/api", booksRouter);
  app.use("/api", readingRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
