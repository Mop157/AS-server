"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const db_1 = require("./db");
const server_1 = require("./server");
const bans_1 = require("./utils/bans");
const logger_1 = require("./utils/logger");
const redis_1 = require("./redis");
const OPEN = 1;
const Power = {
    0: "naked",
    1: "ordinary_clothes",
    2: "handmade_clothes",
    3: "military_clothes",
    4: "military_armor",
    5: "motorway_armor",
    6: "combined_armor",
    7: "leather_armor",
    8: "iron_armor",
    9: "chitin_armor",
    10: "steel_armor",
    11: "tank_armor",
    12: "ozk",
    13: "leshyi",
    14: "hunter_armor",
    15: "miner_armor",
    16: "tattered_clothes",
    17: "armor_mes",
    18: "armor_militia",
    19: "invisibility_cloak",
    20: "polar_armor",
};
const POINTS = [
    [1, 1],
    [5, 10],
    [20, 100],
    [100, 3000],
];
function getLines() {
    const lines = [];
    for (let i = 0; i < POINTS.length - 1; i++) {
        const [x1, y1] = POINTS[i];
        const [x2, y2] = POINTS[i + 1];
        const b = Math.log(x1 / x2) / Math.log(y1 / y2);
        const a = x1 / Math.pow(y1, b);
        lines.push([y2, a, b]);
    }
    if (lines.length > 0)
        lines[lines.length - 1][0] = Infinity;
    return lines;
}
const lines = getLines();
function count2cooldown(count, onserverTimeHours) {
    const limit = count + 1;
    for (const [y, a, b] of lines) {
        if (limit < y) {
            return Math.max(0, a * Math.pow(limit, b) - onserverTimeHours);
        }
    }
    return 0;
}
let operationIndex = 0;
const MAX_INDEX = 3112766;
function nextIndex() {
    operationIndex = (operationIndex + 1) % (MAX_INDEX + 1);
    return operationIndex;
}
async function startbb() {
    const event = await db_1.ServerEvent.findOne();
    if (!event) {
        const newEvent = new db_1.ServerEvent();
        await newEvent.save();
    }
}
void startbb();
async function logAction(login, category, message, meta = {}) {
    try {
        await (0, logger_1.logGeneral)(login, category, message);
        void meta;
    }
    catch (err) {
        try {
            await (0, logger_1.logGeneral)(login, "warning", `Операция не была зарегистрирована: ${String(err?.message || err)}`);
        }
        catch {
            // intentionally silent
        }
    }
}
function safeSend(client, event) {
    if (!client)
        return false;
    try {
        if (client.readyState === OPEN) {
            client.send(JSON.stringify(event));
            return true;
        }
    }
    catch {
        // intentionally silent
    }
    return false;
}
function findClientById(targetId) {
    if (targetId === null || typeof targetId === "undefined")
        return null;
    for (const client of server_1.wss.clients) {
        try {
            if (client && client.readyState === OPEN && Number(client.id) === Number(targetId)) {
                return client;
            }
        }
        catch {
            // intentionally silent
        }
    }
    return null;
}
function sanitizeKey(key) {
    if (key === null || key === undefined)
        return null;
    let normalized = String(key).trim();
    if (normalized.length === 0)
        return null;
    if (normalized.startsWith(".") || normalized.endsWith(".") || normalized.startsWith("$"))
        return null;
    if (normalized.includes(".."))
        return null;
    normalized = normalized.replace(/[\x00-\x1F\x7F]/g, "");
    return normalized;
}
function cleanText(str = "") {
    return String(str).replace(/[\n\r\t]+/g, " ").replace(/\s+/g, " ").trim();
}
function rawToString(raw) {
    if (typeof raw === "string")
        return raw;
    if (Buffer.isBuffer(raw))
        return raw.toString();
    if (Array.isArray(raw))
        return Buffer.concat(raw).toString();
    return Buffer.from(raw).toString();
}
function sendEventToUser(userId, event) {
    const targetClient = findClientById(userId);
    if (targetClient && safeSend(targetClient, event))
        return true;
    try {
        redis_1.redisPub.publish("ws-events", JSON.stringify({
            userId,
            event,
        }));
    }
    catch {
        // intentionally silent
    }
    return false;
}
async function getOrCreatePublicChat(channel) {
    let chat = (await db_1.ChatMessage.findOne({ channel }));
    if (!chat) {
        chat = new db_1.ChatMessage({ channel, messages: [] });
        await chat.save();
    }
    return chat;
}
async function getOrCreatePrivateChat(sender, target) {
    let chat = (await db_1.ChatMessage.findOne({ channel: "3" }));
    if (!chat) {
        chat = new db_1.ChatMessage({ channel: "3", messages: {}, messageId: 0 });
        await chat.save();
    }
    if (!chat.messages)
        chat.messages = {};
    if (!chat.messages[target])
        chat.messages[target] = [];
    if (!chat.messages[sender])
        chat.messages[sender] = chat.messages[sender] || [];
    return chat;
}
const SPAM_CONFIG = {
    maxPerSecond: 100,
    maxPer5s: 405,
    strikeThreshold: 3,
    initialPenaltyMs: 15000,
    penaltyMultiplier: 2,
    maxPenaltyMs: 10 * 60 * 1000,
};
function initSpamMeta(ws) {
    if (!ws._spam) {
        ws._spam = {
            rawTimestamps: [],
            parsedTimestamps: [],
            strikes: 0,
            penaltyUntil: 0,
            lastWarningAt: 0,
        };
    }
}
function trimTimestamps(arr, windowMs) {
    const cutoff = Date.now() - windowMs;
    while (arr.length && arr[0] < cutoff)
        arr.shift();
}
function getMinutesUntilLimitIncrease(liveOnlineHours) {
    const currentMax = getMaxAllowedByHours(liveOnlineHours);
    const waitHours = count2cooldown(currentMax, liveOnlineHours);
    return Math.max(0, Math.ceil(waitHours * 60));
}
function getMaxAllowedByHours(hoursFromOnline, maxCap = 100000) {
    let sent = 0;
    while (sent < maxCap && count2cooldown(sent, hoursFromOnline) <= 0)
        sent++;
    return sent;
}
function checkSpamBeforeParse(ws) {
    initSpamMeta(ws);
    const now = Date.now();
    if (ws._spam?.penaltyUntil && now < ws._spam.penaltyUntil) {
        if (!ws._spam._warnedDuringPenalty) {
            safeSend(ws, {
                type: 1,
                name: 900,
                index: nextIndex(),
                payload: { reason: "rate_limited", retryAfter: Math.ceil((ws._spam.penaltyUntil - now) / 1000) },
            });
            ws._spam._warnedDuringPenalty = true;
        }
        return true;
    }
    ws._spam?.rawTimestamps.push(now);
    if (ws._spam)
        trimTimestamps(ws._spam.rawTimestamps, 5000);
    const raw = ws._spam?.rawTimestamps ?? [];
    const last1sCount = raw.filter((ts) => ts > now - 1000).length;
    const last5sCount = raw.length;
    if (last1sCount > SPAM_CONFIG.maxPerSecond || last5sCount > SPAM_CONFIG.maxPer5s) {
        if (ws._spam)
            ws._spam.strikes = (ws._spam.strikes || 0) + 1;
        const multiplier = Math.pow(SPAM_CONFIG.penaltyMultiplier, Math.max(0, (ws._spam?.strikes || 1) - 1));
        let penaltyMs = SPAM_CONFIG.initialPenaltyMs * multiplier;
        if (penaltyMs > SPAM_CONFIG.maxPenaltyMs)
            penaltyMs = SPAM_CONFIG.maxPenaltyMs;
        if (ws._spam) {
            ws._spam.penaltyUntil = now + penaltyMs;
            ws._spam._warnedDuringPenalty = false;
        }
        void logAction(ws.userId ? `u${ws.userId}` : "unknown", "spam", `превышение лимита сообщений (1s:${last1sCount},5s:${last5sCount}), штраф ${penaltyMs}ms`, {
            strikes: ws._spam?.strikes,
        });
        safeSend(ws, {
            type: 1,
            name: 901,
            index: nextIndex(),
            payload: { result: 0, reason: "rate_limit", penaltyMs },
        });
        return true;
    }
    return false;
}
function checkSpamAfterParse(ws) {
    initSpamMeta(ws);
    const now = Date.now();
    if (ws._spam?.penaltyUntil && now < ws._spam.penaltyUntil) {
        if (!ws._spam._warnedDuringPenalty) {
            safeSend(ws, {
                type: 1,
                name: 900,
                index: nextIndex(),
                payload: { reason: "rate_limited", retryAfter: Math.ceil((ws._spam.penaltyUntil - now) / 1000) },
            });
            ws._spam._warnedDuringPenalty = true;
        }
        return true;
    }
    ws._spam?.parsedTimestamps.push(now);
    if (ws._spam)
        trimTimestamps(ws._spam.parsedTimestamps, 5000);
    const parsed = ws._spam?.parsedTimestamps ?? [];
    const last1sCount = parsed.filter((ts) => ts > now - 1000).length;
    const last5sCount = parsed.length;
    if (last1sCount > SPAM_CONFIG.maxPerSecond || last5sCount > SPAM_CONFIG.maxPer5s) {
        if (ws._spam)
            ws._spam.strikes = (ws._spam.strikes || 0) + 1;
        const multiplier = Math.pow(SPAM_CONFIG.penaltyMultiplier, Math.max(0, (ws._spam?.strikes || 1) - 1));
        let penaltyMs = SPAM_CONFIG.initialPenaltyMs * multiplier;
        if (penaltyMs > SPAM_CONFIG.maxPenaltyMs)
            penaltyMs = SPAM_CONFIG.maxPenaltyMs;
        if (ws._spam) {
            ws._spam.penaltyUntil = now + penaltyMs;
            ws._spam._warnedDuringPenalty = false;
        }
        void logAction(ws.userId ? `u${ws.userId}` : "unknown", "spam", `превышение лимита (после парсинга) (1s:${last1sCount},5s:${last5sCount}), штраф ${penaltyMs}ms`, {
            strikes: ws._spam?.strikes,
        });
        safeSend(ws, {
            type: 1,
            name: 901,
            index: nextIndex(),
            payload: { result: 0, reason: "rate_limit", penaltyMs },
        });
        return true;
    }
    return false;
}
function unwrap(value) {
    if (value && typeof value === "object" && "value" in value) {
        return value.value;
    }
    return value;
}
function normalize(gift) {
    while (Array.isArray(gift) && gift.length === 1 && Array.isArray(gift[0])) {
        gift = gift[0];
    }
    if (!Array.isArray(gift?.[0])) {
        return [gift];
    }
    return gift;
}
async function buildChatHistoryForAuth(userName) {
    const chatlist = [];
    const limitMessages = 50;
    for (const ch of ["1", "2", "3", "4"]) {
        if (ch === "3") {
            const chat = await db_1.ChatMessage.findOne({ channel: "3" }, { [`messages.${userName}`]: { $slice: -limitMessages } }).lean();
            chatlist.push(...(chat?.messages?.[userName] || []));
        }
        else {
            const chat = await db_1.ChatMessage.findOne({ channel: ch }, { messages: { $slice: -limitMessages } }).lean();
            chatlist.push(...(chat?.messages || []));
        }
    }
    return chatlist.map((m) => ({
        messageId: m.messageId,
        channel: m.channel,
        message: m.message,
        name: m.name,
        time: m.time,
    }));
}
async function main() {
    await redis_1.redisSub.subscribe("ws-events", (raw) => {
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            return;
        }
        const { userId, event } = parsed;
        const client = findClientById(userId);
        if (client && client.readyState === OPEN) {
            try {
                client.send(JSON.stringify(event));
            }
            catch {
                // intentionally silent
            }
        }
    });
    server_1.wss.on("connection", (ws) => {
        void logAction("system", "logs", "новое соединение веб-сокет");
        ws.isAlive = true;
        ws._pendingSends = ws._pendingSends || [];
        initSpamMeta(ws);
        ws.on("message", async (raw) => {
            try {
                if (checkSpamBeforeParse(ws))
                    return;
            }
            catch {
                // intentionally silent
            }
            let msg;
            try {
                msg = JSON.parse(rawToString(raw));
            }
            catch {
                return;
            }
            try {
                if (checkSpamAfterParse(ws))
                    return;
            }
            catch {
                // intentionally silent
            }
            if (!msg || typeof msg.name === "undefined")
                return;
            try {
                switch (msg.name) {
                    case 0: {
                        const p = msg.data || {};
                        const accountUid = unwrap(p.accountUid) ?? "";
                        const platformUid = unwrap(p.platformUid) ?? "";
                        if (!accountUid) {
                            safeSend(ws, {
                                type: 2,
                                name: 0,
                                index: nextIndex(),
                                payload: {
                                    accessLevel: 0,
                                    userName: null,
                                    errorCode: true,
                                    userId: null,
                                    success: false,
                                    reason: "Invalid accountUid",
                                },
                            });
                            try {
                                ws.close();
                            }
                            catch {
                                // ignore
                            }
                            return;
                        }
                        const { banned, ban } = await (0, bans_1.isBanned)({ login: accountUid, platformUid });
                        if (banned) {
                            void logAction(accountUid, "ban", "попытка входа в систему, будучи заблокированным", { reason: ban?.reason });
                            safeSend(ws, {
                                type: 2,
                                name: 0,
                                index: nextIndex(),
                                payload: {
                                    accessLevel: 0,
                                    userName: null,
                                    errorCode: true,
                                    userId: null,
                                    success: false,
                                    reason: ban?.reason || "You are banned",
                                },
                            });
                            try {
                                ws.close();
                            }
                            catch {
                                // ignore
                            }
                            return;
                        }
                        const user = await db_1.User.findOne({ "account.accountUid": accountUid });
                        if (!user) {
                            void logAction(accountUid, "warning", "Пользователь не найден, возвращен ответ гость.");
                            safeSend(ws, {
                                type: 0,
                                name: 0,
                                index: nextIndex(),
                                payload: { accessLevel: 2, userName: "null", errorCode: false, success: true },
                            });
                            return;
                        }
                        ws.connectedAt = new Date();
                        ws.id = String(user.account.accountUid).replace(/^u/, "");
                        ws.userId = Number(ws.id);
                        ws.userName = user.account.userName || null;
                        void logAction(user.account.accountUid, "logs", "Пользователь авторизован через веб-сокет.", { userName: ws.userName });
                        safeSend(ws, {
                            type: 2,
                            name: 0,
                            index: nextIndex(),
                            payload: {
                                accessLevel: 2,
                                userName: user.account.userName,
                                errorCode: false,
                                userId: ws.userId,
                                success: true,
                            },
                        });
                        try {
                            const upd = {};
                            if (typeof unwrap(p.language) !== "undefined")
                                upd["account.language"] = String(unwrap(p.language));
                            if (typeof unwrap(p.platform) !== "undefined")
                                upd["account.platform"] = String(unwrap(p.platform));
                            if (typeof unwrap(p.clientVersion) !== "undefined")
                                upd["account.clientVersion"] = Number(unwrap(p.clientVersion));
                            if (typeof unwrap(p.positionX) !== "undefined")
                                upd["account.X"] = Number(unwrap(p.positionX));
                            if (typeof unwrap(p.positionY) !== "undefined")
                                upd["account.Y"] = Number(unwrap(p.positionY));
                            if (typeof unwrap(p.platformUid) !== "undefined")
                                upd["account.platformUid"] = unwrap(p.platformUid);
                            if (Object.keys(upd).length) {
                                await db_1.User.updateOne({ "account.accountUid": accountUid }, { $set: upd });
                                void logAction(accountUid, "logs", "Поля учетной записи обновляются при входе в систему.", upd);
                            }
                        }
                        catch {
                            // ignore
                        }
                        try {
                            let userGiftDoc = await db_1.UserGift.findOne({ taker: user.account.accountUid }, { gifts: 1, store: 1 });
                            if (!userGiftDoc) {
                                userGiftDoc = new db_1.UserGift({ taker: user.account.accountUid, gifts: [], store: [] });
                            }
                            const giftEvent = {
                                type: 2,
                                name: 4,
                                index: nextIndex() + 1,
                                payload: { gifts: userGiftDoc.gifts ?? [], store: userGiftDoc.store ?? [] },
                            };
                            const messages = await buildChatHistoryForAuth(user.account.userName);
                            const baseEventAll = { type: 2, name: 3, index: nextIndex() + 2, payload: { messages } };
                            const delayMs = 2500;
                            const timeoutId = setTimeout(() => {
                                try {
                                    if (ws && ws.readyState === OPEN) {
                                        safeSend(ws, giftEvent);
                                        safeSend(ws, baseEventAll);
                                    }
                                }
                                catch (err) {
                                    void logAction(accountUid, "warning", `Не удалось отправить отложенный подарочный сертификат: ${String(err?.message || err)}`);
                                }
                            }, delayMs);
                            ws._pendingSends?.push(timeoutId);
                        }
                        catch (err) {
                            void logAction(user.account.accountUid, "warning", `AuthRequest: ошибка при подготовке данных посылки/чата: ${String(err?.message || err)}`);
                        }
                        break;
                    }
                    case 2: {
                        const loc = msg.data || {};
                        const userId = unwrap(loc.userId);
                        if (!userId) {
                            void logAction("system", "logs", "В запросе SendLocationRequest отсутствует userId");
                            return;
                        }
                        const { banned, ban } = await (0, bans_1.isBanned)({ login: `u${userId}` });
                        if (banned) {
                            void logAction(`u${userId}`, "ban", "попытка входа в систему, будучи заблокированным", { reason: ban?.reason });
                            safeSend(ws, { type: 2, name: 0, index: nextIndex() });
                            try {
                                ws.close();
                            }
                            catch {
                                // ignore
                            }
                            return;
                        }
                        const powerIndex = unwrap(loc.power) ?? 0;
                        const power = Power[powerIndex] || "naked";
                        const positionX = Number(unwrap(loc.positionX) ?? 0);
                        const positionY = Number(unwrap(loc.positionY) ?? 0);
                        const caps = unwrap(loc.caps) ?? 0;
                        let name = "null";
                        try {
                            const existing = await db_1.User.findOne({ "account.accountUid": `u${userId}` }).lean();
                            if (existing && existing.account)
                                name = existing.account.userName || "null";
                        }
                        catch (err) {
                            void logAction(`u${userId}`, "error", `SendLocationRequest: не удалось найти пользователя: ${String(err?.message || err)}`);
                        }
                        const safeTarget = sanitizeKey(name);
                        if (!safeTarget) {
                            void logAction(`u${userId}`, "warning", `Неверный целевой ключ: ${String(name)}`);
                            return;
                        }
                        try {
                            await db_1.User.updateOne({ "account.accountUid": `u${userId}` }, { $set: { "account.power": power } });
                        }
                        catch (err) {
                            void logAction(`u${userId}`, "chet_tex", `Не удалось обновить бронь: ${String(err?.message || err)}`);
                        }
                        try {
                            await db_1.Player.updateOne({ userId }, {
                                $set: {
                                    name,
                                    positionX,
                                    positionY,
                                    power,
                                    caps,
                                    data: new Date(),
                                    command: 0,
                                },
                            }, { upsert: true });
                        }
                        catch {
                            // ignore
                        }
                        let allPlayers = [];
                        try {
                            allPlayers = await db_1.Player.find({}).select("-__v -_id -data").lean();
                        }
                        catch {
                            // ignore
                        }
                        ws.isAlive = true;
                        const locEvent = { type: 2, name: 2, index: nextIndex(), payload: { players: allPlayers } };
                        const infoEvent = { type: 2, name: 1, index: nextIndex(), payload: { players: allPlayers } };
                        const onlineCoun = { type: 2, name: 6, index: nextIndex(), payload: { online: allPlayers.length } };
                        safeSend(ws, locEvent);
                        safeSend(ws, infoEvent);
                        safeSend(ws, onlineCoun);
                        break;
                    }
                    case 3: {
                        const cd = msg.data || {};
                        const entry = {
                            channel: unwrap(cd.channel) ?? cd.channel,
                            message: unwrap(cd.message) ?? cd.message,
                            name: unwrap(cd.name) ?? "Unknown",
                            login: unwrap(cd.login) ?? "unknown",
                        };
                        const senderDoc = await db_1.User.findOne({ "account.accountUid": `u${entry.login}`, "account.platformUid": msg.token });
                        if (!senderDoc) {
                            void logAction(`u${entry.login}`, "warning", "Пользователь не найден при отправке сообщения в чат.");
                            return;
                        }
                        if (String(entry.message || "").length >= 250)
                            return;
                        const { banned, ban } = await (0, bans_1.isBanned)({ login: `u${entry.login}`, platformUid: msg.token });
                        if (banned) {
                            void logAction(`u${entry.login}`, "ban", "попытка входа в систему, будучи заблокированным", { reason: ban?.reason });
                            safeSend(ws, { type: 2, name: 0, index: nextIndex() });
                            try {
                                ws.close();
                            }
                            catch {
                                // ignore
                            }
                            return;
                        }
                        const event = await db_1.ServerEvent.findOne();
                        if (event?.Chat)
                            return;
                        if (!db_1.mutesCollection) {
                            console.error("mutesCollection is not initialized");
                            return;
                        }
                        const muteDoc = await db_1.mutesCollection.findOne({ "mutes.login": `u${entry.login}` });
                        if (muteDoc) {
                            const mute = muteDoc.mutes.find((m) => {
                                const notExpired = !m.expiresAt || m.expiresAt > new Date();
                                return notExpired && m.login === `u${entry.login}`;
                            });
                            if (mute) {
                                safeSend(ws, {
                                    type: 2,
                                    name: 3,
                                    index: nextIndex(),
                                    payload: {
                                        messages: {
                                            messageId: 10000000,
                                            channel: 1,
                                            message: "ты в муте",
                                            name: "System",
                                        },
                                        reason: mute.reason || "You are muted",
                                    },
                                });
                                return;
                            }
                        }
                        const ch = String(entry.channel);
                        const senderName = String(entry.name || "").trim().toLowerCase();
                        const normalizeForCompare = (text) => String(text || "")
                            .toLowerCase()
                            .replace(/https?:\/\/\S+/g, " ")
                            .replace(/[^\p{L}\p{N}\s]+/gu, " ")
                            .replace(/\s+/g, " ")
                            .trim();
                        const wordsFromText = (text) => normalizeForCompare(text).split(" ").filter(Boolean);
                        const similarityByWords = (aWords, bWords) => {
                            const a = new Set(aWords);
                            const b = new Set(bWords);
                            if (!a.size || !b.size)
                                return 0;
                            let common = 0;
                            for (const w of a)
                                if (b.has(w))
                                    common++;
                            return common / Math.max(a.size, b.size);
                        };
                        const lastChat = (await db_1.ChatMessage.findOne({ channel: ch }, { messages: { $slice: -5 } }).lean());
                        if (lastChat?.messages?.length) {
                            const currentWords = wordsFromText(entry.message);
                            const isTooSimilar = lastChat.messages.some((prev) => {
                                const prevName = String(prev?.name || "").trim().toLowerCase();
                                if (prevName !== senderName)
                                    return false;
                                const prevWords = wordsFromText(prev?.message);
                                return similarityByWords(currentWords, prevWords) >= 0.6;
                            });
                            if (isTooSimilar)
                                return;
                        }
                        if (entry.channel == 3) {
                            await (0, logger_1.logGeneral)(`u${entry.login}`, "privat_chat", `пользователь (${entry.name}) отправил приватное сообщение: ${entry.message}`);
                        }
                        else {
                            await (0, logger_1.logGeneral)(`u${entry.login}`, "chat", `пользователь (${entry.name}) отправил сообщение в канал ${entry.channel}: ${entry.message}`);
                        }
                        const now = new Date();
                        const chatlist = [{ messageId: 1, channel: entry.channel, message: entry.message, name: entry.name, time: now.toISOString() }];
                        if (entry.channel == 3) {
                            const privateRegex = /\/to\s+(\S+)\s+\/m\s+(.+)/i;
                            const match = String(entry.message || "").match(privateRegex);
                            if (!match)
                                return;
                            const targetName = match[1].trim().toLowerCase();
                            const receiverDoc = await db_1.User.findOne({ "account.userName": targetName });
                            if (!receiverDoc || !receiverDoc.account)
                                return;
                            const chat = await getOrCreatePrivateChat(senderDoc.account.accountUid, receiverDoc.account.accountUid);
                            const chatId = chat._id;
                            const updated = await db_1.ChatMessage.findOneAndUpdate({ _id: chatId }, { $inc: { messageId: 1 } }, { new: true }).lean();
                            if (!updated) {
                                if (!chat.messages[senderDoc.account.accountUid])
                                    chat.messages[senderDoc.account.accountUid] = [];
                                const fallbackId = chat.messageId || 1;
                                chat.messages[senderDoc.account.accountUid].push({
                                    name: entry.name,
                                    message: entry.message,
                                    channel: entry.channel,
                                    messageId: fallbackId,
                                    time: now.toISOString(),
                                });
                                chat.messageId = (chat.messageId || 0) + 1;
                                chat.markModified?.("messages");
                                await chat.save();
                                chatlist[0].messageId = fallbackId;
                                const baseEventFallback = { type: 2, name: 3, index: nextIndex(), payload: { messages: chatlist } };
                                safeSend(ws, baseEventFallback);
                                if (senderDoc.account.accountUid !== receiverDoc.account.accountUid) {
                                    sendEventToUser(receiverDoc.account.accountUid.slice(1), baseEventFallback);
                                }
                                break;
                            }
                            const newMsgId = Number(updated.messageId);
                            const assignedMessageId = newMsgId;
                            const msgObj = {
                                name: entry.name,
                                message: entry.message,
                                channel: entry.channel,
                                messageId: assignedMessageId,
                                time: now.toISOString(),
                            };
                            const pushOps = {};
                            pushOps[`messages.${senderDoc.account.accountUid}`] = msgObj;
                            if (senderDoc.account.accountUid !== receiverDoc.account.accountUid) {
                                pushOps[`messages.${receiverDoc.account.accountUid}`] = msgObj;
                            }
                            await db_1.ChatMessage.updateOne({ _id: chatId }, { $push: pushOps });
                            chatlist[0].messageId = assignedMessageId;
                            const baseEventAll = { type: 2, name: 3, index: nextIndex(), payload: { messages: chatlist } };
                            safeSend(ws, baseEventAll);
                            if (senderDoc.account.accountUid !== receiverDoc.account.accountUid) {
                                sendEventToUser(receiverDoc.account.accountUid.slice(1), baseEventAll);
                            }
                            break;
                        }
                        const channel = String(entry.channel);
                        const chat = await getOrCreatePublicChat(channel);
                        const chatId = chat._id;
                        const updatedPub = await db_1.ChatMessage.findOneAndUpdate({ _id: chatId }, { $inc: { messageId: 1 } }, { new: true }).lean();
                        if (!updatedPub) {
                            const offsetFallback = entry.channel == 1 ? 1000 : 50;
                            const fallbackId = (chat.messageId || 0) + offsetFallback;
                            chat.messages.push({ name: entry.name, message: cleanText(entry.message), channel: entry.channel, messageId: fallbackId, time: now.toISOString() });
                            chat.messageId = (chat.messageId || 0) + 1;
                            chat.markModified?.("messages");
                            await chat.save();
                            chatlist[0].messageId = fallbackId;
                        }
                        else {
                            const newPubId = Number(updatedPub.messageId);
                            const offset = String(entry.channel) === "1" ? 1000 : 50;
                            chatlist[0].messageId = newPubId + offset;
                            const msgObj = {
                                name: entry.name,
                                message: cleanText(entry.message),
                                channel: entry.channel,
                                messageId: newPubId + offset,
                                time: now.toISOString(),
                            };
                            await db_1.ChatMessage.updateOne({ _id: chatId }, { $push: { messages: msgObj } });
                        }
                        const baseEventAll = { type: 2, name: 3, index: nextIndex(), payload: { messages: chatlist } };
                        for (const c of server_1.wss.clients) {
                            if (c.readyState !== OPEN)
                                return;
                            c.send(JSON.stringify(baseEventAll));
                        }
                        break;
                    }
                    case 200: {
                        const evt = { type: 2, name: 202, index: nextIndex() + 1, payload: { serverTime: Date.now() } };
                        safeSend(ws, evt);
                        break;
                    }
                    case 7: {
                        try {
                            const data = msg.data || {};
                            const identifier = unwrap(data.identifier);
                            const receiverId = unwrap(data.receiverId);
                            const senderDataStr = unwrap(data.senderData);
                            if (typeof identifier === "undefined" || typeof receiverId === "undefined" || !senderDataStr) {
                                safeSend(ws, { type: 1, name: 7, index: nextIndex(), payload: [identifier || null, 0, 0] });
                                return;
                            }
                            const event = await db_1.ServerEvent.findOne();
                            if (event?.Help)
                                return;
                            let decodedSender;
                            try {
                                decodedSender = JSON.parse(senderDataStr);
                            }
                            catch {
                                safeSend(ws, { type: 1, name: 7, index: nextIndex(), payload: [identifier, 0, 0] });
                                return;
                            }
                            const queryId = nextIndex();
                            const endingTimestamp = Math.floor(Date.now() / 1000) + 60;
                            const invitation = {
                                queryId,
                                senderId: decodedSender.userId,
                                senderName: decodedSender.name || "",
                                receiverId,
                                senderData: senderDataStr,
                                endingTimestamp,
                                status: "pending",
                                createdAt: Date.now(),
                            };
                            try {
                                const inviteLogin = `invite:${queryId}`;
                                let inviteDoc = await db_1.Fight.findOne({ login: inviteLogin });
                                if (!inviteDoc) {
                                    inviteDoc = new db_1.Fight({
                                        login: inviteLogin,
                                        name: `invite_from_u${decodedSender.userId}_to_u${receiverId}`,
                                        process: JSON.stringify(invitation),
                                    });
                                    await inviteDoc.save();
                                }
                                else {
                                    inviteDoc.process = JSON.stringify(invitation);
                                    await inviteDoc.save();
                                }
                            }
                            catch {
                                safeSend(ws, { type: 1, name: 7, index: nextIndex(), payload: [identifier, 0, 0] });
                                return;
                            }
                            safeSend(ws, { type: 1, name: 7, index: nextIndex(), payload: [identifier, queryId, 1] });
                            const helpInfoEvent = {
                                type: 2,
                                name: 7,
                                index: nextIndex(),
                                payload: {
                                    queryId,
                                    senderId: decodedSender.userId,
                                    senderName: decodedSender.name || "",
                                    senderData: senderDataStr,
                                    endingTimestamp,
                                },
                            };
                            sendEventToUser(receiverId, helpInfoEvent);
                            void logAction("invite", "logs", `приглашать ${queryId} от u${decodedSender.userId} - u${receiverId}`);
                        }
                        catch {
                            safeSend(ws, { type: 1, name: 7, index: nextIndex(), payload: [msg.data?.identifier?.value || null, 0, 0] });
                        }
                        break;
                    }
                    case 8: {
                        try {
                            const data = msg.data || {};
                            const identifier = unwrap(data.identifier);
                            const queryId = unwrap(data.queryId);
                            const answerCode = unwrap(data.answerCode);
                            const receiverDataStr = unwrap(data.receiverData);
                            const initiatorId = unwrap(data.receiverId);
                            if (typeof identifier === "undefined" || typeof queryId === "undefined" || typeof answerCode === "undefined" || typeof initiatorId === "undefined") {
                                safeSend(ws, { type: 1, name: 8, index: nextIndex(), payload: [identifier || null, 0] });
                                return;
                            }
                            const inviteLogin = `invite:${queryId}`;
                            const inviteDoc = await db_1.Fight.findOne({ login: inviteLogin });
                            if (!inviteDoc || !inviteDoc.process) {
                                safeSend(ws, { type: 1, name: 8, index: nextIndex(), payload: [identifier, 0] });
                                return;
                            }
                            let invitation;
                            try {
                                invitation = JSON.parse(inviteDoc.process);
                            }
                            catch {
                                safeSend(ws, { type: 1, name: 8, index: nextIndex(), payload: [identifier, 0] });
                                return;
                            }
                            if (typeof ws.userId !== "undefined" && String(ws.userId) !== String(invitation.receiverId)) {
                                safeSend(ws, { type: 1, name: 8, index: nextIndex(), payload: [identifier, 0] });
                                void logAction(`u${ws.userId || "unknown"}`, "warning", "несанкционированная попытка отправки запроса AnswerHelpRequest");
                                return;
                            }
                            const now = Math.floor(Date.now() / 1000);
                            if (invitation.endingTimestamp && invitation.endingTimestamp < now) {
                                invitation.status = "expired";
                                inviteDoc.process = JSON.stringify(invitation);
                                await inviteDoc.save();
                                safeSend(ws, { type: 1, name: 8, index: nextIndex(), payload: [identifier, 0] });
                                return;
                            }
                            if (answerCode === 1 && receiverDataStr) {
                                try {
                                    const decodedReceiver = JSON.parse(receiverDataStr);
                                    let user = await db_1.Fight.findOne({ login: `u${decodedReceiver.userId}` });
                                    if (!user) {
                                        user = new db_1.Fight({ login: `u${decodedReceiver.userId}`, name: decodedReceiver.name || "", process: receiverDataStr });
                                        await user.save();
                                    }
                                    else {
                                        user.process = receiverDataStr;
                                        await user.save();
                                    }
                                }
                                catch {
                                    // ignore
                                }
                            }
                            let receiverName = "";
                            if (receiverDataStr) {
                                try {
                                    const tmp = JSON.parse(receiverDataStr);
                                    receiverName = tmp.name || "";
                                }
                                catch {
                                    // ignore
                                }
                            }
                            if (!receiverName && ws.userName)
                                receiverName = ws.userName;
                            const helpAnswerEvent = {
                                type: 2,
                                name: 8,
                                index: nextIndex(),
                                payload: {
                                    queryId: invitation.queryId,
                                    receiverId: invitation.receiverId,
                                    answerCode,
                                    receiverName,
                                    receiverData: answerCode === 1 ? receiverDataStr || "" : "",
                                },
                            };
                            sendEventToUser(invitation.senderId, helpAnswerEvent);
                            safeSend(ws, { type: 1, name: 8, index: nextIndex(), payload: [identifier, 1] });
                            invitation.status = answerCode === 1 ? "accepted" : "rejected";
                            invitation.answeredAt = Date.now();
                            if (answerCode === 1 && receiverDataStr)
                                invitation.receiverData = receiverDataStr;
                            inviteDoc.process = JSON.stringify(invitation);
                            await inviteDoc.save();
                            void logAction("invite", "logs", `приглашать ${queryId} ответил ${String(answerCode)}`, { by: ws.userId });
                        }
                        catch {
                            safeSend(ws, { type: 1, name: 8, index: nextIndex(), payload: [msg.data?.identifier?.value || null, 0] });
                        }
                        break;
                    }
                    case 4: {
                        const d = msg.data || {};
                        const queryId = unwrap(d.identifier) ?? nextIndex();
                        const senderId = unwrap(d.senderId);
                        const receiverId = unwrap(d.receiverUserId);
                        const giftData = unwrap(d.giftData);
                        const identifier = unwrap(d.identifier);
                        const giftId = Date.now() + Math.floor(Math.random() * 1000);
                        if (!senderId || !receiverId)
                            return;
                        const existing = await db_1.User.findOne({ "account.accountUid": `u${senderId}`, "account.platformUid": msg.token });
                        if (!existing) {
                            void logAction(`u${senderId}`, "warning", "Пользователь не найден при попытке отправить подарок.");
                            return;
                        }
                        const { banned, ban } = await (0, bans_1.isBanned)({ login: `u${senderId}`, platformUid: msg.token });
                        if (banned) {
                            void logAction(`u${senderId}`, "ban", "Заблокированный пользователь попытался отправить подарок.", { reason: ban?.reason });
                            return;
                        }
                        const event = await db_1.ServerEvent.findOne();
                        if (event?.Gift_send)
                            return;
                        const now = new Date();
                        if (!existing.account)
                            existing.account = {};
                        const liveOnlineHours = Number(existing.account.onlineTimeHours || 0) + (Date.now() - (ws.connectedAt || Date.now())) / 36e5;
                        let userGift = await db_1.UserGift.findOne({ taker: `u${senderId}` });
                        if (!userGift) {
                            userGift = new db_1.UserGift({ taker: `u${senderId}`, gifts: [], store: [], limite: 0 });
                        }
                        const currentSent = Number(userGift.limite || 0);
                        const maxAllowed = getMaxAllowedByHours(liveOnlineHours);
                        if (currentSent >= maxAllowed) {
                            safeSend(ws, {
                                type: 1,
                                name: 4,
                                index: nextIndex(),
                                payload: { result: 0, limit: 0, time: getMinutesUntilLimitIncrease(liveOnlineHours) },
                            });
                            return;
                        }
                        userGift.limite = currentSent + 1;
                        await userGift.save();
                        const remainingLimit = Math.max(0, maxAllowed - userGift.limite);
                        const timeLeft = getMinutesUntilLimitIncrease(liveOnlineHours);
                        let receiverName = "null";
                        let senderName = "null";
                        try {
                            if (existing?.account)
                                senderName = existing.account.userName || "null";
                            void logAction(`u${senderId}`, "gift", `пользователь отправил подарок u${receiverId}`, { giftData });
                            const receiverExisting = await db_1.User.findOne({ "account.accountUid": `u${receiverId}` }).lean();
                            receiverName = receiverExisting?.account?.userName || "null";
                        }
                        catch {
                            // ignore
                        }
                        const gifts = { giftId, senderName, giftData };
                        const store = { giftId, creatingTimestamp: Date.now(), deletingTimestamp: Date.now() + 3600000 };
                        try {
                            let userGiftDoc = await db_1.UserGift.findOne({ taker: `u${receiverId}` });
                            if (!userGiftDoc) {
                                userGiftDoc = new db_1.UserGift({ taker: `u${receiverId}`, gifts: [], store: [] });
                            }
                            const currentIndex = userGiftDoc?.indeks || 0;
                            if (currentIndex == identifier) {
                                safeSend(ws, { type: 1, name: 4, index: nextIndex(), payload: { result: 0, time: timeLeft } });
                                return;
                            }
                            userGiftDoc.indeks = identifier;
                            userGiftDoc.gifts.push(gifts);
                            userGiftDoc.store.push(store);
                            await userGiftDoc.save();
                            await db_1.GiftParcel.create({
                                giftId: String(giftId),
                                senderLogin: `u${senderId}`,
                                senderName,
                                receiverLogin: `u${receiverId}`,
                                receiverName,
                                giftData,
                                status: "current",
                                sentAt: new Date(),
                                receivedAt: null,
                                deletedAt: null,
                                deletedBy: null,
                                deleteReason: null,
                                createdAt: new Date(),
                                updatedAt: new Date(),
                            });
                            safeSend(ws, {
                                type: 1,
                                name: 4,
                                index: nextIndex(),
                                payload: { result: 1, identifier, limit: remainingLimit, time: timeLeft },
                            });
                            const targetClient = findClientById(receiverId);
                            const payload = { gifts: userGiftDoc.gifts, store: userGiftDoc.store };
                            if (targetClient) {
                                safeSend(targetClient, { type: 2, name: 4, index: nextIndex(), payload });
                            }
                            else {
                                sendEventToUser(receiverId, { type: 2, name: 4, index: nextIndex(), payload });
                            }
                        }
                        catch {
                            return;
                        }
                        void queryId;
                        break;
                    }
                    case 5: {
                        const d = msg.data || {};
                        const queryId = unwrap(d.identifier);
                        const giftId = unwrap(d.giftId);
                        const identifier = unwrap(d.identifier);
                        if (!giftId) {
                            safeSend(ws, { type: 1, name: 5, index: queryId, payload: { result: 0, reason: "Missing giftId" } });
                            return;
                        }
                        const event = await db_1.ServerEvent.findOne();
                        if (event?.Gift_req)
                            return;
                        const now = new Date();
                        const existing = await db_1.User.findOne({ "account.accountUid": `u${ws?.id}`, "account.platformUid": msg.token });
                        if (!existing)
                            return;
                        if (!existing.account)
                            existing.account = {};
                        let userGift = await db_1.UserGift.findOne({ taker: `u${ws?.id}` });
                        if (!userGift) {
                            userGift = new db_1.UserGift({ taker: `u${ws?.id}`, gifts: [], store: [], limite: 0, time: now });
                        }
                        try {
                            await db_1.UserGift.updateMany({ taker: `u${ws?.id}` }, {
                                $pull: {
                                    gifts: { giftId },
                                    store: { giftId },
                                },
                            });
                            await db_1.GiftParcel.updateOne({ giftId: String(giftId) }, {
                                $set: {
                                    status: "received",
                                    receivedAt: new Date(),
                                    updatedAt: new Date(),
                                },
                            });
                            await userGift.save();
                            safeSend(ws, { type: 1, name: 5, index: queryId, payload: { result: 1, giftId, identifier } });
                            void logAction(ws?.id ? `u${ws.id}` : "system", "gift", `подарок ${giftId} взятый`, { identifier });
                        }
                        catch {
                            safeSend(ws, { type: 1, name: 5, index: queryId, payload: { result: 0 } });
                        }
                        break;
                    }
                    case 6: {
                        const d = msg.data || {};
                        const giftId = unwrap(d.parameterInt) ?? unwrap(d.giftId);
                        if (!giftId)
                            break;
                        try {
                            await db_1.UserGift.updateMany({}, {
                                $pull: {
                                    gifts: { giftId },
                                    store: { giftId },
                                },
                            });
                            await db_1.GiftParcel.updateOne({ giftId: String(giftId) }, {
                                $set: {
                                    status: "deleted",
                                    deletedAt: new Date(),
                                    deletedBy: ws.userId ? `u${ws.userId}` : "unknown",
                                    deleteReason: "single delete",
                                    updatedAt: new Date(),
                                },
                            });
                            safeSend(ws, { type: 1, name: 11, index: nextIndex(), payload: { result: 1, giftId } });
                            void logAction(ws.userId ? `u${ws.userId}` : "system", "gift", `удаленный подарок ${giftId}`);
                        }
                        catch {
                            // ignore
                        }
                        break;
                    }
                    default:
                        break;
                }
            }
            catch {
                // intentionally silent
            }
        });
        ws.on("error", () => {
            try {
                ws.close();
            }
            catch {
                try {
                    ws.terminate();
                }
                catch {
                    // ignore
                }
            }
        });
        ws.on("close", async (code, reason) => {
            try {
                const onlineMs = Date.now() - (ws.connectedAt || Date.now()).getTime();
                const onlineHours = onlineMs / 36e5;
                const id = ws?.id;
                await db_1.User.updateOne({ "account.accountUid": `u${id}` }, {
                    $inc: { "account.onlineTimeHours": onlineHours },
                    $set: { "account.lastSeenAt": new Date() },
                });
                if (id) {
                    await db_1.Player.deleteOne({ userId: id });
                    void logAction(`u${id}`, "logs", `соединение закрыто ${String(code)}`, { reason: String(reason) });
                }
                if (ws._pendingSends && Array.isArray(ws._pendingSends)) {
                    for (const t of ws._pendingSends)
                        clearTimeout(t);
                    ws._pendingSends = [];
                }
            }
            catch {
                // intentionally silent
            }
        });
    });
}
exports.main = main;
