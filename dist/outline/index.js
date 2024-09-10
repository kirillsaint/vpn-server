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
exports.OutlineVPN = void 0;
const utils_1 = require("../utils");
const fetch_1 = __importDefault(require("./fetch"));
class OutlineVPN {
    constructor(options) {
        this.apiUrl = options.apiUrl;
        this.fingerprint = options.fingerprint;
        this.timeout = options.timeout;
    }
    fetch(req) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield (0, utils_1.retry)(() => __awaiter(this, void 0, void 0, function* () {
                return yield (0, fetch_1.default)(req, this.fingerprint, this.timeout);
            }));
        });
    }
    getServer() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.fetch({
                url: `${this.apiUrl}/server`,
                method: "GET",
            });
            if (response.ok) {
                const json = JSON.parse(response.body);
                return json;
            }
            else {
                throw new Error("No server found");
            }
        });
    }
    renameServer(name) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.fetch({
                url: `${this.apiUrl}/name`,
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            return response.ok;
        });
    }
    setDefaultDataLimit(bytes) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.fetch({
                url: `${this.apiUrl}/server/access-key-data-limit`,
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ limit: { bytes } }),
            });
            return response.ok;
        });
    }
    deleteDefaultDataLimit() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.fetch({
                url: `${this.apiUrl}/server/access-key-data-limit`,
                method: "DELETE",
            });
            return response.ok;
        });
    }
    setHostnameForAccessKeys(hostname) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.fetch({
                url: `${this.apiUrl}/server/hostname-for-access-keys`,
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hostname }),
            });
            return response.ok;
        });
    }
    setPortForNewAccessKeys(port) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.fetch({
                url: `${this.apiUrl}/server/port-for-new-access-keys`,
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ port }),
            });
            return response.ok;
        });
    }
    getDataUsage() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.fetch({
                url: `${this.apiUrl}/metrics/transfer`,
                method: "GET",
            });
            if (response.ok) {
                const json = JSON.parse(response.body);
                return json;
            }
            else {
                throw new Error("No server found");
            }
        });
    }
    getDataUserUsage(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const { bytesTransferredByUserId } = yield this.getDataUsage();
            const userUsage = bytesTransferredByUserId[id];
            if (userUsage) {
                return userUsage;
            }
            else {
                throw new Error("No user found, check metrics is enabled");
            }
        });
    }
    getShareMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.fetch({
                url: `${this.apiUrl}/metrics/enabled`,
                method: "GET",
            });
            if (response.ok) {
                const json = JSON.parse(response.body);
                return json;
            }
            else {
                throw new Error("No server found");
            }
        });
    }
    setShareMetrics(metricsEnabled) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.fetch({
                url: `${this.apiUrl}/metrics/enabled`,
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ metricsEnabled }),
            });
            if (response.ok) {
                const json = JSON.parse(response.body);
                return json;
            }
            else {
                throw new Error("No server found");
            }
        });
    }
    getUsers() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.fetch({
                url: `${this.apiUrl}/access-keys`,
                method: "GET",
            });
            if (response.ok) {
                const { accessKeys } = JSON.parse(response.body);
                return accessKeys;
            }
            else {
                throw new Error("No server found");
            }
        });
    }
    getUser(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.fetch({
                url: `${this.apiUrl}/access-keys/${id}`,
                method: "GET",
            });
            if (response.ok) {
                const json = JSON.parse(response.body);
                return json;
            }
            return null;
        });
    }
    createUser() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.fetch({
                url: `${this.apiUrl}/access-keys`,
                method: "POST",
            });
            if (response.ok) {
                const json = JSON.parse(response.body);
                return json;
            }
            else {
                throw new Error("No server found");
            }
        });
    }
    deleteUser(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.fetch({
                url: `${this.apiUrl}/access-keys/${id}`,
                method: "DELETE",
            });
            return response.ok;
        });
    }
    renameUser(id, name) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.fetch({
                url: `${this.apiUrl}/access-keys/${id}/name`,
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            return response.ok;
        });
    }
    addDataLimit(id, bytes) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.fetch({
                url: `${this.apiUrl}/access-keys/${id}/data-limit`,
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ limit: { bytes } }),
            });
            return response.ok;
        });
    }
    deleteDataLimit(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.fetch({
                url: `${this.apiUrl}/access-keys/${id}/data-limit`,
                method: "DELETE",
            });
            return response.ok;
        });
    }
    disableUser(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.addDataLimit(id, 0);
        });
    }
    enableUser(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.deleteDataLimit(id);
        });
    }
}
exports.OutlineVPN = OutlineVPN;
