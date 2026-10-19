import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required. Copy .env.example to .env and set it.`);
  return value;
}

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const authPepper = required("AUTH_PEPPER");
if (authPepper.length < 32) throw new Error("AUTH_PEPPER must contain at least 32 characters.");

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port,
  databaseUrl: required("DATABASE_URL"),
  authPepper,
  documentStorageDir: resolve(fileURLToPath(new URL("../", import.meta.url)), process.env.DOCUMENT_STORAGE_DIR?.trim() || "storage/documents"),
  corsOrigins: new Set(
    (process.env.CORS_ORIGINS ?? "http://localhost:8765,http://127.0.0.1:8765")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ),
};
