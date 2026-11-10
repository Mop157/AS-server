// src/config.ts
import dotenv from "dotenv";
import crypto from "crypto";
dotenv.config();

export const PORT = Number.parseInt(process.env.PORT || "3000", 10);
export const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/YOUR_DATABASE";
export const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const MASTER_ENCRYPTION_SECRET = process.env.MASTER_ENCRYPTION_KEY || "YOUR_MASTER_ENCRYPTION_KEY";
export const MASTER_ENCRYPTION_KEY = crypto.createHash("sha256").update(MASTER_ENCRYPTION_SECRET, "utf8").digest();
export const CLIENT_ENCRYPTION_KEY = process.env.CLIENT_ENCRYPTION_KEY || "YOUR_CLIENT_ENCRYPTION_KEY";
export const WS_HOST = process.env.WS_HOST || "ws://YOUR_SERVER_HOST";
export const WS_PORT = Number.parseInt(process.env.WS_PORT || "8000", 10);
export const CLIENT_VISIBLE_NAME = process.env.CLIENT_VISIBLE_NAME || "YOUR_SERVER_NAME";

export function validateConfiguration(): void {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  if (!Number.isInteger(WS_PORT) || WS_PORT < 1 || WS_PORT > 65535) {
    throw new Error("WS_PORT must be an integer between 1 and 65535");
  }
  if (
    MASTER_ENCRYPTION_SECRET.startsWith("YOUR_") ||
    Buffer.byteLength(MASTER_ENCRYPTION_SECRET, "utf8") < 32
  ) {
    throw new Error("Set MASTER_ENCRYPTION_KEY to a secret of at least 32 UTF-8 bytes");
  }
  if (CLIENT_ENCRYPTION_KEY.startsWith("YOUR_")) {
    throw new Error("Set CLIENT_ENCRYPTION_KEY to the key expected by your client");
  }
  if (WS_HOST.includes("YOUR_") || CLIENT_VISIBLE_NAME.includes("YOUR_")) {
    throw new Error("Replace the WS_HOST and CLIENT_VISIBLE_NAME placeholders");
  }
  if (MONGO_URI.includes("YOUR_")) {
    throw new Error("Replace the database-name placeholder in MONGO_URI");
  }
}

// Пути для API
export const ROUTES = {
  SETTINGS1: "/settings/client",
  SETTINGS2: "/settings/2.0/client",
  TIME:      "/time",
  AUTH_SAVE: "/save_2.0",
  AUTH_LOAD: "/load_2.0",
  AUTH_NAME: "/name_2.0",
  PROMOCODE: "/promocode",
  ACCESS:    "/security/retrive/:userId/:pin",
  PURCHASE_VALIDATE: "/purchases/validate",
  SEARCH_ID: "/search/id/:userId/:pin",
  SEARCH_ACCOUNT: "/search/account/:accountUid/:pin",
  SEARCH_DEVICE: "/search/device/:deviceUid/:pin",
  SEARCH_NAME: "/search/name/:name/:pin",
  MODERATION: "/moderation",
  REPORT: "/report"
};

// Настройки CORS, rate-limit и т.д. при необходимости можно добавить здесь
