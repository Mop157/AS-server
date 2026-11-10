import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { tryDecrypt } from "../utils/encryption";
import { sendError, sendSuccess } from "../utils/response";
import { GiftParcel, Player, Save, ServerEvent, User, UserGift, type BanCollectionDocument } from "../db";

const router = Router();

async function startbb(): Promise<void> {
  const event = await ServerEvent.findOne();
  if (!event) {
    const newEvent = new ServerEvent();
    await newEvent.save();
  }
}
void startbb();

type BanRecord = {
  login: string | null;
  platformUid: string | null;
  ip: string | null;
  reason: string;
  durationMinutes: number | null;
  expiresAt: Date | null;
  ban_Id?: boolean;
  all?: boolean;
  createdBy: string | null;
  createdAt: Date;
};

type MuteRecord = {
  login: string;
  platformUid: string | null;
  reason: string;
  durationMinutes: number | null;
  expiresAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
};

type GiftFilterType = "all" | "current" | "sent" | "received" | "deleted" | string;

type GiftParcelLean = {
  status?: string;
  sentAt?: Date;
  giftId?: string;
  senderLogin?: string;
  senderName?: string | null;
  receiverLogin?: string;
  receiverName?: string | null;
  [key: string]: unknown;
};

let bansCollection: mongoose.mongo.Collection<BanCollectionDocument> | null = null;
let mutesCollection: mongoose.mongo.Collection | null = null;
let giftParcelsCollection: mongoose.mongo.Collection | null = null;

export function setBansCollection(collection: mongoose.mongo.Collection<BanCollectionDocument> | null): void {
  bansCollection = collection;
}

export function setMutesCollection(collection: mongoose.mongo.Collection | null): void {
  mutesCollection = collection;
}

export function setGiftParcelsCollection(collection: mongoose.mongo.Collection | null): void {
  giftParcelsCollection = collection;
}

