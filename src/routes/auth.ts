// src/routes/auth.ts CoinLog
import { Router, Request, Response, } from "express";
import { decryptFromClient, encryptForClient, tryDecrypt } from "../utils/encryption";
import { sendSuccess, sendError } from "../utils/response";
import { Save, User } from "../db";
import { logGeneral } from "../utils/logger";
import { isBanned } from "../utils/bans";

const router = Router();

// Типы payload'ов можно описать интерфейсами:
interface AuthSavePayload {
  user_id: string;
  account_uid: string;
  name: string;
}
interface AuthLoadPayload {
  device_uid: string;
  account_uid: string;
  user_id: string;
}
interface AuthNamePayload {
  user_id: string;
  account_uid: string;
  name: string;
}

function parseEncryptedJson<T>(req: Request, res: Response): T | null {
  const enc = req.body?.data;
  if (!enc || typeof enc !== "string") {
    sendError(res, "Missing or invalid 'data'");
    return null;
  }
  // tryDecrypt внутри не бросит, а вернёт raw или decrypted
  const jsonStr = tryDecrypt(enc);
  let payload: T;
  try {
    // console.log(jsonStr)
    payload = JSON.parse(jsonStr);
  } catch {
    sendError(res, "Invalid JSON after decrypt");
    return null;
  }
  // console.log(payload)
  return payload;
}

/**
 * Шифрует объект: JSON.stringify(obj) → AES-256-CBC с рандомным IV → Buffer(IV||ciphertext) → Base64 URL-safe telegram
 */

router.post("/login", async (req: Request, res: Response) => {
  const { nickname, login, password } = req.body;
  if (!nickname ||  !login || !password) {
      // console.log(req.body)
      res.status(400).json({ error: "незаполнено какое-то поле" });
      return;
  }
  try {
      const user: any = await User.findOne({ "account.password": password, "account.userName": nickname, "account.accountUid": login })
      if (user) {
        user.account.loadSave = true;
        await user.save();
        const save = await Save.findOne({ "login": user.account.accountUid });
        const profile = save?.profile;
        const saveData = typeof profile === "object" && profile !== null && "data" in profile
          ? profile.data
          : undefined;
        await logGeneral(user.account.accountUid, "logs", `вошел в систему через /auth/login`, { ip: req.ip, userAgent: req.headers["user-agent"] });
        res.json({ accountUid: user.account.accountUid, userName: user.account.userName, data: saveData || '{"data1": {}, "data2": {}, "data3": {}, "profile": {} }'});
      }
  } catch (err) {
    // console.log(err)
    res.status(500).json({ error: true, text: "ошибка 500, что-то случилось" });
  }
});

router.post("/register", async (req: Request, res: Response) => {
  
  // console.log(req.body)
    const { nickname, telegram, password, user } = req.body;
    if (!nickname ||  !telegram || !password || !user) {
      res.status(400).json({ success: false });
      return;
    }
    // const banData = await Ban.findOne().lean()
    // if (banData) {
    //   if ((Array.isArray(banData.ID) && banData.ID.includes(token)) || (Array.isArray(banData.IP) && banData.IP.includes(req.ip))) {
    //     res.status(501).json({ error: true, text: "вы в бане по айпи" });
    //     return;
    // }
    // }
    let login: string;
    const telegramID = await User.findOne({
      $or: [
        { "account.telegram": telegram },
        { "account.userName": nickname }
      ]
    }).lean();
    if (telegramID) return res.status(200).json({ success: false, message: "- Вы уже зарегистрировали аккаунт в системе. или введений ник уже существует"  });
    while (true) {
      const randomNum = Math.floor(Math.random() * 10000000);
      login = "u" + randomNum;
      const existing = await User.findOne({ "account.accountUid": login, "account.userName": nickname }).lean();
      if (!existing) break;
    }
    const newAccount = { accountUid: login, userName: nickname, password, platformUid: "null", telegram, tg_username: user };
    const newUser = new User({ account: newAccount });
    try {
      await newUser.save();
      await logGeneral(login, "logs", `зарегистрировался в системе через /auth/register`, { ip: req.ip, userAgent: req.headers["user-agent"] });
      res.json({newAccount, success: true});
    } catch (err) {
      res.status(500).json({ success: false });
    }
});

