// src/routes/time.ts
import { Router, Request, Response } from "express";
import { sendSuccess } from "../utils/response";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  // UNIX timestamp в секундах
//   console.log(11111)
  sendSuccess(res, { serverTime: Math.floor(Date.now() / 1000) });
});

export default router;
