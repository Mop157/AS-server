import { Router, Request, Response } from "express";
import { CLIENT_ENCRYPTION_KEY, CLIENT_VISIBLE_NAME, WS_HOST, WS_PORT } from "../config";
import { sendSuccess } from "../utils/response";

const router = Router();

// Общая функция возвращает объект настроек. Можно вынести в отдельный сервис или config.
function getDefaultSettings() {
  return {
        "servers": [
            {
                "host": WS_HOST,
                "locale": "ru",
                "port_tcp": WS_PORT,
                "primary_tcp_port": WS_PORT,
                "visible_name": CLIENT_VISIBLE_NAME,
                "network_protocol": 123,
                "encryption_key": CLIENT_ENCRYPTION_KEY,
                "minimum_version_ios": 500,
                "minimum_version_android": 500,
                "online": 0,
                "time_updated": Math.floor(Date.now() / 1000),
                "delta_updated": 7,
                "is_serialize_int": false
            },
        ]
    }
  }

router.get("/", (_req: Request, res: Response) => {
  sendSuccess(res, getDefaultSettings());
});
// при необходимости версия 2.0 может быть несколько иной, но здесь одинаковая
router.get("/2.0/client", (_req: Request, res: Response) => {
  sendSuccess(res, getDefaultSettings());
});

export default router;