function toDateSafe(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

async function resolveUserByLoginOrName(
  login: string | null,
  name: string | null
): Promise<{ login: string | null; name: string | null; user: any } | null> {
  if (login) {
    const user = await User.findOne({ "account.accountUid": String(login) }).lean();
    if (!user) return null;
    return {
      login: String(login),
      name: user?.account?.userName || null,
      user,
    };
  }

  if (name) {
    const user = await User.findOne({ "account.userName": String(name) }).lean();
    if (!user) return null;
    return {
      login: user?.account?.accountUid || null,
      name: String(name),
      user,
    };
  }

  return null;
}

function buildGiftQuery(params: {
  type: GiftFilterType;
  login: string | null;
  name: string | null;
  giftId: unknown;
  from: unknown;
  to: unknown;
}): Record<string, unknown> {
  const q: Record<string, unknown> = {};

  if (params.type && params.type !== "all") {
    q.status = String(params.type);
  }

  if (params.giftId != null && params.giftId !== "") {
    q.giftId = String(params.giftId);
  }

  if (params.login || params.name) {
    const or: Record<string, unknown>[] = [];
    if (params.login) {
      or.push(
        { senderLogin: String(params.login) },
        { receiverLogin: String(params.login) },
        { deletedBy: String(params.login) }
      );
    }
    if (params.name) {
      or.push({ senderName: String(params.name) }, { receiverName: String(params.name) });
    }
    if (or.length) q.$or = or;
  }

  const start = toDateSafe(params.from);
  const end = toDateSafe(params.to);

  if (start || end) {
    q.sentAt = {} as Record<string, Date>;
    if (start) (q.sentAt as Record<string, Date>).$gte = start;
    if (end) (q.sentAt as Record<string, Date>).$lte = end;
  }

  return q;
}

function groupGifts(items: GiftParcelLean[]) {
  return {
    current: items.filter((x) => x.status === "current"),
    sent: items.filter((x) => x.status === "sent"),
    received: items.filter((x) => x.status === "received"),
    deleted: items.filter((x) => x.status === "deleted"),
  };
}

async function deleteGiftBySenderLogin(login: string | null): Promise<void> {
  try {
    if (!login) return;

    const uid = String(login);
    const user = await User.findOne({ "account.accountUid": uid }).lean();
    if (!user || !user.account) return;

    const senderName = String(user.account.userName || "").trim();
    if (!senderName) return;

    const logsCollection = mongoose.connection.db?.collection("logs") ?? null;
    if (!logsCollection) return;

    const logs = await logsCollection.findOne({ login: uid });
    if (!logs || !(logs as any).gift || (logs as any).gift.length === 0) return;

    const receivers = new Set<string>();
    for (const entry of (logs as any).gift) {
      if (!entry?.message) continue;
      const match = String(entry.message).match(/пользователь отправил подарок (u\d+)/i);
      if (match) receivers.add(match[1]);
    }

    if (receivers.size === 0) return;

    for (const taker of receivers) {
      const doc = await UserGift.findOne({ taker });
      if (!doc || !doc.gifts) continue;

      const giftIdsToDelete = doc.gifts
        .filter((g: any) => String(g.senderName || "").trim() === senderName)
        .map((g: any) => g.giftId);

      if (giftIdsToDelete.length === 0) continue;

      await UserGift.updateOne(
        { taker },
        {
          $pull: {
            gifts: { senderName },
          },
        }
      );

      await UserGift.updateOne(
        { taker },
        {
          $pull: {
            store: { giftId: { $in: giftIdsToDelete } },
          },
        }
      );
    }
  } catch (err) {
    console.error("deleteGiftBySenderLogin error:", err);
  }
}

router.post("/gift_info", async (req: Request, res: Response) => {
  try {
    const { login, name } = req.body as { login?: string; name?: string };

    if (!login && !name) {
      return sendError(res, "Укажите 'login' или 'name' в теле запроса");
    }

    let giftInfo: any = null;

    if (login) {
      giftInfo = await UserGift.findOne({ taker: String(login) }).lean();
    }

    if (name && !giftInfo) {
      const users = await User.findOne({ "account.userName": String(name) }).lean();
      if (users?.account?.accountUid) {
        giftInfo = await UserGift.findOne({ taker: String(users.account.accountUid) }).lean();
      }
    }

    if (!giftInfo) {
      return sendError(res, "Информация о подарках не найдена для указанного login/name");
    }

    return sendSuccess(res, { giftInfo });
  } catch (err) {
    console.error("/gift_info error:", err);
    return sendError(res, "Не удалось получить информацию о подарках");
  }
});

router.get("/gifts", async (req: Request, res: Response) => {
  try {
    const {
      type = "all",
      login = null,
      name = null,
      giftId = null,
      from = null,
      to = null,
      limit = 50,
      skip = 0,
    } = req.query as Record<string, string | null | undefined>;

    const resolved = await resolveUserByLoginOrName(login ? String(login) : null, name ? String(name) : null);

    const query = buildGiftQuery({
      type: String(type) as GiftFilterType,
      login: resolved?.login || (login ? String(login) : null),
      name: resolved?.name || (name ? String(name) : null),
      giftId,
      from,
      to,
    });

    const lim = clampNumber(limit, 1, 1000, 50);
    const sk = clampNumber(skip, 0, 10000000, 0);

    const items = (await GiftParcel.find(query).sort({ sentAt: -1, _id: -1 }).skip(sk).limit(lim).lean()) as GiftParcelLean[];

    if (String(type) === "all") {
      return sendSuccess(res, {
        items: groupGifts(items),
        total: items.length,
      });
    }

    return sendSuccess(res, {
      items,
      total: items.length,
    });
  } catch (err) {
    console.error("/gifts error:", err);
    return sendError(res, "Не удалось получить список посылок");
  }
});

router.get("/gifts/audit/:login", async (req: Request, res: Response) => {
  try {
    const login = String(req.params.login || "");
    if (!login) {
      return sendError(res, "Не указан login");
    }

    const { from = null, to = null, last = 100 } = req.query as Record<string, string | null | undefined>;
    const lim = clampNumber(last, 1, 1000, 100);

    const query = buildGiftQuery({
      type: "all",
      login,
      name: null,
      giftId: null,
      from,
      to,
    });

    const items = (await GiftParcel.find(query).sort({ sentAt: -1, _id: -1 }).limit(lim).lean()) as GiftParcelLean[];

    return sendSuccess(res, {
      login,
      last: lim,
      from: from || null,
      to: to || null,
      audit: groupGifts(items),
    });
  } catch (err) {
    console.error("/gifts/audit error:", err);
    return sendError(res, "Не удалось получить аудит посылок");
  }
});

router.post("/gifts/delete", async (req: Request, res: Response) => {
  try {
    const id = req.body?.id || (req.params as any)?.id;
    if (!id) {
      return sendError(res, "Не указан id посылки");
    }

    const reason = String(req.body?.reason || req.query?.reason || "Удалено модерацией");
    const admin = String(req.headers["x-admin"] || "moderator");
    const now = new Date();

    if (Number.isNaN(Number(id))) {
      return sendError(res, "giftId должен быть числом.");
    }

    const result = await UserGift.updateOne(
      {
        $or: [{ "gifts.giftId": id }, { "store.giftId": id }],
      },
      {
        $pull: {
          gifts: { giftId: id },
          store: { giftId: id },
        },
      }
    );

    if (result.modifiedCount === 0) {
      return sendError(res, "Подарок не найден.");
    }

    await GiftParcel.updateOne(
      { giftId: String(id) },
      {
        $set: {
          status: "deleted",
          deletedAt: now,
          deletedBy: admin,
          deleteReason: reason,
          updatedAt: now,
        },
      }
    );

    return sendSuccess(res, `Подарок ${id} удалён у пользователей и помечен как удалённый.`);
  } catch (err) {
    console.error("/delete_gift error:", err);
    return sendError(res, "Ошибка при удалении подарка.");
  }
});

router.post("/gift_send", async (req: Request, res: Response) => {
  try {
    const { receiverLogin, giftData } = req.body as { receiverLogin?: string; giftData?: unknown };

    if (!receiverLogin || !giftData) {
      return sendError(res, "receiverLogin и giftData обязательны");
    }

    const giftId = Date.now() + Math.floor(Math.random() * 1000);
    const now = new Date();

    const receiver = await User.findOne({ "account.accountUid": String(receiverLogin) }).lean();
    const receiverName = receiver?.account?.userName || "null";

    let receiverGiftDoc = await UserGift.findOne({ taker: receiverLogin });
    if (!receiverGiftDoc) {
      receiverGiftDoc = new UserGift({ taker: receiverLogin, gifts: [], store: [] });
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

    await GiftParcel.create({
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

    return sendSuccess(res, {
      result: 1,
      message: "Подарок успешно отправлен",
    });
  } catch (err) {
    console.error("/gift_send error:", err);
    return sendError(res, "Ошибка при отправке подарка");
  }
});

router.get("/playerlist/action", async (req: Request, res: Response) => {
  try {
    const enc = (req.body as any)?.data;
    if (enc && typeof enc === "string") {
      try {
        void tryDecrypt(enc);
      } catch {
        // ignore decryption errors
      }
    }

    const players = await Player.find({}, { userId: 1, _id: 0 }).lean();
    const logins = players.map((p: any) => "u" + String(p.userId));

    const users = await User.find({ "account.accountUid": { $in: logins } }, { _id: 0, __v: 0 }).lean();
    const userMap = new Map<string, any>();
    for (const u of users as any[]) {
      if (u?.account?.accountUid) userMap.set(u.account.accountUid, u);
    }

    const result = players.map((p: any) => {
      const login = "u" + String(p.userId);
      if (userMap.has(login)) return userMap.get(login);
      return { [login]: "not found" };
    });

    return sendSuccess(res, { players: result });
  } catch (err) {
    console.error("playerlist/action error:", err);
    return sendError(res, "Failed to build player list");
  }
});

router.post("/version", async (req: Request, res: Response) => {
  try {
    const { version } = req.body as { version?: string };
    if (!version || typeof version !== "string") {
      return sendError(res, "Missing or invalid version");
    }

    await ServerEvent.updateOne({}, { $set: { version } }, { upsert: true });
    return sendSuccess(res, { version });
  } catch (err) {
    console.error("Error updating version:", err);
    return sendError(res, "Failed to update version");
  }
});

router.get("/version", async (_req: Request, res: Response) => {
  try {
    let version = "unknown";
    const event = await ServerEvent.findOne().lean();
    if (event?.version) {
      version = event.version;
    }
    return sendSuccess(res, { version });
  } catch (err) {
    console.error("Error updating version:", err);
    return sendError(res, "Failed to update version");
  }
});

router.post("/player/info", async (req: Request, res: Response) => {
  try {
    const { login, name, id } = req.body as { login?: string; name?: string; id?: string | number };
    let users: any;
    let version = "unknown";
    const event = await ServerEvent.findOne().lean();
    if (event?.version) {
      version = event.version;
    }

    if (id) {
      users = await User.findOne({ "account.telegram": id }).lean();
      sendSuccess(res, { user: users, version: version || "unknown" });
      return;
    }

    if (!login && !name) {
      return sendSuccess(res, { error: "указыте хотяби что-то" });
    }

    if (login) {
      users = await Player.findOne({ userId: String(login).replace(/^u/, "") }).lean();
    }
    if (name && !users) {
      users = await Player.findOne({ name }).lean();
    }
    if (login && !users) {
      users = await User.findOne({ "account.accountUid": login }).lean();
    }
    if (name && !users) {
      users = await User.findOne({ "account.userName": name }).lean();
    }

    sendSuccess(res, { user: users });
  } catch (err) {
    console.error("Error fetching users:", err);
    sendError(res, "Failed to fetch users");
  }
});

router.get("/playerlist/all", async (_req: Request, res: Response) => {
  try {
    const users = await User.find({}, { _id: 0, __v: 0 }).lean();
    sendSuccess(res, { users });
  } catch (err) {
    console.error("Error fetching users:", err);
    sendError(res, "Failed to fetch users");
  }
});

router.post("/player/ban", async (req: Request, res: Response) => {
  try {
    const { userid, text, time, ban_Id, all, platformUid, ip } = req.body as {
      userid?: string | number;
      text?: string;
      time?: number | string | null;
      ban_Id?: boolean;
      all?: boolean;
      platformUid?: string;
      ip?: string;
    };

    const login = typeof userid === "string" ? userid : "u" + String(userid);
    const minutes = time == null ? null : Number(time);
    const expiresAt = minutes ? new Date(Date.now() + minutes * 60000) : null;

    const u = await User.findOne({ "account.accountUid": login }).lean();
    const platformUidToStore = u?.account?.platformUid ?? platformUid ?? null;

    const banRecord: any = {
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
      return sendError(res, "Ban collection not initialized");
    }

    const existingDocument = await bansCollection.findOne({});
    if (!existingDocument) {
      console.log("Initializing bans collection with empty bans array");
      await bansCollection.insertOne({ bans: [] });
    }

    const result = await bansCollection.updateOne(
      { "bans.login": login },
      { $set: { "bans.$": banRecord } },
      { upsert: false }
    );

    if (result.matchedCount === 0) {
      await bansCollection.updateOne({}, { $push: { bans: banRecord } }, { upsert: true });
    }

    await deleteGiftBySenderLogin(login);

    return sendSuccess(res, { ban: banRecord });
  } catch (err) {
    console.error("Error creating ban:", err);
    return sendError(res, "Failed to create ban");
  }
});

router.post("/player/unban", async (req: Request, res: Response) => {
  try {
    const { userid } = req.body as { userid?: string | number };
    if (!userid) {
      return sendError(res, "userid is required");
    }

    const login: string = typeof userid === "string" ? userid : "u" + String(userid);

    if (!bansCollection) {
      return sendError(res, "Ban collection not initialized");
    }

    const existingDocument = await bansCollection.findOne({});
    if (!existingDocument) {
      console.log("Initializing bans collection with empty bans array");
      await bansCollection.insertOne({ bans: [] });
    }

    const result = await (bansCollection as any).updateOne({}, { $pull: { bans: { login } } });
    if (result.modifiedCount === 0) {
      return sendError(res, "Ban not found");
    }

    return sendSuccess(res, { unbanned: login });
  } catch (err) {
    console.error("Error removing ban:", err);
    return sendError(res, "Failed to remove ban");
  }
});

router.post("/player/mute", async (req: Request, res: Response) => {
  try {
    const { userid, text, time } = req.body as { userid?: string | number; text?: string; time?: number | string | null };
    if (!userid || !text) return sendError(res, "Missing required fields: userid or text");

    const login = typeof userid === "string" ? userid : "u" + String(userid);
    const minutes = time == null ? null : Number(time);
    const expiresAt = minutes ? new Date(Date.now() + minutes * 60000) : null;

    const u = await User.findOne({ "account.accountUid": login }).lean();
    const platformUidToStore = u?.account?.platformUid ?? null;

    const muteRecord: any = {
      login,
      platformUid: platformUidToStore,
      reason: String(text),
      durationMinutes: minutes,
      expiresAt,
      createdBy: req.headers["x-admin"] ? String(req.headers["x-admin"]) : null,
      createdAt: new Date(),
    };

    if (!mutesCollection) {
      return sendError(res, "Mute collection not initialized");
    }

    const existingDocument = await mutesCollection.findOne({});
    if (!existingDocument) {
      await mutesCollection.insertOne({ mutes: [] });
    }

    const result = await mutesCollection.updateOne({ "mutes.login": login }, { $set: { "mutes.$": muteRecord } }, { upsert: false });
    if (result.matchedCount === 0) {
      await mutesCollection.updateOne({}, { $push: { mutes: muteRecord } }, { upsert: true });
    }

    return sendSuccess(res, { mute: muteRecord });
  } catch (err) {
    console.error("Error creating mute:", err);
    return sendError(res, "Failed to create mute");
  }
});

router.get("/player/saves/:login", async (req: Request, res: Response) => {
  try {
    const { login } = req.params;
    if (!login || typeof login !== "string") {
      return sendError(res, "Missing or invalid login parameter");
    }

    const save = await Save.findOne({ login }).lean();
    if (!save || !save.profile) {
      return sendError(res, "Save not found for the specified login");
    }

    return sendSuccess(res, { profile: save.profile });
  } catch (err) {
    console.error("Error fetching player save:", err);
    return sendError(res, "Failed to fetch player save");
  }
});

export default router;
