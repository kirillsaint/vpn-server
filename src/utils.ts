import * as net from "net";

export async function generatePort() {
	const blacklist = [
		// SMTP
		25, 465, 587,
		// Torrent
		6881, 6882, 6883, 6884, 6885, 6886, 6887, 6888, 6889,
	];

	while (true) {
		const port = Math.floor(Math.random() * (65535 - 1024 + 1)) + 1024; // Порты от 1024 до 65535
		if (!blacklist.includes(port)) {
			const available = await isPortAvailable(port);
			if (available) {
				return port;
			}
		}
	}
}

export function retry<T>(
	fn: () => Promise<T>,
	retries: number = 3
): Promise<T> {
	return new Promise((resolve, reject) => {
		const attempt = (retriesLeft: number) => {
			fn()
				.then(resolve)
				.catch(error => {
					if (retriesLeft === 1) {
						reject(error);
					} else {
						console.log(`Retrying... ${retriesLeft - 1} attempts left`);
						attempt(retriesLeft - 1);
					}
				});
		};

		attempt(retries);
	});
}

export const isPortAvailable = (port: number): Promise<boolean> => {
	return new Promise(resolve => {
		const server = net.createServer();

		server.once("error", err => {
			if (err.name === "EADDRINUSE") {
				resolve(false);
			} else {
				resolve(true);
			}
		});

		server.once("listening", () => {
			server.close(() => resolve(true));
		});

		server.listen(port);
	});
};
