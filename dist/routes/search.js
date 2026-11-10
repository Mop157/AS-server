"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/search.ts
const express_1 = require("express");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
// В простом варианте PIN проверяем жестко "1234". 
// В реальном мире: искать в БД, проверять соответствие userId -> сохранённому PIN.
function isAuthorized(pin) {
    return pin === "1234";
}
router.get("/security/retrive/:userId/:pin", (req, res) => {
    const { userId, pin } = req.params;
    if (!userId || !pin)
        return (0, response_1.sendError)(res, "Missing params");
    if (!isAuthorized(pin))
        return (0, response_1.sendError)(res, "Invalid PIN");
    (0, response_1.sendSuccess)(res, { valid: true });
});
router.get("/search/id/:userId/:pin", (req, res) => {
    const { userId, pin } = req.params;
    if (!isAuthorized(pin))
        return (0, response_1.sendError)(res, "Unauthorized");
    // TODO: найти в БД по userId
    (0, response_1.sendSuccess)(res, { user_id: userId, name: `Player_${userId}`, level: 10 });
});
router.get("/search/account/:accountUid/:pin", (req, res) => {
    const { accountUid, pin } = req.params;
    if (!isAuthorized(pin))
        return (0, response_1.sendError)(res, "Unauthorized");
    // TODO: найти по accountUid
    (0, response_1.sendSuccess)(res, { account_uid: accountUid, user_id: "555", name: "AcctUser" });
});
router.get("/search/device/:deviceUid/:pin", (req, res) => {
    const { deviceUid, pin } = req.params;
    if (!isAuthorized(pin))
        return (0, response_1.sendError)(res, "Unauthorized");
    // TODO: найти по deviceUid
    (0, response_1.sendSuccess)(res, { device_uid: deviceUid, user_id: "666", name: "DeviceUser" });
});
router.get("/search/name/:name/:pin", (req, res) => {
    let { name, pin } = req.params;
    if (!isAuthorized(pin))
        return (0, response_1.sendError)(res, "Unauthorized");
    // name уже декодирован Express
    // TODO: поиск по имени (частичное совпадение) в БД, пагинация и т.д.
    (0, response_1.sendSuccess)(res, {
        results: [
            { user_id: "101", name: `${name}_A`, level: 5 },
            { user_id: "102", name: `${name}_B`, level: 7 },
        ],
    });
});
exports.default = router;
