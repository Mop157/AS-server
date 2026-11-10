"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const config_1 = require("../config");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
// Общая функция возвращает объект настроек. Можно вынести в отдельный сервис или config.
function getDefaultSettings() {
    return {
        "servers": [
            {
                "host": config_1.WS_HOST,
                "locale": "ru",
                "port_tcp": config_1.WS_PORT,
                "primary_tcp_port": config_1.WS_PORT,
                "visible_name": config_1.CLIENT_VISIBLE_NAME,
                "network_protocol": 123,
                "encryption_key": config_1.CLIENT_ENCRYPTION_KEY,
                "minimum_version_ios": 500,
                "minimum_version_android": 500,
                "online": 0,
                "time_updated": Math.floor(Date.now() / 1000),
                "delta_updated": 7,
                "is_serialize_int": false
            },
        ]
    };
}
router.get("/", (_req, res) => {
    (0, response_1.sendSuccess)(res, getDefaultSettings());
});
// при необходимости версия 2.0 может быть несколько иной, но здесь одинаковая
router.get("/2.0/client", (_req, res) => {
    (0, response_1.sendSuccess)(res, getDefaultSettings());
});
exports.default = router;
