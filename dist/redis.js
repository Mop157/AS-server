"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initRedis = exports.redisSub = exports.redisPub = void 0;
const redis_1 = require("redis");
const config_1 = require("./config");
exports.redisPub = (0, redis_1.createClient)({ url: config_1.REDIS_URL });
exports.redisSub = (0, redis_1.createClient)({ url: config_1.REDIS_URL });
exports.redisPub.on("error", (error) => {
    console.error(`[Worker ${process.pid}] Redis publisher error:`, error);
});
exports.redisSub.on("error", (error) => {
    console.error(`[Worker ${process.pid}] Redis subscriber error:`, error);
});
async function initRedis() {
    await exports.redisPub.connect();
    await exports.redisSub.connect();
    console.log(`[Worker ${process.pid}] Redis connected`);
}
exports.initRedis = initRedis;