// Пример: изменяем роут auth/save_2.0 так, чтобы шифровать ответ
router.post("/save_2.0", async (req: Request, res: Response) => {
  // console.log(req.body)
  // sendSuccess(res, {
  //   user_id: "YOUR_USER_ID",
  //   status: "success"
  // });
  const enc = req.body?.data;
  if (!enc) return res.json({ result: 0, data: { error: "Missing 'data'" } });

  let jsonStr: string;
  try {
    jsonStr = decryptFromClient(enc);
  } catch (e) {
    // console.error("decrypt save_2.0 failed:", e);
    return res.json({ result: 0, data: { error: "Decryption failed" } });
  }
  // console.log("Decrypted save_2.0 payload:", jsonStr);
  let payload: any;
  try {
    payload = JSON.parse('{"device_uid_list":[' + jsonStr);
  } catch (e) {
    try {
      payload = JSON.parse('{"login":"' + jsonStr);
    } catch (e) {
      // console.error("parse save_2.0 failed:", e);
      return res.json({ result: 0, data: { error: "Invalid JSON" } });
    }
  }
  console.log(payload)
  // Поддерживаем несколько вариантов: payload.device_uid или payload.data[0]
  const account_uid: string | undefined = payload.account_uid ?? payload.accountUid ?? payload.account?.account_uid ?? payload.login;
  const device_uid = payload.device_uid ?? (Array.isArray(payload.data) && payload.data.length ? payload.data[0] : undefined);
  if (!account_uid && !device_uid) {
    // console.log("Missing account_uid and device_uid in payload:", payload);
    return res.json({ result: 0, data: { error: "Missing account_uid" } });
  }
  // console.log("Saving for account_uid:", account_uid, "device_uid:", device_uid);
  const { banned, ban } = await isBanned({ login: account_uid, platformUid: device_uid });
  if (banned) {
    // console.log(`Banned user ${account_uid} attempted to save:`, ban);
    res.json({ result: 0, data: { error: `User is banned: ${ban?.reason || "no reason"}` } });
    return;
  }

  let user = await Save.findOne({ login: account_uid });
  // console.log(account_uid, user)
  if (!user) {
    // console.log("No existing save found for", account_uid);
    // Если нет — создаём новый
    user = new Save({
      login: account_uid,
      profile: payload,
      profile_decryp: req.body?.data
    });
    await user.save();
    logGeneral(
      account_uid!,
      "save_game",
      "Создан новый профиль и сохранён",
      { ip: req.ip, userAgent: req.headers["user-agent"] }
    );
    sendSuccess(res, {
     user_id: account_uid!,
     status: "success"
   });
    return;
  }
  // console.log(payload)
  if (payload.login) {
    // console.log(payload)
    // console.log(12121212121212121212121212121212121212121212121212121212121212121212121212121212);
    user.profile = payload;
    user.profile_decryp = req.body?.data
    await user.save();
    logGeneral(
      account_uid!,
      "save_game",
      "Обновление сохранения профиля",
      { ip: req.ip, userAgent: req.headers["user-agent"] }
    );
    // console.log("Сохранение обновлено для", account_uid);
    const respObj = { result: 1, data: {
   user_id: true,
   status: "success"
 } };
    const encrypted = encryptForClient(respObj);
    return res.status(200).json(encrypted);
  } else {
    const respObj = { result: 1, data: {
   user_id: true,
   status: "success"
 } };
    const encrypted = encryptForClient(respObj);
    // console.log("222222222222222222Сохранение обновлено для", account_uid);
    return res.status(200).json(encrypted);
  }
  // console.log("222222222222222222Сохранение обновлено для666666666666666666666666666666666", account_uid);

//   const respObj = { result: 1, data: {
//   user_id: 12122,
//   status: "success"
// } };
//   const encrypted = encryptForClient(respObj);
//   // await logGeneral(account_uid, "save_game", `сохранение игры`, { ip: req.ip, userAgent: req.headers["user-agent"] });
//   return res.send(encrypted);
});

