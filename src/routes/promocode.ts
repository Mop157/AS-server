// src/routes/promocode.ts
import { Router, Request, Response } from "express";
import { tryDecrypt } from "../utils/encryption";
import { sendSuccess, sendError } from "../utils/response";

const router = Router();

interface PromoPayload {
  code: string;
}

router.post("/", (req: Request, res: Response) => {
  const enc: string = req.body.data;
  if (!enc) return sendError(res, "Missing 'data'");
  let jsonStr: string;
  try {
    jsonStr = tryDecrypt(enc);
  } catch {
    return sendError(res, "Decryption failed");
  }
  let payload: PromoPayload;
  try {
    payload = JSON.parse(jsonStr);
  } catch {
    return sendError(res, "Invalid JSON");
  }
  const { code } = payload;
  if (!code) return sendError(res, "Missing code");

  // TODO: проверка кода в БД
  if (code === "FREE100") {
    sendSuccess(res, { applied: true, bonus: 100 });
  } else {
    sendError(res, "Invalid promo code");
  }
});

export default router;
