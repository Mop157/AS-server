"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptForClient = exports.decryptFromClient = exports.tryDecrypt = exports.decryptBase64Aes256 = void 0;
// src/utils/encryption.ts
const crypto_1 = __importDefault(require("crypto"));
const buffer_1 = require("buffer");
const config_1 = require("../config");
function getEncryptionKey() {
    if (config_1.MASTER_ENCRYPTION_KEY.length !== 32) {
        throw new Error("MASTER_ENCRYPTION_KEY must resolve to a 32-byte AES key");
    }
    return config_1.MASTER_ENCRYPTION_KEY;
}
// Дешифрует Base64(AES-256-CBC). Если не удалось, бросает ошибку.
function decryptBase64Aes256(data) {
    // data ожидается Base64 строки: iv (16 байт) + ciphertext
    const raw = buffer_1.Buffer.from(data, "base64");
    if (raw.length <= 16) {
        throw new Error("Invalid data length for AES decryption");
    }
    const iv = raw.slice(0, 16);
    const cipherText = raw.slice(16);
    const decipher = crypto_1.default.createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);
    const decrypted = buffer_1.Buffer.concat([decipher.update(cipherText), decipher.final()]);
    return decrypted.toString("utf8");
}
exports.decryptBase64Aes256 = decryptBase64Aes256;
// Обёртка: пытаемся дешифровать, если не получилось, возвращаем исходную строку (или бросаем?)
// Здесь возвращаем исходную, но логируем.
function tryDecrypt(data) {
    if (typeof data !== "string")
        return data;
    const s = data.trim();
    // Если кажется чистым JSON → не шифруем
    if (s.startsWith("{") || s.startsWith("[")) {
        // console.log("tryDecrypt: plain JSON, skipping decrypt:", s);
        return data;
    }
    // URL-safe -> обычный base64
    let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0)
        b64 += "=";
    let raw;
    try {
        raw = buffer_1.Buffer.from(b64, "base64");
    }
    catch (e) {
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
        const decipher = crypto_1.default.createDecipheriv("aes-256-cbc", keyBuf, iv);
        let decBuf = buffer_1.Buffer.concat([decipher.update(cipherText), decipher.final()]);
        // console.log("tryDecrypt: decrypted raw buf hex:", decBuf.toString("hex"));
        // Убираем PKCS7-паддинг
        const padLen = decBuf[decBuf.length - 1];
        if (padLen > 0 && padLen <= 16 && decBuf.slice(-padLen).every(b => b === padLen)) {
            decBuf = decBuf.slice(0, decBuf.length - padLen);
            // console.log("tryDecrypt: after unpad hex:", decBuf.toString("hex"));
        }
        else {
            // console.log("tryDecrypt: padding seems invalid or absent, padLen=", padLen);
        }
        const decStr = decBuf.toString("utf8");
        // console.log("tryDecrypt: final decrypted string:", decStr);
        return decStr;
    }
    catch (e) {
        // console.log("tryDecrypt: decrypt error, return raw:", e);
        return data;
    }
}
exports.tryDecrypt = tryDecrypt;
// Дешифровка: вход — Base64(URL-safe) строки вида IV||ciphertext
function decryptFromClient(data) {
    // исправляем URL-safe и добавляем padding до кратности 4
    let b64 = data.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0)
        b64 += "=";
    const buf = buffer_1.Buffer.from(b64, "base64");
    if (buf.length < 17) {
        throw new Error("Invalid encrypted payload");
    }
    const iv = buf.slice(0, 16);
    const cipherText = buf.slice(16);
    const decipher = crypto_1.default.createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);
    const decryptedBuf = buffer_1.Buffer.concat([decipher.update(cipherText), decipher.final()]);
    return decryptedBuf.toString("utf8");
}
exports.decryptFromClient = decryptFromClient;
// Шифрование ответа: JSON → AES-256-CBC(рандомный IV) → Base64 URL-safe
function encryptForClient(obj) {
    const json = JSON.stringify(obj);
    const keyBuf = getEncryptionKey();
    const iv = crypto_1.default.randomBytes(16);
    const cipher = crypto_1.default.createCipheriv("aes-256-cbc", keyBuf, iv);
    const encrypted = buffer_1.Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
    const out = buffer_1.Buffer.concat([iv, encrypted]).toString("base64");
    return out.replace(/\+/g, "-").replace(/\//g, "_");
}
exports.encryptForClient = encryptForClient;
