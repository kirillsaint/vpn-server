import axios from "axios";
import { Buffer } from "buffer";
import http, { IncomingMessage, ServerResponse } from "http";
import net from "net";
import NodeCache from "node-cache";
import util from "util";
import { env } from "..";
import { handleError } from "../utils";

const authCache = new NodeCache();
const execAsync = util.promisify(require("child_process").exec);

export const HTTPS_PROCESS = {
	port: null as number | null,
	server: null as http.Server | null,
};

/** Проверяем, запущен ли сервер и слушает ли он порт */
function isServerRunning(): boolean {
	return HTTPS_PROCESS.server?.listening ?? false;
}

/* -------------------------------------------------------------------------- */
/*                      Проверка заголовка Proxy‑Authorization                 */
/* -------------------------------------------------------------------------- */
async function verifyBasic(header?: string): Promise<boolean> {
	if (!header) return false;

	const [schemeRaw, encoded] = header.trim().split(/\s+/);
	if (schemeRaw?.toLowerCase() !== "basic" || !encoded) return false;

	let decoded: string;
	try {
		decoded = Buffer.from(encoded, "base64").toString("utf8");
	} catch {
		return false; // неправильная Base64‑строка
	}

	const [token] = decoded.split(":");
	if (!token) return false;

	try {
		let result: boolean | undefined = authCache.get(token);
		if (result === undefined) {
			/* гарантируем, что в env.API_URL нет протокола */
			const apiHost = env.API_URL.replace(/^https?:\/\//, "");
			const { data } = await axios.get(`https://${apiHost}/auth/me`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			result = data.user?.subscription !== "none";
			authCache.set(token, result, 1800); // 30 минут
		}

		return result;
	} catch (error: any) {
		if (!(error?.status === 401)) {
			await handleError("verify-basic", `${error}`);
		}
		return false;
	}
}

/* -------------------------------------------------------------------------- */
/*                       Формирование ответа с ошибкой                        */
/* -------------------------------------------------------------------------- */
function sendError(
	target: ServerResponse | net.Socket,
	code: 407 | 403 | 500 = 407
) {
	const statusMessage =
		code === 407
			? "Proxy Authentication Required"
			: code === 403
			? "Forbidden"
			: "Internal Server Error";

	const headerLines =
		code === 407 ? `Proxy-Authenticate: Basic realm="VPN"\r\n` : "";

	const msg = `HTTP/1.1 ${code} ${statusMessage}\r\n${headerLines}\r\n`;

	if ("writeHead" in target) {
		const res = target as ServerResponse;
		const headers: Record<string, string> = {};
		if (code === 407) headers["Proxy-Authenticate"] = 'Basic realm="VPN"';
		res.writeHead(code, headers);
		res.end(statusMessage);
	} else {
		const sock = target as net.Socket;
		sock.write(msg);
		sock.destroy();
	}
}

/* -------------------------------------------------------------------------- */
/*                           Запуск HTTPS‑прокси                              */
/* -------------------------------------------------------------------------- */
export async function startHttpsProxy(): Promise<number> {
	if (isServerRunning()) return HTTPS_PROCESS.port as number;

	const port = 6732;
	await execAsync("sudo kill -9 $(sudo lsof -t -i:3000)");
	const server = http.createServer();

	/* ------------------- CONNECT (TLS‑туннель) ------------------- */
	server.on(
		"connect",
		async (req: IncomingMessage, clientSock: net.Socket, head: Buffer) => {
			if (!(await verifyBasic(req.headers["proxy-authorization"] as string)))
				return sendError(clientSock); // 407

			const [host, p = "443"] = (req.url || "").split(":");
			const remote = net.connect(+p, host, () => {
				clientSock.write("HTTP/1.1 200 Connection Established\r\n\r\n");
				if (head.length) remote.write(head);
				remote.pipe(clientSock);
				clientSock.pipe(remote);
			});

			/* Симметричное закрытие */
			const cleanup = () => {
				clientSock.destroy();
				remote.destroy();
			};

			remote.on("error", cleanup);
			clientSock.on("error", cleanup);
			remote.on("close", cleanup);
			clientSock.on("close", cleanup);
		}
	);

	/* ----------------------- Обычный HTTP ------------------------ */
	server.on("request", async (req, res) => {
		try {
			if (!(await verifyBasic(req.headers["proxy-authorization"] as string)))
				return sendError(res); // 407

			const isAbsolute =
				req.url!.startsWith("http://") || req.url!.startsWith("https://");
			const dummyBase = `http://${req.headers.host ?? "dummy"}`;
			const url = new URL(isAbsolute ? req.url! : dummyBase + req.url!);

			/* исключаем Proxy‑Authorization, чтобы токен не утёк */
			const { ["proxy-authorization"]: _ignored, ...safeHeaders } = req.headers;

			const proxyReq = http.request(
				{
					host: url.hostname,
					port: url.port || 80,
					method: req.method,
					path: url.pathname + url.search,
					headers: { ...safeHeaders, host: url.host },
				},
				r => {
					res.writeHead(r.statusCode ?? 502, r.headers);
					r.pipe(res);
				}
			);

			proxyReq.on("error", () => res.end());
			req.pipe(proxyReq);
		} catch (error) {
			console.error(error);
			try {
				sendError(res, 500);
			} catch {
				/* игнорируем вторичную ошибку */
			}
		}
	});

	server.listen(port, "0.0.0.0", () =>
		console.log(`[https-proxy] listening :${port}`)
	);

	HTTPS_PROCESS.port = port;
	HTTPS_PROCESS.server = server;
	return port;
}

/* -------------------------------------------------------------------------- */
/*                       Управление жизненным циклом                          */
/* -------------------------------------------------------------------------- */
export const stopHttpsProxy = () =>
	HTTPS_PROCESS.server
		? new Promise<void>(resolve => {
				HTTPS_PROCESS.server!.close(() => {
					console.log("[https-proxy] stopped");
					HTTPS_PROCESS.server = null;
					HTTPS_PROCESS.port = null;
					resolve();
				});
		  })
		: Promise.resolve();

export const getHttpsProxyPort = async () =>
	isServerRunning() ? (HTTPS_PROCESS.port as number) : startHttpsProxy();
