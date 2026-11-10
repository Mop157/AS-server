import { Router, Request, Response } from "express";
import { sendSuccess, sendError } from "../utils/response";
import { User, bansCollection } from "../db";

const router = Router();

router.post("/ban", async (req: Request, res: Response) => {
    try {
        const { login, text, device_id } = req.body;

        // login нормализация
        const login_user: string =
            typeof login === "string" ? login : "u" + String(login);

        const minutes: number | null = null// time == null ? null : Number(time);
        const expiresAt: Date | null =
            minutes ? new Date(Date.now() + minutes * 60000) : null;

        // ищем пользователя
        const u = await User.findOne({ "account.accountUid": login_user, "account.platformUid": device_id }).lean();

        const banRecord = {
            login: login_user,
            ip:  "unknown", 
            platformUid: device_id || null,
            reason: String(text),
            durationMinutes: null,// minutes,
            expiresAt,
            ban_Id: true,
            all: false,
            createdBy: req.headers["x-admin"]
                ? String(req.headers["x-admin"])
                : null,
            createdAt: new Date()
        };

        if (!bansCollection) {
            return sendError(res, "Ban collection not initialized");
        }

        // гарантируем структуру { bans: [] }
        const existingDocument = await bansCollection.findOne({});
        if (!existingDocument) {
            console.log("Initializing bans collection with empty bans array");
            await bansCollection.insertOne({ bans: [] });
        }

        // пробуем обновить существующий бан
        const result = await bansCollection.updateOne(
            { "bans.login": login },
            { $set: { "bans.$": banRecord } },
            { upsert: false }
        );

        // если не нашли — пушим новый
        if (result.matchedCount === 0) {
            await bansCollection.updateOne(
                {},
                { $push: { bans: banRecord } },
                { upsert: true }
            );
        }
        // await deleteGiftBySenderLogin.deleteGiftBySenderLogin(login);
        // удаляем подарки
        // await dekete_gift(login);

        return sendSuccess(res, { ban: banRecord });
    } catch (err) {
        console.error("Error creating ban:", err);
        return sendError(res, "Failed to create ban");
    }
});


export default router;