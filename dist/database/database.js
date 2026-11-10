"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Папка для хранения данных
const dataDir = path_1.default.join(__dirname, "data");
if (!fs_1.default.existsSync(dataDir)) {
    fs_1.default.mkdirSync(dataDir);
}
// Универсальные функции для загрузки/сохранения JSON-данных в файлах
function loadData(filename, defaultData) {
    const filePath = path_1.default.join(dataDir, filename);
    try {
        if (fs_1.default.existsSync(filePath)) {
            const content = fs_1.default.readFileSync(filePath, "utf8");
            return JSON.parse(content);
        }
    }
    catch (err) {
        console.error(`Error reading ${filename}:`, err);
    }
    saveData(filename, defaultData);
    return defaultData;
}
function saveData(filename, data) {
    const filePath = path_1.default.join(dataDir, filename);
    try {
        fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    }
    catch (err) {
        console.error(`Error writing ${filename}:`, err);
    }
}
// Чат
let chatMessages = loadData("chatMessages.json", {
    "1": [],
    "2": [],
});
// Игроки – хранится массив, но для отображения будем фильтровать чувствительные данные
let players = loadData("players.json", []);
let userGifts = loadData("userGifts.json", {});
let users = loadData("users.json", {});
exports.default = { chatMessages, players, userGifts, users, loadData, saveData };
