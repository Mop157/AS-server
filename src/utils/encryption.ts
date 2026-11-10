// src/utils/encryption.ts
import crypto from "crypto";
import { Buffer } from "buffer";
import { MASTER_ENCRYPTION_KEY } from "../config";

function getEncryptionKey(): Buffer {
  if (MASTER_ENCRYPTION_KEY.length !== 32) {
    throw new Error("MASTER_ENCRYPTION_KEY must resolve to a 32-byte AES key");
  }
  return MASTER_ENCRYPTION_KEY;
}

// Дешифрует Base64(AES-256-CBC). Если не удалось, бросает ошибку.
export function decryptBase64Aes256(data: string): string {
  // data ожидается Base64 строки: iv (16 байт) + ciphertext
  const raw = Buffer.from(data, "base64");
  if (raw.length <= 16) {
    throw new Error("Invalid data length for AES decryption");
  }
  const iv = raw.slice(0, 16);
  const cipherText = raw.slice(16);
  const decipher = crypto.createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);
  const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);
  return decrypted.toString("utf8");
}

// Обёртка: пытаемся дешифровать, если не получилось, возвращаем исходную строку (или бросаем?)
// Здесь возвращаем исходную, но логируем.
export function tryDecrypt(data: string): string {
  if (typeof data !== "string") return data;
  const s = data.trim();
  // Если кажется чистым JSON → не шифруем
  if (s.startsWith("{") || s.startsWith("[")) {
    // console.log("tryDecrypt: plain JSON, skipping decrypt:", s);
    return data;
  }
  // URL-safe -> обычный base64
  let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  let raw: Buffer;
  try {
    raw = Buffer.from(b64, "base64");
  } catch (e) {
    // console.log("tryDecrypt: base64.decode failed, return raw:", e);
    return data;
  }
  // console.log("tryDecrypt: decoded base64, length=", raw.length, "hex=", raw.toString("hex"));
  if (raw.length <= 16) {
    // console.log("tryDecrypt: raw length ≤16, cannot contain IV+cipher, return raw");
    return data;
  }
  try {
    const iv = raw.slice(0, 16);
    const cipherText = raw.slice(16);
    // console.log("tryDecrypt: IV hex:", iv.toString("hex"), "cipherText len:", cipherText.length);
    // Ключ UTF-8, длина должна быть 32 байта. Если ключ короче, дополняйте нулями:
    const keyBuf = getEncryptionKey();
    // console.log("tryDecrypt: using keyBuf hex:", keyBuf.toString("hex"));
    const decipher = crypto.createDecipheriv("aes-256-cbc", keyBuf, iv);
    let decBuf = Buffer.concat([decipher.update(cipherText), decipher.final()]);
    // console.log("tryDecrypt: decrypted raw buf hex:", decBuf.toString("hex"));
    // Убираем PKCS7-паддинг
    const padLen = decBuf[decBuf.length - 1];
    if (padLen > 0 && padLen <= 16 && decBuf.slice(-padLen).every(b => b === padLen)) {
      decBuf = decBuf.slice(0, decBuf.length - padLen);
      // console.log("tryDecrypt: after unpad hex:", decBuf.toString("hex"));
    } else {
      // console.log("tryDecrypt: padding seems invalid or absent, padLen=", padLen);
    }
    const decStr = decBuf.toString("utf8");
    // console.log("tryDecrypt: final decrypted string:", decStr);
    return decStr;
  } catch (e) {
    // console.log("tryDecrypt: decrypt error, return raw:", e);
    return data;
  }
}

// Дешифровка: вход — Base64(URL-safe) строки вида IV||ciphertext
export function decryptFromClient(data: string): string {
  // исправляем URL-safe и добавляем padding до кратности 4
  let b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";

  const buf = Buffer.from(b64, "base64");
  if (buf.length < 17) {
    throw new Error("Invalid encrypted payload");
  }
  const iv = buf.slice(0, 16);
  const cipherText = buf.slice(16);

  const decipher = crypto.createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);
  const decryptedBuf = Buffer.concat([decipher.update(cipherText), decipher.final()]);
  return decryptedBuf.toString("utf8");
}

// Шифрование ответа: JSON → AES-256-CBC(рандомный IV) → Base64 URL-safe
export function encryptForClient(obj: any): string {
  const json = JSON.stringify(obj);
  const keyBuf = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const out = Buffer.concat([iv, encrypted]).toString("base64");
  return out.replace(/\+/g, "-").replace(/\//g, "_");
}