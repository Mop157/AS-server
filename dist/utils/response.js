"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendError = exports.sendSuccess = void 0;
function sendSuccess(res, data) {
    // console.log({ result: 1, data })
    res.json({ result: 1, data });
}
exports.sendSuccess = sendSuccess;
function sendError(res, error, code = 0) {
    res.json({ result: code, data: { error } });
}
exports.sendError = sendError;
