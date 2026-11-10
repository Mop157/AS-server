"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const response_1 = require("../utils/response");
const db_1 = require("../db");
const router = (0, express_1.Router)();
router.post("/ban", async (req, res) => {
    try {
        const { login, text, device_id } = req.body;
        // login нормализация
        const login_user = typeof login === "string" ? login : "u" + String(login);
        const minutes = null; // time == null ? null : Number(time);
        const expiresAt = minutes ? new Date(Date.now() + minutes * 60000) : null;
        // ищем пользователя
        const u = await db_1.User.findOne({ "account.accountUid": login_user, "account.platformUid": device_id }).lean();
        const banRecord = {
            login: login_user,
            ip: "unknown",
            platformUid: device_id || null,
            reason: String(text),
            durationMinutes: null,
            expiresAt,
            ban_Id: true,
            all: false,
            createdBy: req.headers["x-admin"]
                ? String(req.headers["x-admin"])
                : null,
            createdAt: new Date()
        };
        if (!db_1.bansCollection) {
            return (0, response_1.sendError)(res, "Ban collection not initialized");
        }
        // гарантируем структуру { bans: [] }
        const existingDocument = await db_1.bansCollection.findOne({});
        if (!existingDocument) {
            console.log("Initializing bans collection with empty bans array");
            await db_1.bansCollection.insertOne({ bans: [] });
        }
        // пробуем обновить существующий бан
        const result = await db_1.bansCollection.updateOne({ "bans.login": login }, { $set: { "bans.$": banRecord } }, { upsert: false });
        // если не нашли — пушим новый
        if (result.matchedCount === 0) {
            await db_1.bansCollection.updateOne({}, { $push: { bans: banRecord } }, { upsert: true });
        }
        // await deleteGiftBySenderLogin.deleteGiftBySenderLogin(login);
        // удаляем подарки
        // await dekete_gift(login);
        return (0, response_1.sendSuccess)(res, { ban: banRecord });
    }
    catch (err) {
        console.error("Error creating ban:", err);
        return (0, response_1.sendError)(res, "Failed to create ban");
    }
});
exports.default = router;
