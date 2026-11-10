// encryptionTest.ts
import crypto from "crypto";
import { MASTER_ENCRYPTION_KEY } from "./config";

function getKeyBytes(key: string | Buffer): Buffer {
  const keyBytes = Buffer.isBuffer(key)
    ? key
    : crypto.createHash("sha256").update(key, "utf8").digest();
  if (keyBytes.length !== 32) {
    throw new Error("The AES-256 key must resolve to 32 bytes");
  }
  return keyBytes;
}

/**
 * Шифрует строку plaintext с помощью AES-256-CBC.
 * Возвращает Base64: IV(16 байт) + ciphertext.
 */
export function encryptToBase64(plaintext: string, key: string | Buffer = MASTER_ENCRYPTION_KEY): string {
  const keyBuf = getKeyBytes(key);
  // Генерируем случайный IV 16 байт
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  // Возвращаем Base64(IV + ciphertext)
  return Buffer.concat([iv, encrypted]).toString("base64");
}

/**
 * Дешифрует Base64-строку, содержащую IV(16 байт) + ciphertext, возвращает исходную UTF-8 строку.
 * Если не удалось правильно расшифровать, бросает ошибку.
 */
export function decryptFromBase64(dataB64: string, key: string | Buffer = MASTER_ENCRYPTION_KEY): string {
  const keyBuf = getKeyBytes(key);
  const raw = Buffer.from(dataB64, "base64");
  if (raw.length < 17) {
    throw new Error("Invalid data length for AES-256-CBC");
  }
  const iv = raw.slice(0, 16);
  const cipherText = raw.slice(16);
  const decipher = crypto.createDecipheriv("aes-256-cbc", keyBuf, iv);
  const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);
  return decrypted.toString("utf8");
}

// Простой тест: при запуске node/ts-node encryptionTest.ts <encrypt|decrypt> [строка]
// Примеры:
//   ts-node encryptionTest.ts encrypt '{"user_id":"u123","name":"Bob"}'
//   ts-node encryptionTest.ts decrypt "Base64Строка"
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log("Usage:");
    console.log("  ts-node encryptionTest.ts encrypt '<plaintext>'");
    console.log("  ts-node encryptionTest.ts decrypt '<base64>'");
    process.exit(1);
  }
  const [mode, payload] = args;
  try {
    if (mode === "encrypt") {
      const enc = encryptToBase64(payload);
      console.log("Encrypted Base64:\n", enc);
    } else if (mode === "decrypt") {
      const dec = decryptFromBase64(payload);
      console.log("Decrypted UTF-8:\n", dec);
    } else {
      console.error("Unknown mode:", mode);
      process.exit(1);
    }
  } catch (err: any) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}
