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
const crypto_1 = require("crypto");
const node_ssh_1 = require("node-ssh");
const readline_sync_1 = __importDefault(require("readline-sync"));
const ssh = new node_ssh_1.NodeSSH();
// Ввод данных от пользователя
const host = readline_sync_1.default.question("Enter your VPS IP address: ");
const username = readline_sync_1.default.question("Enter your VPS username: ");
const password = readline_sync_1.default.question("Enter your VPS password: ", {
    hideEchoBack: true,
});
function installOutline() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Installing Outline Server...");
        const installCommand = `sudo bash -c "$(wget -qO- https://raw.githubusercontent.com/Jigsaw-Code/outline-server/master/src/server_manager/install_scripts/install_server.sh)"`;
        const result = yield ssh.execCommand(installCommand, { stdin: "y" });
        if (result.stderr) {
            console.error("Error installing Outline Server:", result.stderr);
            throw new Error("unknown error");
        }
        console.log("Outline Server installed successfully");
        const match = result.stdout.match(/{.*}/);
        if (match) {
            const outlineConfig = JSON.parse(match[0]);
            console.log(JSON.stringify(outlineConfig));
            return outlineConfig;
        }
        else {
            console.log(result.stdout);
            console.log(result.stderr);
            throw new Error("unknown error");
        }
    });
}
// Подключение к серверу по SSH
ssh
    .connect({
    host: host,
    username: username,
    password: password,
})
    .then(() => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Connected to the server");
    // Выполнение команд на сервере
    try {
        const outline = yield installOutline();
        console.log("Installing NodeJS");
        console.log("apt-get update");
        yield ssh.execCommand(`sudo apt-get update`, { stdin: "y" });
        console.log("installing ca, curl, gnupg");
        yield ssh.execCommand("sudo apt-get install -y ca-certificates curl gnupg", { stdin: "y" });
        yield ssh.execCommand('echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_18.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list', { stdin: "y" });
        console.log("installing nodejs");
        yield ssh.execCommand("sudo apt-get update", { stdin: "y" });
        yield ssh.execCommand("sudo apt-get install nodejs npm -y", {
            stdin: "y",
        });
        console.log("installing deps.");
        yield ssh.execCommand("npm i -g yarn pm2", { stdin: "y" });
        console.log("Installing VPN Server");
        yield ssh.execCommand("cd /root && git clone https://github.com/kirillsaint/vpn-server.git && cd vpn-server && yarn && yarn build && pm2 start dist/index.js --name vpn-server", { stdin: "y" });
        const key = (0, crypto_1.randomUUID)();
        const env = `NODE_ENV=production\nPORT=3000\nSECRET_KEY=${key}\nOUTLINE_API_URL=${outline.apiUrl}\nOUTLINE_API_FINGERPRINT=${(0, crypto_1.randomUUID)()}`;
        yield ssh.execCommand(`echo -e "${env}" > /root/vpn-server/.env`, {
            stdin: "y",
        });
        console.log(".env file created successfully");
        console.log("SERVER STRING");
        console.log(`${host}:3000/${key}`);
    }
    catch (error) {
        console.error("Error installing Outline Server:", error);
    }
    // Отключение от сервера
    ssh.dispose();
}))
    .catch(err => {
    console.error("Error connecting to the server:", err);
});
