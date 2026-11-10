// // src/server.ts 
// import http from 'http';
// import WebSocket from 'ws';
// import express from 'express';
// // import { DB } from './db';
// import mongoose from "mongoose";
// import { MongoClient } from "mongodb";

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


import http from 'http';
import WebSocket from 'ws';
import express from 'express';
import mongoose from "mongoose";
import bodyParser from "body-parser";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";

import { MONGO_URI, PORT, ROUTES, validateConfiguration } from "./config";
import settingsRouter from "./routes/settings";
import timeRouter from "./routes/time";
import authRouter from "./routes/auth";
import purchaseRouter from "./routes/purchase";
import promoRouter from "./routes/promocode";
import searchRouter from "./routes/search";
import reportRouter from "./routes/report";
import { main } from './websocket';
import { initBansCollection, mutesCollection, bansCollection } from "./db";
import moderationRouter, { setBansCollection, setMutesCollection } from "./routes/moderation";
import { initRedis } from "./redis";

console.log(`[Worker ${process.pid}] Starting server...`);

const app = express();

// Middleware
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ limit: '1mb', extended: true }));
app.use(helmet());
app.use(cors());
app.use(morgan("combined"));

// Routes
app.use(ROUTES.SETTINGS1, settingsRouter);
app.use(ROUTES.SETTINGS2, settingsRouter);
app.use(ROUTES.TIME, timeRouter);
app.use("/auth", authRouter);
app.use(ROUTES.PURCHASE_VALIDATE, purchaseRouter);
app.use(ROUTES.PROMOCODE, promoRouter);
app.use("/", searchRouter);
app.use(ROUTES.MODERATION, moderationRouter);
app.use(ROUTES.REPORT, reportRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ result: 0, data: { error: "Not Found" } });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[Worker ${process.pid}] Unhandled error:`, err);
  res.status(500).json({ result: 0, data: { error: "Internal Server Error" } });
});

let Logs;
// HTTP + WS
export { Logs, bansCollection, mutesCollection };
export const server = http.createServer(app);
export const wss = new WebSocket.Server({
  server,
  perMessageDeflate: {
    zlibDeflateOptions: { level: 6 }, 
    clientNoContextTakeover: false,   
    serverNoContextTakeover: false,
    clientMaxWindowBits: 15,
    serverMaxWindowBits: 15
  }
});

async function start(): Promise<void> {
  validateConfiguration();
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB connected without an active database");
  }

  Logs = db.collection("playerlogs");
  console.log(`[Worker ${process.pid}] Connected to MongoDB`);
  initBansCollection();
  setBansCollection(bansCollection);
  setMutesCollection(mutesCollection);

  await initRedis();
  await main();

  server.listen(PORT, () => {
    console.log(`[Worker ${process.pid}] Server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error(`[Worker ${process.pid}] Startup failed:`, err);
  process.exit(1);
});