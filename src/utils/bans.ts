import { Ban } from "../db";

/**
 * Проверяет, забанен ли пользователь/устройство/ип.
 * Передавайте хотя бы одно из полей: login | platformUid | ip
 * Возвращает объект { banned, ban }
 */
export async function isBanned(opts: { login?: string; platformUid?: string; ip?: string; }) {
  const { login, platformUid, ip } = opts;
  if (!login && !platformUid && !ip) return { banned: false, ban: null };

  const now = new Date();
  const or: any[] = [];
  if (login) or.push({ "bans.login": login });
  if (platformUid) or.push({ "bans.platformUid": platformUid });
  if (ip) or.push({ "bans.ip": ip });

  const banDoc = await Ban.findOne({
    $or: or
  }).lean();

  if (!banDoc) return { banned: false, ban: null };

  // Ищем конкретный бан в массиве
  const ban = banDoc.bans?.find((b: any) => {
    const notExpired = !b.expiresAt || b.expiresAt > now;
    return notExpired && (
      (login && b.login === login) ||
      (platformUid && b.platformUid === platformUid) ||
      (ip && b.ip === ip)
    );
  });

  if (!ban) return { banned: false, ban: null };
  return { banned: true, ban };
}