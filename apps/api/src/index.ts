import { createApp } from "./app";
import { env } from "./config/env";
import { connectDatabase, initializeSchema } from "./config/database";
import { ensureDefaultAdmin } from "./services/adminService";

async function bootstrap() {
  await connectDatabase();
  await initializeSchema();
  await ensureDefaultAdmin();

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`API server listening on http://localhost:${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
