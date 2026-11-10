// src/routes/search.ts
import { Router, Request, Response } from "express";
import { sendSuccess, sendError } from "../utils/response";

const router = Router();

// В простом варианте PIN проверяем жестко "1234". 
// В реальном мире: искать в БД, проверять соответствие userId -> сохранённому PIN.
function isAuthorized(pin: string): boolean {
  return pin === "1234";
}

router.get("/security/retrive/:userId/:pin", (req: Request, res: Response) => {
  const { userId, pin } = req.params;
  if (!userId || !pin) return sendError(res, "Missing params");
  if (!isAuthorized(pin)) return sendError(res, "Invalid PIN");
  sendSuccess(res, { valid: true });
});

router.get("/search/id/:userId/:pin", (req: Request, res: Response) => {
  const { userId, pin } = req.params;
  if (!isAuthorized(pin)) return sendError(res, "Unauthorized");
  // TODO: найти в БД по userId
  sendSuccess(res, { user_id: userId, name: `Player_${userId}`, level: 10 });
});

router.get("/search/account/:accountUid/:pin", (req: Request, res: Response) => {
  const { accountUid, pin } = req.params;
  if (!isAuthorized(pin)) return sendError(res, "Unauthorized");
  // TODO: найти по accountUid
  sendSuccess(res, { account_uid: accountUid, user_id: "555", name: "AcctUser" });
});

router.get("/search/device/:deviceUid/:pin", (req: Request, res: Response) => {
  const { deviceUid, pin } = req.params;
  if (!isAuthorized(pin)) return sendError(res, "Unauthorized");
  // TODO: найти по deviceUid
  sendSuccess(res, { device_uid: deviceUid, user_id: "666", name: "DeviceUser" });
});

router.get("/search/name/:name/:pin", (req: Request, res: Response) => {
  let { name, pin } = req.params;
  if (!isAuthorized(pin)) return sendError(res, "Unauthorized");
  // name уже декодирован Express
  // TODO: поиск по имени (частичное совпадение) в БД, пагинация и т.д.
  sendSuccess(res, {
    results: [
      { user_id: "101", name: `${name}_A`, level: 5 },
      { user_id: "102", name: `${name}_B`, level: 7 },
    ],
  });
});

export default router;
