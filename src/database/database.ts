import fs from "fs";
import path from "path";


// Папка для хранения данных
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Универсальные функции для загрузки/сохранения JSON-данных в файлах
function loadData<T>(filename: string, defaultData: T): T {
  const filePath = path.join(dataDir, filename);
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
  }
  saveData(filename, defaultData);
  return defaultData;
}

function saveData(filename: string, data: any) {
  const filePath = path.join(dataDir, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error(`Error writing ${filename}:`, err);
  }
}


// Чат
let chatMessages: { [channel: string]: any } =
  loadData("chatMessages.json", {
    "1": [],
    "2": [],
  });

// Игроки – хранится массив, но для отображения будем фильтровать чувствительные данные
let players = loadData("players.json", []);

interface GiftData {
  id: number;        // Уникальный ID подарка
  sender: string;    // Кто отправил (логин отправителя)
  content: string;   // Строка JSON с предметами
  code: string;      
}
let userGifts: { [recipient: string]: Array<GiftData> } =
    loadData("userGifts.json", {});
  

// Данные зарегистрированных пользователей, индексированные по логину
interface UserData {
  account: {
    login: string;
    name: string;
    token: string;
  };
  profile?: any;
  chat?: any;
  
}
let users: { [login: string]: UserData } = loadData("users.json", {});






export default {chatMessages, players, userGifts, users, loadData, saveData}