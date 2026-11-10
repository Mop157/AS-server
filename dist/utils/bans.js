"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBanned = void 0;
const db_1 = require("../db");
/**
 * Проверяет, забанен ли пользователь/устройство/ип.
 * Передавайте хотя бы одно из полей: login | platformUid | ip
 * Возвращает объект { banned, ban }
 */
async function isBanned(opts) {
    const { login, platformUid, ip } = opts;
    if (!login && !platformUid && !ip)
        return { banned: false, ban: null };
    const now = new Date();
    const or = [];
    if (login)
        or.push({ "bans.login": login });
    if (platformUid)
        or.push({ "bans.platformUid": platformUid });
    if (ip)
        or.push({ "bans.ip": ip });
    const banDoc = await db_1.Ban.findOne({
        $or: or
    }).lean();
    if (!banDoc)
        return { banned: false, ban: null };
    // Ищем конкретный бан в массиве
    const ban = banDoc.bans?.find((b) => {
        const notExpired = !b.expiresAt || b.expiresAt > now;
        return notExpired && ((login && b.login === login) ||
            (platformUid && b.platformUid === platformUid) ||
            (ip && b.ip === ip));
    });
    if (!ban)
        return { banned: false, ban: null };
    return { banned: true, ban };
}
exports.isBanned = isBanned;
