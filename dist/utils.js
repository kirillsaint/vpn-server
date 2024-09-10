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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPortAvailable = void 0;
exports.generatePort = generatePort;
exports.retry = retry;
const net = __importStar(require("net"));
function generatePort() {
    return __awaiter(this, void 0, void 0, function* () {
        while (true) {
            const port = Math.floor(Math.random() * (65535 - 1024 + 1)) + 1024; // Порты от 1024 до 65535
            const available = yield (0, exports.isPortAvailable)(port);
            if (available) {
                return port;
            }
        }
    });
}
function retry(fn, retries = 3) {
    return new Promise((resolve, reject) => {
        const attempt = (retriesLeft) => {
            fn()
                .then(resolve)
                .catch(error => {
                if (retriesLeft === 1) {
                    reject(error);
                }
                else {
                    console.log(`Retrying... ${retriesLeft - 1} attempts left`);
                    attempt(retriesLeft - 1);
                }
            });
        };
        attempt(retries);
    });
}
const isPortAvailable = (port) => {
    return new Promise(resolve => {
        const server = net.createServer();
        server.once("error", err => {
            if (err.name === "EADDRINUSE") {
                resolve(false);
            }
            else {
                resolve(true);
            }
        });
        server.once("listening", () => {
            server.close(() => resolve(true));
        });
        server.listen(port);
    });
};
exports.isPortAvailable = isPortAvailable;
