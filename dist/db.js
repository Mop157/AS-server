"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiftParcel = exports.CoinLog = exports.initBansCollection = exports.mutesCollection = exports.bansCollection = exports.Ban = exports.ServerEvent = exports.UserGift = exports.ChatMessage = exports.Fight = exports.Save = exports.User = exports.Player = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const PlayerSchema = new mongoose_1.Schema({
    userId: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    positionX: { type: String, required: true },
    positionY: { type: String, required: true },
    power: { type: String, required: true },
    data: { type: Date, default: Date.now, index: { expires: 60 } },
    caps: { type: Number, required: true },
    command: { type: Number, required: true },
});
exports.Player = mongoose_1.default.model("Player", PlayerSchema);
const UserSchema = new mongoose_1.Schema({
    account: {
        accountUid: { type: String, required: true, unique: true },
        telegram: { type: Number, required: true, default: 0 },
        tg_username: { type: String, required: true, default: "null" },
        password: { type: String, required: true, default: "null" },
        userName: { type: String, required: true, unique: true },
        clientVersion: { type: Number, default: false },
        loadSave: { type: Boolean, default: true, required: true },
        language: { type: String, default: false },
        X: { type: Number, default: false },
        Y: { type: Number, default: false },
        power: { type: String, required: true, default: "null" },
        platform: { type: String, default: false },
        platformUid: { type: String, default: "null" },
        platformUidlist: { type: [String], default: [] },
        IP: { type: String, default: "null" },
        createData: { type: Date, default: Date.now },
        onlineTimeHours: { type: Number, default: 0 },
        lastSeenAt: { type: Date, default: Date.now },
    },
});
exports.User = mongoose_1.default.model("User", UserSchema);
const SaveSchema = new mongoose_1.Schema({
    login: { type: String, required: true, unique: true },
    profile: { type: mongoose_1.Schema.Types.Mixed, required: true },
    profile_decryp: { type: String, required: true },
});
exports.Save = mongoose_1.models.Save || mongoose_1.default.model("Save", SaveSchema);
const fightSchema = new mongoose_1.Schema({
    login: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    process: { type: mongoose_1.Schema.Types.Mixed, required: true },
});
exports.Fight = mongoose_1.models.fight || mongoose_1.default.model("fight", fightSchema);
const ChatMessageSchema = new mongoose_1.Schema({
    channel: { type: String, required: true },
    messages: {
        type: mongoose_1.Schema.Types.Mixed,
        default: function () {
            return this.channel === "3" || this.channel === "4" ? {} : [];
        },
    },
    messageId: { type: Number, default: 1000 },
});
exports.ChatMessage = mongoose_1.default.model("ChatMessage", ChatMessageSchema);
const UserGiftSchema = new mongoose_1.Schema({
    taker: { type: String, required: true, unique: true },
    indeks: { type: Number, default: 0 },
    limite: { type: Number, default: 0 },
    time: { type: Date, default: null },
    gifts: { type: [mongoose_1.Schema.Types.Mixed], default: [] },
    store: { type: [mongoose_1.Schema.Types.Mixed], default: [] },
});
exports.UserGift = mongoose_1.default.model("UserGift", UserGiftSchema);
const ServerEventSchema = new mongoose_1.Schema({
    Gift_send: { type: Boolean, default: false },
    Gift_req: { type: Boolean, default: false },
    Chat: { type: Boolean, default: false },
    Help: { type: Boolean, default: false },
    version: { type: String, default: "unknown" },
}, { strict: false });
exports.ServerEvent = mongoose_1.default.model("ServerEvent", ServerEventSchema);
const BanSchema = new mongoose_1.Schema({
    bans: [
        {
            login: { type: String, default: null },
            platformUid: { type: String, default: null },
            ip: { type: String, default: null },
            reason: { type: String, required: true, default: "no reason" },
            durationMinutes: { type: Number, default: null },
            expiresAt: { type: Date, default: null },
            ban_Id: { type: Boolean, default: false },
            all: { type: Boolean, default: false },
            createdBy: { type: String, default: null },
            createdAt: { type: Date, default: Date.now },
        },
    ],
});
exports.Ban = mongoose_1.default.model("Ban", BanSchema);
exports.bansCollection = null;
exports.mutesCollection = null;
function initBansCollection() {
    const db = mongoose_1.default.connection.db;
    if (!db) {
        throw new Error("Failed to initialize bans collection");
    }
    exports.bansCollection = db.collection("bans");
    exports.mutesCollection = db.collection("mutes");
}
exports.initBansCollection = initBansCollection;
const CoinLogSchema = new mongoose_1.Schema({
    login: { type: String, required: true, unique: true },
    userAgents: [
        {
            userAgent: { type: String, required: true },
            count: { type: Number, required: true, default: 0 },
        },
    ],
});
exports.CoinLog = (0, mongoose_1.model)("CoinLog", CoinLogSchema, "coins");
const GiftParcelSchema = new mongoose_1.Schema({
    senderLogin: { type: String, required: true, index: true },
    senderName: { type: String, default: null, index: true },
    receiverLogin: { type: String, required: true, index: true },
    receiverName: { type: String, default: null, index: true },
    message: { type: String, default: "" },
    status: {
        type: String,
        enum: ["current", "sent", "received", "deleted"],
        default: "current",
        index: true,
    },
    sentAt: { type: Date, default: Date.now, index: true },
    receivedAt: { type: Date, default: null, index: true },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: String, default: null },
    deleteReason: { type: String, default: null },
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
}, { strict: false });
GiftParcelSchema.pre("save", function (next) {
    this.updatedAt = new Date();
    next();
});
exports.GiftParcel = mongoose_1.models.GiftParcel || mongoose_1.default.model("GiftParcel", GiftParcelSchema, "gift_parcels");
