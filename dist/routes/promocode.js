"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/promocode.ts
const express_1 = require("express");
const encryption_1 = require("../utils/encryption");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
router.post("/", (req, res) => {
    const enc = req.body.data;
    if (!enc)
        return (0, response_1.sendError)(res, "Missing 'data'");
    let jsonStr;
    try {
        jsonStr = (0, encryption_1.tryDecrypt)(enc);
    }
    catch {
        return (0, response_1.sendError)(res, "Decryption failed");
    }
    let payload;
    try {
        payload = JSON.parse(jsonStr);
    }
    catch {
        return (0, response_1.sendError)(res, "Invalid JSON");
    }
    const { code } = payload;
    if (!code)
        return (0, response_1.sendError)(res, "Missing code");
    // TODO: проверка кода в БД
    if (code === "FREE100") {
        (0, response_1.sendSuccess)(res, { applied: true, bonus: 100 });
    }
    else {
        (0, response_1.sendError)(res, "Invalid promo code");
    }
});
exports.default = router;
