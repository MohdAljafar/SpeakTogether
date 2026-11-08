import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { validateEnv } from "./config.js";
import routes from "./routes.js";
import { prisma } from "./db.js";

validateEnv();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(",") || "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "speaktogether-api" }));
app.use("/api", routes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => console.log(`SpeakTogether API listening on ${port}`));

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
