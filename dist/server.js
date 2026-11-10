"use strict";
// // src/server.ts 
// import http from 'http';
// import WebSocket from 'ws';
// import express from 'express';
// // import { DB } from './db';
// import mongoose from "mongoose";
// import { MongoClient } from "mongodb";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wss = exports.server = exports.mutesCollection = exports.bansCollection = exports.Logs = void 0;
// import bodyParser from "body-parser";
// import morgan from "morgan";
// import helmet from "helmet";
// import cors from "cors";
// import { PORT, ROUTES } from "./config";
// import settingsRouter from "./routes/settings";
// import timeRouter from "./routes/time";
// import authRouter from "./routes/auth";
// import purchaseRouter from "./routes/purchase";
// import promoRouter from "./routes/promocode";
// import searchRouter from "./routes/search";
// import { main } from './websocket';
// import { initBansCollection, mutesCollection } from "./db";
// import moderationRouter, { setBansCollection, setMutesCollection } from "./routes/moderation";
// import { bansCollection } from './db';
// const app = express();
// // HTTP middleware
// app.use(bodyParser.json({ limit: '1mb' }));
// app.use(bodyParser.urlencoded({ limit: '1mb', extended: true }));
// app.use(helmet());           // базовые заголовки безопасности
// app.use(cors());             // при необходимости настроить origin
// app.use(morgan("combined")); // логирование запросов
// // Статика
// // app.use("/public/resources", express.static(path.join(__dirname, "../public/resources")));
// // Парсеры тела
// app.use(bodyParser.urlencoded({ extended: false }));
// app.use(bodyParser.json());
// // Роуты
// app.use(ROUTES.SETTINGS1, settingsRouter);  
// // settingsRouter настроен на "/", поэтому:
// app.use(ROUTES.SETTINGS2, settingsRouter);
// // app.use(ROUTES.TIME.replace(/^\/?/, "/time"), timeRouter);
// app.use(ROUTES.TIME, timeRouter);
// // app.use(ROUTES.AUTH_SAVE, authRouter);
// // app.use(ROUTES.AUTH_LOAD, authRouter);
// // app.use(ROUTES.AUTH_NAME, authRouter);
// app.use("/auth", authRouter);
// app.use(ROUTES.PURCHASE_VALIDATE, purchaseRouter);
// app.use(ROUTES.PROMOCODE, promoRouter);
// app.use("/", searchRouter); // searchRouter обрабатывает security/retrive и /search/…
// app.use(ROUTES.MODERATION, moderationRouter); // Подключаем модерацию по пути /moderation
// // Любой прочий 404
// app.use((req, res) => {
//   res.status(404).json({ result: 0, data: { error: "Not Found" } });
// });
// // Глобальный обработчик ошибок (Express)
// app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
//   console.error("Unhandled error:", err);
//   res.status(500).json({ result: 0, data: { error: "Internal Server Error" } });
// });
// // Запуск HTTP и WebSocket и бази данных
// // await initDb();
// // const server = http.createServer(app);
// MongoDB URI is configured through MONGO_URI in the environment.
//   mongoose.connect(MONGO_URI)
//       .then(() => {
//         console.log("Connected to MongoDB");
//         initBansCollection(); // Инициализация коллекции банов
//         setBansCollection(bansCollection); // Передача коллекции в роутер moderation
//         setMutesCollection(mutesCollection);
//       })
//       .catch(err => {
//         console.error("MongoDB connection error:", err);
//         process.exit(1);
//       });
// export const server = http.createServer(app);
// export const wss = new WebSocket.Server({ server });
// main().catch(err => { console.error('Fatal error:', err); process.exit(1); });
// server.listen(PORT, () => console.log(`Server on port ${PORT}`));
const http_1 = __importDefault(require("http"));
const ws_1 = __importDefault(require("ws"));
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const body_parser_1 = __importDefault(require("body-parser"));
const morgan_1 = __importDefault(require("morgan"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const config_1 = require("./config");
const settings_1 = __importDefault(require("./routes/settings"));
const time_1 = __importDefault(require("./routes/time"));
const auth_1 = __importDefault(require("./routes/auth"));
const purchase_1 = __importDefault(require("./routes/purchase"));
const promocode_1 = __importDefault(require("./routes/promocode"));
const search_1 = __importDefault(require("./routes/search"));
const report_1 = __importDefault(require("./routes/report"));
const websocket_1 = require("./websocket");
const db_1 = require("./db");
Object.defineProperty(exports, "mutesCollection", { enumerable: true, get: function () { return db_1.mutesCollection; } });
Object.defineProperty(exports, "bansCollection", { enumerable: true, get: function () { return db_1.bansCollection; } });
const moderation_1 = __importStar(require("./routes/moderation"));
const redis_1 = require("./redis");
console.log(`[Worker ${process.pid}] Starting server...`);
const app = (0, express_1.default)();
// Middleware
app.use(body_parser_1.default.json({ limit: '1mb' }));
app.use(body_parser_1.default.urlencoded({ limit: '1mb', extended: true }));
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use((0, morgan_1.default)("combined"));
// Routes
app.use(config_1.ROUTES.SETTINGS1, settings_1.default);
app.use(config_1.ROUTES.SETTINGS2, settings_1.default);
app.use(config_1.ROUTES.TIME, time_1.default);
app.use("/auth", auth_1.default);
app.use(config_1.ROUTES.PURCHASE_VALIDATE, purchase_1.default);
app.use(config_1.ROUTES.PROMOCODE, promocode_1.default);
app.use("/", search_1.default);
app.use(config_1.ROUTES.MODERATION, moderation_1.default);
app.use(config_1.ROUTES.REPORT, report_1.default);
// 404
app.use((req, res) => {
    res.status(404).json({ result: 0, data: { error: "Not Found" } });
});
// Error handler
app.use((err, _req, res, _next) => {
    console.error(`[Worker ${process.pid}] Unhandled error:`, err);
    res.status(500).json({ result: 0, data: { error: "Internal Server Error" } });
});
let Logs;
exports.Logs = Logs;
exports.server = http_1.default.createServer(app);
exports.wss = new ws_1.default.Server({
    server: exports.server,
    perMessageDeflate: {
        zlibDeflateOptions: { level: 6 },
        clientNoContextTakeover: false,
        serverNoContextTakeover: false,
        clientMaxWindowBits: 15,
        serverMaxWindowBits: 15
    }
});
async function start() {
    (0, config_1.validateConfiguration)();
    await mongoose_1.default.connect(config_1.MONGO_URI);
    const db = mongoose_1.default.connection.db;
    if (!db) {
        throw new Error("MongoDB connected without an active database");
    }
    exports.Logs = Logs = db.collection("playerlogs");
    console.log(`[Worker ${process.pid}] Connected to MongoDB`);
    (0, db_1.initBansCollection)();
    (0, moderation_1.setBansCollection)(db_1.bansCollection);
    (0, moderation_1.setMutesCollection)(db_1.mutesCollection);
    await (0, redis_1.initRedis)();
    await (0, websocket_1.main)();
    exports.server.listen(config_1.PORT, () => {
        console.log(`[Worker ${process.pid}] Server running on port ${config_1.PORT}`);
    });
}
start().catch((err) => {
    console.error(`[Worker ${process.pid}] Startup failed:`, err);
    process.exit(1);
});
