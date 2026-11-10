import cluster from "cluster";

const WORKERS = 3; // сколько процессов хочешь

if (cluster.isPrimary) {
    console.log(`Master PID ${process.pid} is running`);

    // Запускаем воркеры
    for (let i = 0; i < WORKERS; i++) {
        const worker = cluster.fork();
        console.log(`Started worker PID ${worker.process.pid}`);
    }

    // Если воркер упал — перезапускаем
    cluster.on("exit", (worker, code, signal) => {
        console.log(`Worker PID ${worker.process.pid} died. Restarting...`);
        cluster.fork();
    });

} else {
    // Воркеры запускают твой сервер
    console.log(`Worker PID ${process.pid} started`);
    require("./server");
}