router.post("/load_2.0", async (req: Request, res: Response) => {
  // console.log(req.body)
  const enc = req.body.data;
  if (!enc) {
    return res.json({ result: 0, data: { error: "Missing 'data'" } });
  }
  let jsonStr: string;
  try {
    jsonStr = decryptFromClient(enc);
  } catch (e) {
    console.error("decrypt load_2.0 failed:", e);
    return res.json({ result: 0, data: { error: "Decryption failed" } });
  }
  // console.log("Decrypted load_2.0 payload:", jsonStr);
  let payload: any;
  try {
    payload = JSON.parse('{"login":"' + jsonStr);
  } catch (e) {
    try {
      payload = JSON.parse('{"login":"' + jsonStr);
    } catch (e) {
      // console.error("parse save_2.0 failed:", e);
      return res.json({ result: 0, data: { error: "Invalid JSON" } });
    }
  }
  // console.log(payload)
  const { login } = payload
  try {
    const save = await Save.findOne({ "login": login });
    const user: any = await User.findOne({ "account.accountUid": login });
    if (!save) {
      logGeneral(login, "save_game", "Загруза не прошла успешно, пользователь не найден", { ip: req.ip, userAgent: req.headers["user-agent"] });
      res.send("no");
      return;
    }
    if (user && user.account.loadSave === true) {
      user.account.loadSave = false;
      await user.save();
      // console.log(11111111111111111112222222)
      logGeneral(login, "save_game", "Загрузил сохранение с сервера (активное)", { ip: req.ip, userAgent: req.headers["user-agent"] });
      const profile = save.profile;
      const saveData = typeof profile === "object" && profile !== null && "data" in profile
        ? profile.data
        : undefined;
      sendSuccess(res, saveData || {});
      // sendSuccess(res, (save && save.profile_decryp) ? save.profile_decryp : "no");
    } else {
      logGeneral(login, "save_game", "сервер доступный для сохранения", { ip: req.ip, userAgent: req.headers["user-agent"] });
      sendSuccess(res, {data: "no"});
    }
  } catch (err) {
    logGeneral(login, "save_game", "Загрузил не прошла успешно!!!", { ip: req.ip, userAgent: req.headers["user-agent"] });
    res.status(500).json({ error: "Server error" });
  }


  // // ... TODO: загрузить из БД ...
  // const respObj = {
  //   result: 1,
  //   data: {
  //     user_id: "YOUR_USER_ID",
  //     status: "success"
  //   }
  // };
  // const encrypted = encryptForClient(respObj);
  // console.log("respObj:", encrypted);
  // // res.send(ok);
  // await logGeneral(account_uid, "save_game", `загрузка игры из облака`, { ip: req.ip, userAgent: req.headers["user-agent"] });
  // sendSuccess(res, encrypted);
});

router.post("/name_2.0", async (req: Request, res: Response) => {
  const payload = parseEncryptedJson<AuthNamePayload>(req, res);
  if (!payload) return;
  const { user_id, account_uid, name } = payload;
  if (!user_id || !account_uid || !name) {
    return sendError(res, "Missing required fields");
  }
  const existing = await User.findOne({ "account.accountUid": user_id })
  if (!existing) return
  existing.account.userName = name
  try {
    await existing.save();
  } catch (err) {
    // console.log(err)
  }
  // TODO: обновить имя в БД
  await logGeneral(account_uid, "name", `изменил имя на ${name} через /auth/name_2.0`, { ip: req.ip, userAgent: req.headers["user-agent"] });
  sendSuccess(res, { name_updated: true, name });
});

export default router;
