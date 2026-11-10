"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setGiftParcelsCollection = exports.setMutesCollection = exports.setBansCollection = void 0;
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const encryption_1 = require("../utils/encryption");
const response_1 = require("../utils/response");
const db_1 = require("../db");
const router = (0, express_1.Router)();
async function startbb() {
    const event = await db_1.ServerEvent.findOne();
    if (!event) {
        const newEvent = new db_1.ServerEvent();
        await newEvent.save();
    }
}
void startbb();
let bansCollection = null;
let mutesCollection = null;
let giftParcelsCollection = null;
function setBansCollection(collection) {
    bansCollection = collection;
}
exports.setBansCollection = setBansCollection;
function setMutesCollection(collection) {
    mutesCollection = collection;
}
exports.setMutesCollection = setMutesCollection;
function setGiftParcelsCollection(collection) {
    giftParcelsCollection = collection;
}
exports.setGiftParcelsCollection = setGiftParcelsCollection;
function toDateSafe(value) {
    if (!value)
        return null;
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? null : d;
}
function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    if (Number.isNaN(n))
        return fallback;
    return Math.max(min, Math.min(max, n));
}
async function resolveUserByLoginOrName(login, name) {
    if (login) {
        const user = await db_1.User.findOne({ "account.accountUid": String(login) }).lean();
        if (!user)
            return null;
        return {
            login: String(login),
            name: user?.account?.userName || null,
            user,
        };
    }
    if (name) {
        const user = await db_1.User.findOne({ "account.userName": String(name) }).lean();
        if (!user)
            return null;
        return {
            login: user?.account?.accountUid || null,
            name: String(name),
            user,
        };
    }
    return null;
}
function buildGiftQuery(params) {
    const q = {};
    if (params.type && params.type !== "all") {
        q.status = String(params.type);
    }
    if (params.giftId != null && params.giftId !== "") {
        q.giftId = String(params.giftId);
    }
    if (params.login || params.name) {
        const or = [];
        if (params.login) {
            or.push({ senderLogin: String(params.login) }, { receiverLogin: String(params.login) }, { deletedBy: String(params.login) });
        }
        if (params.name) {
            or.push({ senderName: String(params.name) }, { receiverName: String(params.name) });
        }
        if (or.length)
            q.$or = or;
    }
    const start = toDateSafe(params.from);
    const end = toDateSafe(params.to);
    if (start || end) {
        q.sentAt = {};
        if (start)
            q.sentAt.$gte = start;
        if (end)
            q.sentAt.$lte = end;
    }
    return q;
}
function groupGifts(items) {
    return {
        current: items.filter((x) => x.status === "current"),
        sent: items.filter((x) => x.status === "sent"),
        received: items.filter((x) => x.status === "received"),
        deleted: items.filter((x) => x.status === "deleted"),
    };
}
async function deleteGiftBySenderLogin(login) {
    try {
        if (!login)
            return;
        const uid = String(login);
        const user = await db_1.User.findOne({ "account.accountUid": uid }).lean();
        if (!user || !user.account)
            return;
        const senderName = String(user.account.userName || "").trim();
        if (!senderName)
            return;
        const logsCollection = mongoose_1.default.connection.db?.collection("logs") ?? null;
        if (!logsCollection)
            return;
        const logs = await logsCollection.findOne({ login: uid });
        if (!logs || !logs.gift || logs.gift.length === 0)
            return;
        const receivers = new Set();
        for (const entry of logs.gift) {
            if (!entry?.message)
                continue;
            const match = String(entry.message).match(/пользователь отправил подарок (u\d+)/i);
            if (match)
                receivers.add(match[1]);
        }
        if (receivers.size === 0)
            return;
        for (const taker of receivers) {
            const doc = await db_1.UserGift.findOne({ taker });
            if (!doc || !doc.gifts)
                continue;
            const giftIdsToDelete = doc.gifts
                .filter((g) => String(g.senderName || "").trim() === senderName)
                .map((g) => g.giftId);
            if (giftIdsToDelete.length === 0)
                continue;
            await db_1.UserGift.updateOne({ taker }, {
                $pull: {
                    gifts: { senderName },
                },
            });
            await db_1.UserGift.updateOne({ taker }, {
                $pull: {
                    store: { giftId: { $in: giftIdsToDelete } },
                },
            });
        }
    }
    catch (err) {
        console.error("deleteGiftBySenderLogin error:", err);
    }
}
router.post("/gift_info", async (req, res) => {
    try {
        const { login, name } = req.body;
        if (!login && !name) {
            return (0, response_1.sendError)(res, "Укажите 'login' или 'name' в теле запроса");
        }
        let giftInfo = null;
        if (login) {
            giftInfo = await db_1.UserGift.findOne({ taker: String(login) }).lean();
        }
        if (name && !giftInfo) {
            const users = await db_1.User.findOne({ "account.userName": String(name) }).lean();
            if (users?.account?.accountUid) {
                giftInfo = await db_1.UserGift.findOne({ taker: String(users.account.accountUid) }).lean();
            }
        }
        if (!giftInfo) {
            return (0, response_1.sendError)(res, "Информация о подарках не найдена для указанного login/name");
        }
        return (0, response_1.sendSuccess)(res, { giftInfo });
    }
    catch (err) {
        console.error("/gift_info error:", err);
        return (0, response_1.sendError)(res, "Не удалось получить информацию о подарках");
    }
});
router.get("/gifts", async (req, res) => {
    try {
        const { type = "all", login = null, name = null, giftId = null, from = null, to = null, limit = 50, skip = 0, } = req.query;
        const resolved = await resolveUserByLoginOrName(login ? String(login) : null, name ? String(name) : null);
        const query = buildGiftQuery({
            type: String(type),
            login: resolved?.login || (login ? String(login) : null),
            name: resolved?.name || (name ? String(name) : null),
            giftId,
            from,
            to,
        });
        const lim = clampNumber(limit, 1, 1000, 50);
        const sk = clampNumber(skip, 0, 10000000, 0);
        const items = (await db_1.GiftParcel.find(query).sort({ sentAt: -1, _id: -1 }).skip(sk).limit(lim).lean());
        if (String(type) === "all") {
            return (0, response_1.sendSuccess)(res, {
                items: groupGifts(items),
                total: items.length,
            });
        }
        return (0, response_1.sendSuccess)(res, {
            items,
            total: items.length,
        });
    }
    catch (err) {
        console.error("/gifts error:", err);
        return (0, response_1.sendError)(res, "Не удалось получить список посылок");
    }
});
router.get("/gifts/audit/:login", async (req, res) => {
    try {
        const login = String(req.params.login || "");
        if (!login) {
            return (0, response_1.sendError)(res, "Не указан login");
        }
        const { from = null, to = null, last = 100 } = req.query;
        const lim = clampNumber(last, 1, 1000, 100);
        const query = buildGiftQuery({
            type: "all",
            login,
            name: null,
            giftId: null,
            from,
            to,
        });
        const items = (await db_1.GiftParcel.find(query).sort({ sentAt: -1, _id: -1 }).limit(lim).lean());
        return (0, response_1.sendSuccess)(res, {
            login,
            last: lim,
            from: from || null,
            to: to || null,
            audit: groupGifts(items),
        });
    }
    catch (err) {
        console.error("/gifts/audit error:", err);
        return (0, response_1.sendError)(res, "Не удалось получить аудит посылок");
    }
});
router.post("/gifts/delete", async (req, res) => {
    try {
        const id = req.body?.id || req.params?.id;
        if (!id) {
            return (0, response_1.sendError)(res, "Не указан id посылки");
        }
        const reason = String(req.body?.reason || req.query?.reason || "Удалено модерацией");
        const admin = String(req.headers["x-admin"] || "moderator");
        const now = new Date();
        if (Number.isNaN(Number(id))) {
            return (0, response_1.sendError)(res, "giftId должен быть числом.");
        }
        const result = await db_1.UserGift.updateOne({
            $or: [{ "gifts.giftId": id }, { "store.giftId": id }],
        }, {
            $pull: {
                gifts: { giftId: id },
                store: { giftId: id },
            },
        });
        if (result.modifiedCount === 0) {
            return (0, response_1.sendError)(res, "Подарок не найден.");
        }
        await db_1.GiftParcel.updateOne({ giftId: String(id) }, {
            $set: {
                status: "deleted",
                deletedAt: now,
                deletedBy: admin,
                deleteReason: reason,
                updatedAt: now,
            },
        });
        return (0, response_1.sendSuccess)(res, `Подарок ${id} удалён у пользователей и помечен как удалённый.`);
    }
    catch (err) {
        console.error("/delete_gift error:", err);
        return (0, response_1.sendError)(res, "Ошибка при удалении подарка.");
    }
});
router.post("/gift_send", async (req, res) => {
    try {
        const { receiverLogin, giftData } = req.body;
        if (!receiverLogin || !giftData) {
            return (0, response_1.sendError)(res, "receiverLogin и giftData обязательны");
        }
        const giftId = Date.now() + Math.floor(Math.random() * 1000);
        const now = new Date();
        const receiver = await db_1.User.findOne({ "account.accountUid": String(receiverLogin) }).lean();
        const receiverName = receiver?.account?.userName || "null";
        let receiverGiftDoc = await db_1.UserGift.findOne({ taker: receiverLogin });
        if (!receiverGiftDoc) {
            receiverGiftDoc = new db_1.UserGift({ taker: receiverLogin, gifts: [], store: [] });
        }
        const giftObj = {
            giftId,
            senderName: "SERVER",
            giftData: JSON.stringify(giftData),
        };
        const storeObj = {
            giftId,
            creatingTimestamp: Date.now(),
            deletingTimestamp: Date.now() + 3600000,
        };
        receiverGiftDoc.gifts.push(giftObj);
        receiverGiftDoc.store.push(storeObj);
        await receiverGiftDoc.save();
        await db_1.GiftParcel.create({
            giftId: String(giftId),
            senderLogin: "SERVER",
            senderName: "SERVER",
            receiverLogin,
            receiverName,
            giftData: JSON.stringify(giftData),
            status: "current",
            sentAt: now,
            receivedAt: null,
            deletedAt: null,
            deletedBy: null,
            deleteReason: null,
            createdAt: now,
            updatedAt: now,
        });
        return (0, response_1.sendSuccess)(res, {
            result: 1,
            message: "Подарок успешно отправлен",
        });
    }
    catch (err) {
        console.error("/gift_send error:", err);
        return (0, response_1.sendError)(res, "Ошибка при отправке подарка");
    }
});
router.get("/playerlist/action", async (req, res) => {
    try {
        const enc = req.body?.data;
        if (enc && typeof enc === "string") {
            try {
                void (0, encryption_1.tryDecrypt)(enc);
            }
            catch {
                // ignore decryption errors
            }
        }
        const players = await db_1.Player.find({}, { userId: 1, _id: 0 }).lean();
        const logins = players.map((p) => "u" + String(p.userId));
        const users = await db_1.User.find({ "account.accountUid": { $in: logins } }, { _id: 0, __v: 0 }).lean();
        const userMap = new Map();
        for (const u of users) {
            if (u?.account?.accountUid)
                userMap.set(u.account.accountUid, u);
        }
        const result = players.map((p) => {
            const login = "u" + String(p.userId);
            if (userMap.has(login))
                return userMap.get(login);
            return { [login]: "not found" };
        });
        return (0, response_1.sendSuccess)(res, { players: result });
    }
    catch (err) {
        console.error("playerlist/action error:", err);
        return (0, response_1.sendError)(res, "Failed to build player list");
    }
});
router.post("/version", async (req, res) => {
    try {
        const { version } = req.body;
        if (!version || typeof version !== "string") {
            return (0, response_1.sendError)(res, "Missing or invalid version");
        }
        await db_1.ServerEvent.updateOne({}, { $set: { version } }, { upsert: true });
        return (0, response_1.sendSuccess)(res, { version });
    }
    catch (err) {
        console.error("Error updating version:", err);
        return (0, response_1.sendError)(res, "Failed to update version");
    }
});
router.get("/version", async (_req, res) => {
    try {
        let version = "unknown";
        const event = await db_1.ServerEvent.findOne().lean();
        if (event?.version) {
            version = event.version;
        }
        return (0, response_1.sendSuccess)(res, { version });
    }
    catch (err) {
        console.error("Error updating version:", err);
        return (0, response_1.sendError)(res, "Failed to update version");
    }
});
router.post("/player/info", async (req, res) => {
    try {
        const { login, name, id } = req.body;
        let users;
        let version = "unknown";
        const event = await db_1.ServerEvent.findOne().lean();
        if (event?.version) {
            version = event.version;
        }
        if (id) {
            users = await db_1.User.findOne({ "account.telegram": id }).lean();
            (0, response_1.sendSuccess)(res, { user: users, version: version || "unknown" });
            return;
        }
        if (!login && !name) {
            return (0, response_1.sendSuccess)(res, { error: "указыте хотяби что-то" });
        }
        if (login) {
            users = await db_1.Player.findOne({ userId: String(login).replace(/^u/, "") }).lean();
        }
        if (name && !users) {
            users = await db_1.Player.findOne({ name }).lean();
        }
        if (login && !users) {
            users = await db_1.User.findOne({ "account.accountUid": login }).lean();
        }
        if (name && !users) {
            users = await db_1.User.findOne({ "account.userName": name }).lean();
        }
        (0, response_1.sendSuccess)(res, { user: users });
    }
    catch (err) {
        console.error("Error fetching users:", err);
        (0, response_1.sendError)(res, "Failed to fetch users");
    }
});
router.get("/playerlist/all", async (_req, res) => {
    try {
        const users = await db_1.User.find({}, { _id: 0, __v: 0 }).lean();
        (0, response_1.sendSuccess)(res, { users });
    }
    catch (err) {
        console.error("Error fetching users:", err);
        (0, response_1.sendError)(res, "Failed to fetch users");
    }
});
router.post("/player/ban", async (req, res) => {
    try {
        const { userid, text, time, ban_Id, all, platformUid, ip } = req.body;
        const login = typeof userid === "string" ? userid : "u" + String(userid);
        const minutes = time == null ? null : Number(time);
        const expiresAt = minutes ? new Date(Date.now() + minutes * 60000) : null;
        const u = await db_1.User.findOne({ "account.accountUid": login }).lean();
        const platformUidToStore = u?.account?.platformUid ?? platformUid ?? null;
        const banRecord = {
            login,
            ip: String(ip || u?.account?.IP || null),
            platformUid: platformUid ? platformUidToStore : null,
            reason: String(text),
            durationMinutes: minutes,
            expiresAt,
            ban_Id: !!ban_Id,
            all: !!all,
            createdBy: req.headers["x-admin"] ? String(req.headers["x-admin"]) : null,
            createdAt: new Date(),
        };
        if (!bansCollection) {
            return (0, response_1.sendError)(res, "Ban collection not initialized");
        }
        const existingDocument = await bansCollection.findOne({});
        if (!existingDocument) {
            console.log("Initializing bans collection with empty bans array");
            await bansCollection.insertOne({ bans: [] });
        }
        const result = await bansCollection.updateOne({ "bans.login": login }, { $set: { "bans.$": banRecord } }, { upsert: false });
        if (result.matchedCount === 0) {
            await bansCollection.updateOne({}, { $push: { bans: banRecord } }, { upsert: true });
        }
        await deleteGiftBySenderLogin(login);
        return (0, response_1.sendSuccess)(res, { ban: banRecord });
    }
    catch (err) {
        console.error("Error creating ban:", err);
        return (0, response_1.sendError)(res, "Failed to create ban");
    }
});
router.post("/player/unban", async (req, res) => {
    try {
        const { userid } = req.body;
        if (!userid) {
            return (0, response_1.sendError)(res, "userid is required");
        }
        const login = typeof userid === "string" ? userid : "u" + String(userid);
        if (!bansCollection) {
            return (0, response_1.sendError)(res, "Ban collection not initialized");
        }
        const existingDocument = await bansCollection.findOne({});
        if (!existingDocument) {
            console.log("Initializing bans collection with empty bans array");
            await bansCollection.insertOne({ bans: [] });
        }
        const result = await bansCollection.updateOne({}, { $pull: { bans: { login } } });
        if (result.modifiedCount === 0) {
            return (0, response_1.sendError)(res, "Ban not found");
        }
        return (0, response_1.sendSuccess)(res, { unbanned: login });
    }
    catch (err) {
        console.error("Error removing ban:", err);
        return (0, response_1.sendError)(res, "Failed to remove ban");
    }
});
router.post("/player/mute", async (req, res) => {
    try {
        const { userid, text, time } = req.body;
        if (!userid || !text)
            return (0, response_1.sendError)(res, "Missing required fields: userid or text");
        const login = typeof userid === "string" ? userid : "u" + String(userid);
        const minutes = time == null ? null : Number(time);
        const expiresAt = minutes ? new Date(Date.now() + minutes * 60000) : null;
        const u = await db_1.User.findOne({ "account.accountUid": login }).lean();
        const platformUidToStore = u?.account?.platformUid ?? null;
        const muteRecord = {
            login,
            platformUid: platformUidToStore,
            reason: String(text),
            durationMinutes: minutes,
            expiresAt,
            createdBy: req.headers["x-admin"] ? String(req.headers["x-admin"]) : null,
            createdAt: new Date(),
        };
        if (!mutesCollection) {
            return (0, response_1.sendError)(res, "Mute collection not initialized");
        }
        const existingDocument = await mutesCollection.findOne({});
        if (!existingDocument) {
            await mutesCollection.insertOne({ mutes: [] });
        }
        const result = await mutesCollection.updateOne({ "mutes.login": login }, { $set: { "mutes.$": muteRecord } }, { upsert: false });
        if (result.matchedCount === 0) {
            await mutesCollection.updateOne({}, { $push: { mutes: muteRecord } }, { upsert: true });
        }
        return (0, response_1.sendSuccess)(res, { mute: muteRecord });
    }
    catch (err) {
        console.error("Error creating mute:", err);
        return (0, response_1.sendError)(res, "Failed to create mute");
    }
});
router.get("/player/saves/:login", async (req, res) => {
    try {
        const { login } = req.params;
        if (!login || typeof login !== "string") {
            return (0, response_1.sendError)(res, "Missing or invalid login parameter");
        }
        const save = await db_1.Save.findOne({ login }).lean();
        if (!save || !save.profile) {
            return (0, response_1.sendError)(res, "Save not found for the specified login");
        }
        return (0, response_1.sendSuccess)(res, { profile: save.profile });
    }
    catch (err) {
        console.error("Error fetching player save:", err);
        return (0, response_1.sendError)(res, "Failed to fetch player save");
    }
});
exports.default = router;
