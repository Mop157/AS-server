import { createClient } from "redis";
import { REDIS_URL } from "./config";

export const redisPub = createClient({ url: REDIS_URL });
export const redisSub = createClient({ url: REDIS_URL });

redisPub.on("error", (error) => {
    console.error(`[Worker ${process.pid}] Redis publisher error:`, error);
});
redisSub.on("error", (error) => {
    console.error(`[Worker ${process.pid}] Redis subscriber error:`, error);
});

export async function initRedis() {
    await redisPub.connect();
    await redisSub.connect();

    console.log(`[Worker ${process.pid}] Redis connected`);
}