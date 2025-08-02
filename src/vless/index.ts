// services/xui-vless.ts
import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { randomUUID } from "crypto";
import { CookieJar } from "tough-cookie";
import { env } from "..";

export interface Client {
	id: string;
	flow: "xtls-rprx-vision";
}

export interface User {
	id: string;
	flow: "xtls-rprx-vision";
	key: string;
}

type InboundApiItem = {
	id: number;
	port: number;
	protocol: "vless" | string;
	settings: any | string;
	streamSettings: any | string;
	sniffing?: any | string;
	remark?: string;
	enable?: boolean;
};

interface Options {
	baseUrl: string; // XUI_URL, напр. http://<ip>:2053
	username: string; // XUI_USERNAME
	password: string; // XUI_PASSWORD
	inboundId: number; // XUI_INBOUND_ID — ID нужного inbound в панели
	publicHost?: string; // что вставлять в vless://<id>@HOST:443, по умолчанию hostname из OUTLINE_API_URL
}

export class XuiVlessVPN {
	private http;
	private jar = new CookieJar();
	private loggedIn = false;

	private baseUrl: string;
	private username: string;
	private password: string;
	private inboundId: number;
	private publicHost: string;

	constructor(opts?: Partial<Options>) {
		this.baseUrl = opts?.baseUrl ?? String(env.XUI_URL);
		this.username = opts?.username ?? String(env.XUI_USERNAME);
		this.password = opts?.password ?? String(env.XUI_PASSWORD);
		this.inboundId = Number(opts?.inboundId ?? env.XUI_INBOUND_ID);
		this.publicHost =
			opts?.publicHost ??
			(() => {
				try {
					return new URL(
						env?.OUTLINE_API_URL || process.env.OUTLINE_API_URL || this.baseUrl
					).hostname;
				} catch {
					return "127.0.0.1";
				}
			})();

		this.http = wrapper(
			axios.create({
				baseURL: this.baseUrl.replace(/\/+$/, ""),
				jar: this.jar,
				withCredentials: true,
				// 3x-ui иногда отвечает пустым телом при 200 — не падать на этом
				validateStatus: () => true,
			})
		);
	}

	// --- auth ----------------------------------------------------

	private async ensureLogin() {
		if (this.loggedIn) return;
		const body = new URLSearchParams({
			username: this.username,
			password: this.password,
		});
		const res = await this.http.post("/login", body, {
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
		});
		if (res.status !== 200) {
			throw new Error(`3x-ui login failed: HTTP ${res.status}`);
		}
		this.loggedIn = true;
	}

	// --- helpers -------------------------------------------------

	private parseMaybeJSON<T>(v: T | string): T {
		if (typeof v === "string") {
			try {
				return JSON.parse(v);
			} catch {
				/* ignore */
			}
		}
		return v as any;
	}

	private async getInbound(): Promise<
		InboundApiItem & { settings: any; streamSettings: any }
	> {
		await this.ensureLogin();
		const res = await this.http.get("/panel/api/inbounds/list", {
			headers: { Accept: "application/json" },
		});
		if (res.status !== 200 || !res.data) {
			throw new Error(`Cannot list inbounds: HTTP ${res.status}`);
		}
		const list: InboundApiItem[] = res.data?.obj ?? res.data?.inbounds ?? [];
		const inbound = list.find(i => i.id === this.inboundId);
		if (!inbound) throw new Error(`Inbound ${this.inboundId} not found`);

		const settings = this.parseMaybeJSON(inbound.settings);
		const streamSettings = this.parseMaybeJSON(inbound.streamSettings);
		return { ...inbound, settings, streamSettings };
	}

	private buildVlessKey(params: {
		userId: string;
		flow: string;
		serverName: string;
		pbk: string;
		sid: string;
		port?: number; // default 443
	}): string {
		const port = params.port ?? 443;
		// как у вас: type=tcp&security=reality&fp=chrome&sni=<serverName>&pbk=<publicKey>&sid=<shortId>&spx=%2F
		return (
			`vless://${params.userId}@${this.publicHost}:${port}` +
			`?flow=${encodeURIComponent(params.flow)}` +
			`&type=tcp&security=reality&fp=chrome` +
			`&sni=${encodeURIComponent(params.serverName)}` +
			`&pbk=${encodeURIComponent(params.pbk)}` +
			`&sid=${encodeURIComponent(params.sid)}` +
			`&spx=%2F`
		);
	}

	// --- public API (совместимая с вашим интерфейсом) -----------

