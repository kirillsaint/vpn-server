// src/socks5/server.ts
import { createServer, Socks5Server } from "@pondwader/socks5-server";
import { generatePort } from "../utils";

export let SOCKS_PROCESS: {
	port: number | null;
	server: Socks5Server | null;
} = {
	port: null,
	server: null,
};

/**
 * Запускает SOCKS5-сервер на новом порту.
 * При падении автоматически перезапустится через 5 сек.
 */
export async function startSocks5(): Promise<number> {
	console.log("starting socks5 proxy");

	// Генерируем свободный порт и сохраняем
	const localPort = await generatePort();
	SOCKS_PROCESS.port = localPort;

	// Запускаем сервер: по умолчанию слушает 0.0.0.0
	const server = createServer();
	SOCKS_PROCESS.server = server; // сохраняем экземпляр

	server.listen(localPort, "0.0.0.0", () => {
		console.log(`proxy listening on port ${localPort}`);
	});

	return localPort;
}

/**
 * Останавливает текущий SOCKS5-сервер (если запущен).
 */
export async function stopSocks5(): Promise<void> {
	console.log("stopping socks5 proxy");
	const { server, port } = SOCKS_PROCESS;
	if (server) {
		await new Promise<void>(resolve => server.close(() => resolve())); // server.close() вызывает 'close' :contentReference[oaicite:8]{index=8}
		console.log(`[socks5] stopped on port ${port}`);
		SOCKS_PROCESS.server = null;
		SOCKS_PROCESS.port = null;
	} else {
		console.error("No socks5 server running");
	}
}

/**
 * Возвращает порт SOCKS5-прокси, поднимая сервер при необходимости.
 */
export async function getSocks5ProxyPort(): Promise<number | null> {
	if (!SOCKS_PROCESS.server) {
		await startSocks5();
	}
	return SOCKS_PROCESS.port;
}
