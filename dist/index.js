"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const express_1 = __importDefault(require("express"));
const ts_dotenv_1 = require("ts-dotenv");
const outline_1 = require("./outline");
const shadowsocks_1 = require("./shadowsocks");
exports.env = (0, ts_dotenv_1.load)({
    NODE_ENV: ["production", "development"],
    PORT: Number,
    SECRET_KEY: String,
    OUTLINE_API_URL: String,
    OUTLINE_API_FINGERPRINT: String,
});
const server = (0, express_1.default)();
const outline = new outline_1.OutlineVPN({
    apiUrl: exports.env.OUTLINE_API_URL,
    fingerprint: exports.env.OUTLINE_API_FINGERPRINT,
});
server.use(express_1.default.json());
function startAllShadowsocks() {
    return __awaiter(this, void 0, void 0, function* () {
        const clients = yield outline.getUsers();
        for (const client of clients) {
            const port = yield (0, shadowsocks_1.startSSLocal)(client.id, client);
            shadowsocks_1.runningProcesses.set(client.id, { port });
        }
    });
}
function stopShadowsocks() {
    return __awaiter(this, void 0, void 0, function* () {
        const clients = yield outline.getUsers();
        for (const client of clients) {
            yield (0, shadowsocks_1.stopSSLocal)(client.id);
        }
        shadowsocks_1.runningProcesses.clear();
    });
}
server.get("/clients", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (req.header("secret-key") !== exports.env.SECRET_KEY &&
        exports.env.NODE_ENV === "production") {
        return res.status(404).send({ error: true, description: "Page not found" });
    }
    const clients = yield outline.getUsers();
    return res.json({
        error: false,
        clients: clients.map(e => {
            return Object.assign(Object.assign({}, e), { socks_port: shadowsocks_1.runningProcesses.get(e.id).port });
        }),
    });
}));
server.post("/clients/create", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (req.header("secret-key") !== exports.env.SECRET_KEY &&
        exports.env.NODE_ENV === "production") {
        return res.status(404).send({ error: true, description: "Page not found" });
    }
    let newClient = yield outline.createUser();
    if (req.body.name) {
        yield outline.renameUser(newClient.id, req.body.name);
        newClient.name = req.body.name;
    }
    yield (0, shadowsocks_1.startSSLocal)(newClient.id, newClient);
    return res.json({ error: false, newClient });
}));
server.post("/clients/delete", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (req.header("secret-key") !== exports.env.SECRET_KEY &&
            exports.env.NODE_ENV === "production") {
            return res
                .status(404)
                .send({ error: true, description: "Page not found" });
        }
        const client = yield outline.getUser(req.body.id);
        if (!client) {
            return res.json({ error: true, description: "Client not found" });
        }
        yield (0, shadowsocks_1.stopSSLocal)(req.body.id);
        yield outline.deleteUser(client.id);
        return res.json({ error: false });
    }
    catch (error) {
        return res.json({ error: true, description: `${error}` });
    }
}));
server.listen(exports.env.PORT);
startAllShadowsocks();
process.once("SIGINT", stopShadowsocks);
process.once("SIGTERM", stopShadowsocks);
