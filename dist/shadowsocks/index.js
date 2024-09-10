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
exports.runningProcesses = void 0;
exports.getSSLocalPath = getSSLocalPath;
exports.startSSLocal = startSSLocal;
exports.stopSSLocal = stopSSLocal;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const __1 = require("..");
const utils_1 = require("../utils");
exports.runningProcesses = new Map(); // Сохранение активных процессов
function getSSLocalPath() {
    return path_1.default.join(`./bin/shadowsocks/${process.platform === "darwin" ? "macos" : "linux"}/ss-local`);
}
function startSSLocal(userId, userConfig) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const localPort = yield (0, utils_1.generatePort)();
        const url = __1.env.OUTLINE_API_URL;
        const parsedUrl = new URL(url);
        const args = [
            "-s",
            parsedUrl.hostname,
            "-p",
            userConfig.port.toString(),
            "-l",
            localPort.toString(),
            "-k",
            userConfig.password,
            "-m",
            userConfig.method,
        ];
        const process = (0, child_process_1.spawn)(getSSLocalPath(), args);
        (_a = process.stdout) === null || _a === void 0 ? void 0 : _a.on("data", data => {
            console.log(`[ss-local:${userId}:${localPort}] stdout: ${data}`);
        });
        (_b = process.stderr) === null || _b === void 0 ? void 0 : _b.on("data", data => {
            console.error(`[ss-local:${userId}:${localPort}] stderr: ${data}`);
        });
        process.on("close", code => {
            console.log(`[ss-local:${userId}:${localPort}] process exited with code ${code}`);
            exports.runningProcesses.delete(userId); // Удаляем процесс из отслеживаемых
        });
        exports.runningProcesses.set(userId, { process, port: localPort });
        return localPort;
    });
}
function stopSSLocal(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const process = exports.runningProcesses.get(userId);
        if (process) {
            process === null || process === void 0 ? void 0 : process.kill();
            exports.runningProcesses.delete(userId);
            console.log(`[ss-local:${userId}:${process.port}] stopped`);
            return;
        }
        console.error(`No ss-local process found for user ${userId}`);
    });
}
