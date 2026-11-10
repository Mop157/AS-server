// src/routes/purchase.ts
import { Router, Request, Response } from "express";
import { tryDecrypt } from "../utils/encryption";
import { sendSuccess, sendError } from "../utils/response";

const router = Router();

interface PurchasePayload {
  purchaseId: string;
  receipt: string;
}

router.post("/validate", (req: Request, res: Response) => {
  const enc: string = req.body.data;
  if (!enc) return sendError(res, "Missing 'data'");
  let jsonStr: string;
  try {
    jsonStr = tryDecrypt(enc);
  } catch {
    return sendError(res, "Decryption failed");
  }
  let payload: PurchasePayload;
  try {
    payload = JSON.parse(jsonStr);
  } catch {
    return sendError(res, "Invalid JSON");
  }
  const { purchaseId, receipt } = payload;
  if (!purchaseId || !receipt) {
    return sendError(res, "Missing purchaseId or receipt");
  }

  // TODO: верифицировать покупку через платёжный провайдер
  // Если валидно:
  sendSuccess(res, { purchaseValid: true, purchaseId });
  // Иначе sendError(res, "Invalid purchase", someCode);
});

export default router;
