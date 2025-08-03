// services/marzban-vless.ts
import axios, { AxiosInstance } from "axios";
import { randomUUID } from "crypto";
import { env } from "..";

export interface Client {
	id: string; // UUID VLESS
	flow: "xtls-rprx-vision";
}
export interface User {
	id: string; // UUID VLESS
	flow: "xtls-rprx-vision";
	key: string; // vless://...
}

interface Options {
	baseUrl: string; // MARZBAN_URL, например http://127.0.0.1:8000
	username: string; // MARZBAN_USERNAME
	password: string; // MARZBAN_PASSWORD
	inboundTag: string; // MARZBAN_INBOUND_TAG, напр. "VLESS TCP REALITY"
	publicHost?: string; // для vless:// <id>@HOST:443
	serverName?: string; // VLESS_SERVER_NAME
	publicKey?: string; // VLESS_PUBLIC_KEY
	shortId?: string; // VLESS_SHORT_ID
	port?: number; // 443 по умолчанию
}

export class MarzbanVlessVPN {
	private http: AxiosInstance;
	private token: string | null = null;

	private baseUrl: string;
	private username: string;
	private password: string;

	private inboundTag: string;
	private publicHost: string;
	private serverName: string;
	private pbk: string;
	private sid: string;
	private port: number;

	constructor(opts?: Partial<Options>) {
		const base = (opts?.baseUrl ?? String(env.MARZBAN_URL)).replace(/\/+$/, "");
		this.baseUrl = base; // без /api
		this.username = opts?.username ?? String(env.MARZBAN_USERNAME);
		this.password = opts?.password ?? String(env.MARZBAN_PASSWORD);

		this.inboundTag =
			opts?.inboundTag ??
			String(env.MARZBAN_INBOUND_TAG || "VLESS TCP REALITY");
		this.publicHost =
			opts?.publicHost ??
			(() => {
				try {
					return new URL(
						env?.OUTLINE_API_URL ||
							process.env.OUTLINE_API_URL ||
							"http://127.0.0.1"
					).hostname;
				} catch {
					return "127.0.0.1";
				}
			})();

		this.serverName =
			opts?.serverName ?? String(env.VLESS_SERVER_NAME || "google.com");
		this.pbk = opts?.publicKey ?? String(env.VLESS_PUBLIC_KEY);
		this.sid = opts?.shortId ?? String(env.VLESS_SHORT_ID);
		this.port = Number(opts?.port ?? 443);

		this.http = axios.create({
			baseURL: this.baseUrl + "/api",
			validateStatus: () => true,
			timeout: 15_000,
		});
	}

	// --- auth ----------------------------------------------------
	private async ensureToken() {
		if (this.token) return;
		const res = await this.http.post(
			"/admin/token",
			new URLSearchParams({
				username: this.username,
				password: this.password,
			}),
			{ headers: { "Content-Type": "application/x-www-form-urlencoded" } }
		);
		if (res.status !== 200 || !res.data?.access_token) {
			throw new Error(`Marzban auth failed: HTTP ${res.status}`);
		}
		this.token = res.data.access_token; // /api/admin/token :contentReference[oaicite:14]{index=14}
		this.http.defaults.headers.common.Authorization = `Bearer ${this.token}`;
	}

	// --- helpers -------------------------------------------------
	private buildVlessKey(params: { userId: string }): string {
		// как и раньше: type=tcp&security=reality&fp=chrome&sni=<serverName>&pbk=<publicKey>&sid=<shortId>&spx=%2F
		return (
			`vless://${params.userId}@${this.publicHost}:${this.port}` +
			`?flow=xtls-rprx-vision&type=tcp&security=reality&fp=chrome` +
			`&sni=${encodeURIComponent(this.serverName)}` +
			`&pbk=${encodeURIComponent(this.pbk)}` +
			`&sid=${encodeURIComponent(this.sid)}` +
			`&spx=%2F`
		);
	}

	// --- public API ----------------------------------------------
	public async getUsers(): Promise<User[]> {
		await this.ensureToken();
		const res = await this.http.get("/users"); // список пользователей. :contentReference[oaicite:15]{index=15}
		if (res.status !== 200 || !Array.isArray(res.data)) {
			throw new Error(`Cannot list users: HTTP ${res.status}`);
		}
		// У Marzban UUID VLESS хранится в proxies.vless.id
		return res.data
			.map((u: any) => {
				const vlessId = u?.proxies?.vless?.id;
				// if (!vlessId) return null;
				return {
					id: vlessId || "unknown",
					flow: "xtls-rprx-vision" as const,
					key: this.buildVlessKey({ userId: vlessId }),
				};
			})
			.filter(Boolean);
	}

	public async getUser(id: string): Promise<User | null> {
		await this.ensureToken();
		const res = await this.http.get(`/users`); // нет прямого поиска по vless-id
		if (res.status !== 200 || !Array.isArray(res.data)) return null;
		const u = res.data.find((x: any) => x?.proxies?.vless?.id === id);
		if (!u) return null;
		return {
			id,
			flow: "xtls-rprx-vision",
			key: this.buildVlessKey({ userId: id }),
		};
	}

	public async createUser(id?: string): Promise<User> {
		await this.ensureToken();
		const username = (id || randomUUID()).replace(/-/g, "").slice(0, 24); // допустимая длина 3..32
		const body = {
			username,
			proxies: {
				vless: {
					/* пусто = сервер сам сгенерит uuid */
				},
			},
			inbounds: { vless: [this.inboundTag] },
			expire: 0,
			data_limit: 0,
			status: "active",
		}; // поля по API Add User. :contentReference[oaicite:16]{index=16}

		const res = await this.http.post("/user", body, {
			headers: { Accept: "application/json" },
		});
		if (res.status !== 200) {
			throw new Error(
				`add user failed: HTTP ${res.status} ${JSON.stringify(res.data)}`
			);
		}
		const vlessId = res.data?.proxies?.vless?.id;
		if (!vlessId) throw new Error("add user ok but vless id missing");
		return {
			id: vlessId,
			flow: "xtls-rprx-vision",
			key: this.buildVlessKey({ userId: vlessId }),
		};
	}

	public async deleteUser(id: string): Promise<boolean> {
		await this.ensureToken();
		// Пользователь адресуется username, а не uuid, поэтому найдём username
		const res = await this.http.get("/users");
		if (res.status !== 200) return false;
		const u = (res.data as any[]).find(x => x?.proxies?.vless?.id === id);
		if (!u?.username) return false;
		const del = await this.http.delete(
			`/user/${encodeURIComponent(u.username)}`
		); // Remove User. :contentReference[oaicite:17]{index=17}
		if (del.status !== 200)
			throw new Error(`delete failed: HTTP ${del.status}`);
		return true;
	}

	public async disableUser(id: string): Promise<boolean> {
		await this.ensureToken();
		const res = await this.http.get("/users");
		const u = (res.data as any[]).find(x => x?.proxies?.vless?.id === id);
		if (!u?.username) return false;
		const upd = await this.http.put(`/user/${encodeURIComponent(u.username)}`, {
			status: "disabled",
		}); // Modify User. :contentReference[oaicite:18]{index=18}
		return upd.status === 200;
	}

	public async enableUser(id: string): Promise<boolean> {
		await this.ensureToken();
		const res = await this.http.get("/users");
		const u = (res.data as any[]).find(x => x?.proxies?.vless?.id === id);
		if (!u?.username) return false;
		const upd = await this.http.put(`/user/${encodeURIComponent(u.username)}`, {
			status: "active",
		}); // Modify User. :contentReference[oaicite:19]{index=19}
		return upd.status === 200;
	}
}
