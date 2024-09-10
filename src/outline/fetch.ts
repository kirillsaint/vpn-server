import type { IncomingMessage } from "http";
import * as https from "https";
import { TLSSocket } from "tls";
import { urlToHttpOptions } from "url";
import type { HttpRequest, HttpResponse } from "./types";

export default async function fetchWithPin(
	req: HttpRequest,
	fingerprint: string,
	timeout: number = 10000
): Promise<HttpResponse> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await new Promise<IncomingMessage>((resolve, reject) => {
			const options: https.RequestOptions = {
				...urlToHttpOptions(new URL(req.url)),
				method: req.method,
				headers: req.headers,
				signal: controller.signal,
				rejectUnauthorized: false, // Disable certificate chain validation.
			};
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
				const socket = request.socket as TLSSocket;
				const cert = socket.getPeerCertificate();
				if (cert.fingerprint256 !== fingerprint) {
					reject(
						new Error(`Certificate fingerprint does not match ${fingerprint}`)
					);
				}
			});

			if (req.body) {
				request.write(req.body);
			}

			request.end();
		});

		const chunks: Buffer[] = [];
		for await (const chunk of response) {
			chunks.push(chunk);
		}

		return {
			status: response.statusCode,
			ok: response.statusCode
				? response.statusCode >= 200 && response.statusCode < 300
				: false,
			body: Buffer.concat(chunks).toString(),
		};
	} catch (error) {
		clearTimeout(timeoutId);
		throw error;
	}
}
