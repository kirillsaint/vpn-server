// src/socks5/server.ts
import cron from "node-cron";
import { createServer as createSocksServer, auth as socksAuth } from "socksv5";
import util from "util";
import { generatePort } from "../utils";

const execAsync = util.promisify(require("child_process").exec);

// каждый день в полночь чистим логи pm2
cron.schedule("0 0 * * *", async () => {
	await execAsync("pm2 flush");
});

export let SOCKS_PROCESS: {
	port: number | null;
	server: ReturnType<typeof createSocksServer> | null;
} = {
	port: null,
	server: null,
};

export async function startSocks5() {
	console.log("starting socks5 proxy");

	// выбрали порт и запомним
	const localPort = await generatePort();
	SOCKS_PROCESS.port = localPort;

	// создаём SOCKS5-сервер без аутентификации
	const server = createSocksServer((info: any, accept: any, deny: any) => {
		// info: { srcAddr, srcPort, dstAddr, dstPort, command }
		accept();
	});
	server.useAuth(socksAuth.None());

	server.on("error", (err: any) => {
		console.error(`[socks5:${localPort}] error:`, err);
		// при падении — зануляем и перезапускаем
		SOCKS_PROCESS.server = null;
		SOCKS_PROCESS.port = null;
		setTimeout(() => startSocks5(), 5000);
	});

	server.on("close", () => {
		console.warn(`[socks5:${localPort}] closed, restarting in 5s`);
		SOCKS_PROCESS.server = null;
		SOCKS_PROCESS.port = null;
		setTimeout(() => startSocks5(), 5000);
	});

	server.listen(localPort, "0.0.0.0", () => {
		console.log(`[socks5] listening on 0.0.0.0:${localPort}`);
	});

	SOCKS_PROCESS.server = server;
	return localPort;
}

export async function stopSocks5() {
	console.log("stopping socks5 proxy");
	if (SOCKS_PROCESS.server) {
		await new Promise<void>(resolve =>
			SOCKS_PROCESS.server!.close(() => resolve())
		);
		console.log(`[socks5] stopped on port ${SOCKS_PROCESS.port}`);
		SOCKS_PROCESS.server = null;
		SOCKS_PROCESS.port = null;
		return;
	}
	console.error("No socks5 server running");
}

export async function getSocks5ProxyPort() {
	if (!SOCKS_PROCESS.server) {
		await startSocks5();
	}
	return SOCKS_PROCESS.port;
}
