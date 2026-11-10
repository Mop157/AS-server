import mongoose, { Schema, Document, UpdateWriteOpResult } from "mongoose";
import { CoinLog } from '../db';
import { isBanned } from "./bans";

interface LogEntry {
  timestamp: Date;
  message: string;
  additional: Record<string, any>;
}

interface IPlayerLog extends Document {
  login: string;
  saves: LogEntry[];
  logs: LogEntry[];
  save_game: LogEntry[];
  chat: LogEntry[];
  privat_chat: LogEntry[];
  chat_tex: LogEntry[];
  gift: LogEntry[];
  name: LogEntry[];
  command: LogEntry[];
  server: LogEntry[];
  warning: LogEntry[];
  ban: LogEntry[];
  
}

const LogEntrySchema = new Schema<LogEntry>({
  timestamp: { type: Date, default: Date.now },
  message: { type: String, required: true },
  additional: { type: Object, default: {} },
});

const PlayerLogSchema = new Schema<IPlayerLog>({
  login: { type: String, required: true, unique: true },
  saves: [LogEntrySchema],
  logs: [LogEntrySchema],
  save_game: [LogEntrySchema],
  chat: [LogEntrySchema],
  privat_chat: [LogEntrySchema],
  chat_tex: [LogEntrySchema],
  gift: [LogEntrySchema],
  name: [LogEntrySchema],
  command: [LogEntrySchema],
  server: [LogEntrySchema],
  warning: [LogEntrySchema],
  ban: [LogEntrySchema],
  
});

// Используем уже существующую модель, если она определена
export const PlayerLog = mongoose.models.PlayerLog || mongoose.model<IPlayerLog>("PlayerLog", PlayerLogSchema);

// export async function logGeneral(login: string, logKey: string | number | symbol, message: string, additionalInfo?: Record<string, any>): Promise<void> {
//   // return
//   try {
//     await PlayerLog.updateOne(
//       { login },
//       { $push: { [logKey]: { message, additional: additionalInfo || {} } } },
//       { upsert: true }
//     );
//   } catch (error) {
//     console.error("Error logging general message:", error);
//   }
// }

export async function logGeneral(
  login: string,
  logKey: string | number | symbol,
  message: string,
  additionalInfo?: Record<string, any>
): Promise<void> {
  try {
    const ua = additionalInfo?.userAgent;

    if (!login) {
      return;
    }

    if (ua && logKey == "save_game") {
      // 1) Сначала пытаемся ++count в coins.userAgents
      const incResult = await CoinLog.updateOne(
        { login, "userAgents.userAgent": ua },
        { $inc: { "userAgents.$.count": 1 } },
      );

      // 2) Если не нашли — пушим новый элемент
      if (incResult.matchedCount === 0) {
        await CoinLog.updateOne(
          { login },
          { $push: { userAgents: { userAgent: ua, count: 1 } } },
          { upsert: true }
        );
      }

      // Проверяем длину userAgents после обновления
      const updatedCoinLog = await CoinLog.findOne({ login });
      if (updatedCoinLog && updatedCoinLog.userAgents.length === 4) {
        const { banned, ban } = await isBanned({ login: login });
        if (banned) {
        return;
      }
      }

      // (Опционально) Можно залогировать факт в playerlogs, если нужно
      await PlayerLog.updateOne(
        { login },
        { $push: { [logKey]: { message, additional: additionalInfo } } },
        { upsert: true }
      );
    } else {
      // Поведение по‑умолчанию — пушим в playerlogs
      await PlayerLog.updateOne(
        { login },
        { $push: { [logKey]: { message, additional: additionalInfo || {} } } },
        { upsert: true }
      );
    }
  } catch (error) {
    console.error("Error logging general message:", error);
  }
}






export async function logSaveData(login: string, saveDataStr: string, additionalInfo?: Record<string, any>): Promise<void> {
  // return
  try {
    const parsedData = JSON.parse(saveDataStr);
    await PlayerLog.updateOne(
      { login },
      { $push: { saves: { message: "Save data", additional: parsedData } } },
      { upsert: true }
    );
  } catch (error) {
    console.error("Error logging save data:", error);
  }
}
