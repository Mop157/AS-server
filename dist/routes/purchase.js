"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/purchase.ts
const express_1 = require("express");
const encryption_1 = require("../utils/encryption");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
router.post("/validate", (req, res) => {
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
    const { purchaseId, receipt } = payload;
    if (!purchaseId || !receipt) {
        return (0, response_1.sendError)(res, "Missing purchaseId or receipt");
    }
    // TODO: верифицировать покупку через платёжный провайдер
    // Если валидно:
    (0, response_1.sendSuccess)(res, { purchaseValid: true, purchaseId });
    // Иначе sendError(res, "Invalid purchase", someCode);
});
exports.default = router;
