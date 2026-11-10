"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cluster_1 = __importDefault(require("cluster"));
const WORKERS = 3; // сколько процессов хочешь
if (cluster_1.default.isPrimary) {
    console.log(`Master PID ${process.pid} is running`);
    // Запускаем воркеры
    for (let i = 0; i < WORKERS; i++) {
        const worker = cluster_1.default.fork();
        console.log(`Started worker PID ${worker.process.pid}`);
    }
    // Если воркер упал — перезапускаем
    cluster_1.default.on("exit", (worker, code, signal) => {
        console.log(`Worker PID ${worker.process.pid} died. Restarting...`);
        cluster_1.default.fork();
    });
}
else {
    // Воркеры запускают твой сервер
    console.log(`Worker PID ${process.pid} started`);
    require("./server");
}