	public async getUsers(): Promise<User[]> {
		const inbound = await this.getInbound();

		const serverName =
			inbound.streamSettings?.realitySettings?.serverNames?.[0] ??
			"cloudflare.com";
		const pbk =
			inbound.streamSettings?.realitySettings?.settings?.publicKey ??
			env.VLESS_PUBLIC_KEY;
		const sid = (inbound.streamSettings?.realitySettings?.shortIds ?? [
			env.VLESS_SHORT_ID,
		])[0];
		const port = inbound.port ?? 443;

		const clients: Client[] = (inbound.settings?.clients ?? []).map(
			(c: any) => ({
				id: c.id,
				flow: (c.flow || "xtls-rprx-vision") as "xtls-rprx-vision",
			})
		);

		return clients.map(c => ({
			id: c.id,
			flow: c.flow,
			key: this.buildVlessKey({
				userId: c.id,
				flow: c.flow,
				serverName,
				pbk,
				sid,
				port,
			}),
		}));
	}

	public async getUser(id: string): Promise<User | null> {
		const users = await this.getUsers();
		return users.find(u => u.id === id) ?? null;
	}

	public async createUser(id?: string): Promise<User> {
		await this.ensureLogin();
		const inbound = await this.getInbound();

		const userId = id || randomUUID();
		const flow: User["flow"] = "xtls-rprx-vision";

		// /panel/api/inbounds/addClient  — settings ДОЛЖЕН быть строкой (stringified)
		const payload = {
			id: this.inboundId,
			settings: JSON.stringify({
				clients: [
					{
						id: userId,
						email: `u_${userId.slice(0, 8)}`,
						enable: true,
						flow,
						limitIp: 0,
						totalGB: 0,
						expiryTime: 0,
						tgId: "",
						subId: Math.random().toString(36).slice(2),
						reset: 0,
					},
				],
			}),
		};

		const addRes = await this.http.post(
			"/panel/api/inbounds/addClient",
			payload,
			{
				headers: { Accept: "application/json" },
			}
		);
		if (addRes.status !== 200) {
			throw new Error(`addClient failed: HTTP ${addRes.status}`);
		}

		const serverName =
			inbound.streamSettings?.realitySettings?.serverNames?.[0] ??
			"cloudflare.com";
		const pbk =
			inbound.streamSettings?.realitySettings?.settings?.publicKey ??
			env.VLESS_PUBLIC_KEY;
		const sid = (inbound.streamSettings?.realitySettings?.shortIds ?? [
			env.VLESS_SHORT_ID,
		])[0];
		const port = inbound.port ?? 443;

		return {
			id: userId,
			flow,
			key: this.buildVlessKey({ userId, flow, serverName, pbk, sid, port }),
		};
	}

	public async deleteUser(id: string): Promise<boolean> {
		await this.ensureLogin();
		// POST /panel/api/inbounds/:id/delClient/:clientId
		const res = await this.http.post(
			`/panel/api/inbounds/${this.inboundId}/delClient/${id}`,
			null,
			{
				headers: { Accept: "application/json" },
			}
		);
		if (res.status !== 200) {
			throw new Error(`delClient failed: HTTP ${res.status}`);
		}
		return true;
	}

	public async disableUser(id: string): Promise<boolean> {
		await this.ensureLogin();
		// Предпочтительно — updateClient с enable=false
		// POST /panel/api/inbounds/updateClient/:clientId
		const body = {
			id: this.inboundId,
			settings: JSON.stringify({
				clients: [{ id, enable: false }],
			}),
		};
		const res = await this.http.post(
			`/panel/api/inbounds/updateClient/${id}`,
			body,
			{
				headers: { Accept: "application/json" },
			}
		);

		// На старых билдах updateClient может отсутствовать — fallback на удаление
		if (res.status !== 200) {
			await this.deleteUser(id);
		}
		return true;
	}

	public async enableUser(id: string): Promise<boolean> {
		await this.ensureLogin();
		// Аналогично disable: пробуем updateClient enable=true, иначе — создать
		const body = {
			id: this.inboundId,
			settings: JSON.stringify({
				clients: [{ id, enable: true }],
			}),
		};
		const res = await this.http.post(
			`/panel/api/inbounds/updateClient/${id}`,
			body,
			{
				headers: { Accept: "application/json" },
			}
		);

		if (res.status !== 200) {
			// если не смогли обновить — создаём такого пользователя
			await this.createUser(id);
		}
		return true;
	}
}
