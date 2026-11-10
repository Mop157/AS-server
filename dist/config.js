"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROUTES = exports.validateConfiguration = exports.CLIENT_VISIBLE_NAME = exports.WS_PORT = exports.WS_HOST = exports.CLIENT_ENCRYPTION_KEY = exports.MASTER_ENCRYPTION_KEY = exports.REDIS_URL = exports.MONGO_URI = exports.PORT = void 0;
// src/config.ts
const dotenv_1 = __importDefault(require("dotenv"));
const crypto_1 = __importDefault(require("crypto"));
dotenv_1.default.config();
exports.PORT = Number.parseInt(process.env.PORT || "3000", 10);
exports.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/YOUR_DATABASE";
exports.REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const MASTER_ENCRYPTION_SECRET = process.env.MASTER_ENCRYPTION_KEY || "YOUR_MASTER_ENCRYPTION_KEY";
exports.MASTER_ENCRYPTION_KEY = crypto_1.default.createHash("sha256").update(MASTER_ENCRYPTION_SECRET, "utf8").digest();
exports.CLIENT_ENCRYPTION_KEY = process.env.CLIENT_ENCRYPTION_KEY || "YOUR_CLIENT_ENCRYPTION_KEY";
exports.WS_HOST = process.env.WS_HOST || "ws://YOUR_SERVER_HOST";
exports.WS_PORT = Number.parseInt(process.env.WS_PORT || "8000", 10);
exports.CLIENT_VISIBLE_NAME = process.env.CLIENT_VISIBLE_NAME || "YOUR_SERVER_NAME";
function validateConfiguration() {
    if (!Number.isInteger(exports.PORT) || exports.PORT < 1 || exports.PORT > 65535) {
        throw new Error("PORT must be an integer between 1 and 65535");
    }
    if (!Number.isInteger(exports.WS_PORT) || exports.WS_PORT < 1 || exports.WS_PORT > 65535) {
        throw new Error("WS_PORT must be an integer between 1 and 65535");
    }
    if (MASTER_ENCRYPTION_SECRET.startsWith("YOUR_") ||
        Buffer.byteLength(MASTER_ENCRYPTION_SECRET, "utf8") < 32) {
        throw new Error("Set MASTER_ENCRYPTION_KEY to a secret of at least 32 UTF-8 bytes");
    }
    if (exports.CLIENT_ENCRYPTION_KEY.startsWith("YOUR_")) {
        throw new Error("Set CLIENT_ENCRYPTION_KEY to the key expected by your client");
    }
    if (exports.WS_HOST.includes("YOUR_") || exports.CLIENT_VISIBLE_NAME.includes("YOUR_")) {
        throw new Error("Replace the WS_HOST and CLIENT_VISIBLE_NAME placeholders");
    }
    if (exports.MONGO_URI.includes("YOUR_")) {
        throw new Error("Replace the database-name placeholder in MONGO_URI");
    }
}
exports.validateConfiguration = validateConfiguration;
// Пути для API
exports.ROUTES = {
    SETTINGS1: "/settings/client",
    SETTINGS2: "/settings/2.0/client",
    TIME: "/time",
    AUTH_SAVE: "/save_2.0",
    AUTH_LOAD: "/load_2.0",
    AUTH_NAME: "/name_2.0",
    PROMOCODE: "/promocode",
    ACCESS: "/security/retrive/:userId/:pin",
    PURCHASE_VALIDATE: "/purchases/validate",
    SEARCH_ID: "/search/id/:userId/:pin",
    SEARCH_ACCOUNT: "/search/account/:accountUid/:pin",
    SEARCH_DEVICE: "/search/device/:deviceUid/:pin",
    SEARCH_NAME: "/search/name/:name/:pin",
    MODERATION: "/moderation",
    REPORT: "/report"
};
// Настройки CORS, rate-limit и т.д. при необходимости можно добавить здесь
