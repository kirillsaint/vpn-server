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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = fetchWithPin;
const https = __importStar(require("https"));
const url_1 = require("url");
function fetchWithPin(req_1, fingerprint_1) {
    return __awaiter(this, arguments, void 0, function* (req, fingerprint, timeout = 10000) {
        var _a, e_1, _b, _c;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const response = yield new Promise((resolve, reject) => {
                const options = Object.assign(Object.assign({}, (0, url_1.urlToHttpOptions)(new URL(req.url))), { method: req.method, headers: req.headers, signal: controller.signal, rejectUnauthorized: false });
                const request = https.request(options, resolve);
                request.on("error", err => {
                    clearTimeout(timeoutId);
                    reject(err);
                });
                request.on("timeout", () => {
                    request.destroy();
                    reject(new Error("Request timed out"));
                });
                request.on("abort", () => {
                    reject(new Error("This operation was aborted"));
                });
                request.on("response", response => {
                    clearTimeout(timeoutId);
                    resolve(response);
                });
                request.on("secureConnect", () => {
                    const socket = request.socket;
                    const cert = socket.getPeerCertificate();
                    if (cert.fingerprint256 !== fingerprint) {
                        reject(new Error(`Certificate fingerprint does not match ${fingerprint}`));
                    }
                });
                if (req.body) {
                    request.write(req.body);
                }
                request.end();
            });
            const chunks = [];
            try {
                for (var _d = true, response_1 = __asyncValues(response), response_1_1; response_1_1 = yield response_1.next(), _a = response_1_1.done, !_a; _d = true) {
                    _c = response_1_1.value;
                    _d = false;
                    const chunk = _c;
                    chunks.push(chunk);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = response_1.return)) yield _b.call(response_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return {
                status: response.statusCode,
                ok: response.statusCode
                    ? response.statusCode >= 200 && response.statusCode < 300
                    : false,
                body: Buffer.concat(chunks).toString(),
            };
        }
        catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    });
}
