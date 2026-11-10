"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/time.ts
const express_1 = require("express");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
router.get("/", (_req, res) => {
    // UNIX timestamp в секундах
    //   console.log(11111)
    (0, response_1.sendSuccess)(res, { serverTime: Math.floor(Date.now() / 1000) });
});
exports.default = router;
