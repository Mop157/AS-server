"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.logSaveData = exports.logGeneral = exports.PlayerLog = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const db_1 = require("../db");
const bans_1 = require("./bans");
const LogEntrySchema = new mongoose_1.Schema({
    timestamp: { type: Date, default: Date.now },
    message: { type: String, required: true },
    additional: { type: Object, default: {} },
});
const PlayerLogSchema = new mongoose_1.Schema({
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
exports.PlayerLog = mongoose_1.default.models.PlayerLog || mongoose_1.default.model("PlayerLog", PlayerLogSchema);
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
async function logGeneral(login, logKey, message, additionalInfo) {
    try {
        const ua = additionalInfo?.userAgent;
        if (!login) {
            return;
        }
        if (ua && logKey == "save_game") {
            // 1) Сначала пытаемся ++count в coins.userAgents
            const incResult = await db_1.CoinLog.updateOne({ login, "userAgents.userAgent": ua }, { $inc: { "userAgents.$.count": 1 } });
            // 2) Если не нашли — пушим новый элемент
            if (incResult.matchedCount === 0) {
                await db_1.CoinLog.updateOne({ login }, { $push: { userAgents: { userAgent: ua, count: 1 } } }, { upsert: true });
            }
            // Проверяем длину userAgents после обновления
            const updatedCoinLog = await db_1.CoinLog.findOne({ login });
            if (updatedCoinLog && updatedCoinLog.userAgents.length === 4) {
                const { banned, ban } = await (0, bans_1.isBanned)({ login: login });
                if (banned) {
                    return;
                }
            }
            // (Опционально) Можно залогировать факт в playerlogs, если нужно
            await exports.PlayerLog.updateOne({ login }, { $push: { [logKey]: { message, additional: additionalInfo } } }, { upsert: true });
        }
        else {
            // Поведение по‑умолчанию — пушим в playerlogs
            await exports.PlayerLog.updateOne({ login }, { $push: { [logKey]: { message, additional: additionalInfo || {} } } }, { upsert: true });
        }
    }
    catch (error) {
        console.error("Error logging general message:", error);
    }
}
exports.logGeneral = logGeneral;
async function logSaveData(login, saveDataStr, additionalInfo) {
    // return
    try {
        const parsedData = JSON.parse(saveDataStr);
        await exports.PlayerLog.updateOne({ login }, { $push: { saves: { message: "Save data", additional: parsedData } } }, { upsert: true });
    }
    catch (error) {
        console.error("Error logging save data:", error);
    }
}
exports.logSaveData = logSaveData;
