import mongoose, { Schema, model, models, type Model } from "mongoose";

export interface IPlayer {
  userId: number;
  name: string;
  positionX: string;
  positionY: string;
  power: string;
  data?: Date;
  caps: number;
  command: number;
}

const PlayerSchema = new Schema<IPlayer>({
  userId: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  positionX: { type: String, required: true },
  positionY: { type: String, required: true },
  power: { type: String, required: true },
  data: { type: Date, default: Date.now, index: { expires: 60 } },
  caps: { type: Number, required: true },
  command: { type: Number, required: true },
});

export const Player: Model<IPlayer> = mongoose.model<IPlayer>("Player", PlayerSchema);

export interface IAccount {
  accountUid: string;
  telegram: number;
  tg_username: string;
  password: string;
  userName: string;
  clientVersion: number | boolean;
  loadSave: boolean;
  language: string | boolean;
  X: number | boolean;
  Y: number | boolean;
  power: string;
  platform: string | boolean;
  platformUid: string;
  platformUidlist: string[];
  IP: string;
  createData: Date;
  onlineTimeHours: number;
  lastSeenAt: Date;
}

export interface IUser {
  account: IAccount;
}

const UserSchema = new Schema<IUser>({
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

export const User: Model<IUser> = mongoose.model<IUser>("User", UserSchema);

export interface ISave {
  login: string;
  profile: unknown;
  profile_decryp: string;
}

const SaveSchema = new Schema<ISave>({
  login: { type: String, required: true, unique: true },
  profile: { type: Schema.Types.Mixed, required: true },
  profile_decryp: { type: String, required: true },
});

export const Save: Model<ISave> = (models.Save as Model<ISave>) || mongoose.model<ISave>("Save", SaveSchema);

export interface IFight {
  login: string;
  name: string;
  process: unknown;
}

const fightSchema = new Schema<IFight>({
  login: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  process: { type: Schema.Types.Mixed, required: true },
});

export const Fight: Model<IFight> = (models.fight as Model<IFight>) || mongoose.model<IFight>("fight", fightSchema);

export interface IChatMessage {
  channel: string;
  messages: unknown[] | Record<string, unknown[]>;
  messageId?: number;
}

const ChatMessageSchema = new Schema<IChatMessage>({
  channel: { type: String, required: true },
  messages: {
    type: Schema.Types.Mixed,
    default: function (this: IChatMessage) {
      return this.channel === "3" || this.channel === "4" ? {} : [];
    },
  },
  messageId: { type: Number, default: 1000 },
});

export const ChatMessage: Model<IChatMessage> = mongoose.model<IChatMessage>("ChatMessage", ChatMessageSchema);

export interface IUserGift {
  taker: string;
  indeks?: number;
  limite?: number;
  time?: Date | null;
  gifts: unknown[];
  store: unknown[];
}

const UserGiftSchema = new Schema<IUserGift>({
  taker: { type: String, required: true, unique: true },
  indeks: { type: Number, default: 0 },
  limite: { type: Number, default: 0 },
  time: { type: Date, default: null },
  gifts: { type: [Schema.Types.Mixed], default: [] },
  store: { type: [Schema.Types.Mixed], default: [] },
});

export const UserGift: Model<IUserGift> = mongoose.model<IUserGift>("UserGift", UserGiftSchema);

export interface IServerEvent {
  Gift_send?: boolean;
  Gift_req?: boolean;
  Chat?: boolean;
  Help?: boolean;
  version?: string;
  [key: string]: unknown;
}

const ServerEventSchema = new Schema<IServerEvent>(
  {
    Gift_send: { type: Boolean, default: false },
    Gift_req: { type: Boolean, default: false },
    Chat: { type: Boolean, default: false },
    Help: { type: Boolean, default: false },
    version: { type: String, default: "unknown" },
  },
  { strict: false }
);

export const ServerEvent: Model<IServerEvent> = mongoose.model<IServerEvent>("ServerEvent", ServerEventSchema);

export interface IBanEntry {
  login: string | null;
  platformUid: string | null;
  ip: string | null;
  reason: string;
  durationMinutes: number | null;
  expiresAt: Date | null;
  ban_Id: boolean;
  all: boolean;
  createdBy: string | null;
  createdAt: Date;
}

export interface IBanDoc {
  bans: IBanEntry[];
}

export type BanCollectionDocument = { bans: IBanEntry[] };

const BanSchema = new Schema<IBanDoc>({
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

export const Ban: Model<IBanDoc> = mongoose.model<IBanDoc>("Ban", BanSchema);

export let bansCollection: mongoose.mongo.Collection<BanCollectionDocument> | null = null;
export let mutesCollection: mongoose.mongo.Collection | null = null;

export function initBansCollection(): void {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Failed to initialize bans collection");
  }
  bansCollection = db.collection<BanCollectionDocument>("bans");
  mutesCollection = db.collection("mutes");
}

export interface ICoinLog {
  login: string;
  userAgents: Array<{
    userAgent: string;
    count: number;
  }>;
}

const CoinLogSchema = new Schema<ICoinLog>({
  login: { type: String, required: true, unique: true },
  userAgents: [
    {
      userAgent: { type: String, required: true },
      count: { type: Number, required: true, default: 0 },
    },
  ],
});

export const CoinLog: Model<ICoinLog> = model<ICoinLog>("CoinLog", CoinLogSchema, "coins");

export interface IGiftParcel {
  senderLogin: string;
  senderName: string | null;
  receiverLogin: string;
  receiverName: string | null;
  message: string;
  status: "current" | "sent" | "received" | "deleted";
  sentAt: Date;
  receivedAt: Date | null;
  deletedAt: Date | null;
  deletedBy: string | null;
  deleteReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}

const GiftParcelSchema = new Schema<IGiftParcel>(
  {
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
  },
  { strict: false }
);

GiftParcelSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export const GiftParcel: Model<IGiftParcel> =
  (models.GiftParcel as Model<IGiftParcel>) || mongoose.model<IGiftParcel>("GiftParcel", GiftParcelSchema, "gift_parcels");
