import axios from "axios";
import { Buffer } from "buffer";
import http from "http";
import net from "net";
import NodeCache from "node-cache";
import { env } from "..";
import { generatePort, handleError } from "../utils";

const authCache = new NodeCache();

export const HTTPS_PROCESS = {
	port: null as number | null,
	server: null as http.Server | null,
};

/* --- проверяем заголовок Proxy-Authorization: Basic … --- */
async function verifyBasic(header?: string): Promise<boolean> {
	if (!header) return false;

	const [scheme, encoded] = header.split(" ");
	if (scheme.toLowerCase() !== "basic") return false;

	const decoded = Buffer.from(encoded, "base64").toString("utf8");
	const [token] = decoded.split(":"); // username = token

	try {
		let result: boolean | undefined = authCache.get(token);
		if (result === undefined) {
			const { data } = await axios.get(`https://${env.API_URL}/auth/me`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (data.user.subscription !== "none") {
				authCache.set(token, true, 1800);
				result = true;
			} else {
				result = false;
			}
		}

		return result;
	} catch (error) {
		await handleError("verify-basic", `${error}`);
		return false;
	}
}

/* --- ответ 407 или 403 --- */
function sendError(target: http.ServerResponse | net.Socket, code = 407) {
	const msg = `HTTP/1.1 ${code} ${
		code === 407 ? "Proxy Authentication Required" : "Forbidden"
	}\r\nProxy-Authenticate: Basic realm="VPN"\r\n\r\n`;

	"writeHead" in target
		? (target.writeHead(code, {
				"Proxy-Authenticate": 'Basic realm="VPN"',
		  }),
		  target.end("Bad credentials"))
		: (target.write(msg), (target as net.Socket).destroy());
}

/* ---------------- запуск прокси ---------------- */
export async function startHttpsProxy(): Promise<number> {
	const port = await generatePort();
	const server = http.createServer();

	/* ----- CONNECT (TLS-туннель) ----- */
	server.on(
		"connect",
		async (req: http.IncomingMessage, clientSock: net.Socket, head: Buffer) => {
			if (!(await verifyBasic(req.headers["proxy-authorization"] as string)))
				return sendError(clientSock); // 407

			const [host, p = "443"] = (req.url || "").split(":");
			const remote = net
				.connect(+p, host, () => {
					clientSock.write("HTTP/1.1 200 Connection Established\r\n\r\n");
					if (head.length) remote.write(head);
					remote.pipe(clientSock);
					clientSock.pipe(remote);
				})
				.on("error", () => clientSock.destroy());
		}
	);

	/* ----- обычный HTTP ----- */
	server.on("request", async (req, res) => {
		try {
			if (!(await verifyBasic(req.headers["proxy-authorization"] as string)))
				return sendError(res); // 407

			const url = new URL(req.url!, "http://dummy");
			const proxyReq = http.request(
				{
					host: url.hostname,
					port: url.port || 80,
					method: req.method,
					path: url.pathname + url.search,
					headers: { ...req.headers, host: url.host },
				},
				r => {
					res.writeHead(r.statusCode!, r.headers);
					r.pipe(res);
				}
			);

			proxyReq.on("error", () => res.end());
			req.pipe(proxyReq);
		} catch (error) {
			console.error(error);
			try {
				sendError(res, 500);
			} catch (error) {}
		}
	});

	server.listen(port, "0.0.0.0", () =>
		console.log(`[https-proxy] listening :${port}`)
	);

	HTTPS_PROCESS.port = port;
	HTTPS_PROCESS.server = server;
	return port;
}

/* ---------------- вспомогательные функции ---------------- */
export const stopHttpsProxy = () =>
	HTTPS_PROCESS.server
		? new Promise<void>(resolve =>
				HTTPS_PROCESS.server!.close(() => {
					console.log("[https-proxy] stopped");
					HTTPS_PROCESS.server = null;
					HTTPS_PROCESS.port = null;
					resolve();
				})
		  )
		: Promise.resolve();

export const getHttpsProxyPort = async () =>
	HTTPS_PROCESS.server ? HTTPS_PROCESS.port : startHttpsProxy();
