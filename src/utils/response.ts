// src/utils/response.ts
import { Response } from "express";

export function sendSuccess(res: Response, data: any): void {
  // console.log({ result: 1, data })
  res.json({ result: 1, data });
}

export function sendError(res: Response, error: string, code = 0): void {
  res.json({ result: code, data: { error } });
}
