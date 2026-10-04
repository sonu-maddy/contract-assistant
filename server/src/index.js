import "dotenv/config";

import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import { logger } from "./logger.js";

import healthRouter from "./routes/health.js";
import itemsRouter from "./routes/items.js";
import contractsRouter from "./routes/contracts.js";
import cors from "cors";

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: ["https://contract-assistant-theta.vercel.app"],
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept"],
  }),
);

app.use(
  express.json({
    limit: "20mb",
  }),
);

app.use("/health", healthRouter);
app.use("/api/items", itemsRouter);
app.use("/api/contracts", contractsRouter);

export async function startServer() {
  await connectDB();

  return app.listen(port, () => {
    logger.info({ port }, "Contract Assistant server started");
  });
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch((error) => {
    logger.error({ err: error }, "Contract Assistant server failed to start");

    process.exitCode = 1;
  });
}

export { app };
