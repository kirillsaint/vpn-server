import express from "express";
import { load } from "ts-dotenv";
import { OutlineVPN } from "./outline";
import { runningProcesses, startSSLocal, stopSSLocal } from "./shadowsocks";
import { VlessVPN } from "./vless";

export const env = load({
	NODE_ENV: ["production" as const, "development" as const],
	PORT: Number,
	SECRET_KEY: String,
	OUTLINE_API_URL: String,
	OUTLINE_API_FINGERPRINT: String,
	VLESS_PUBLIC_KEY: String,
	VLESS_SHORT_ID: String,
});

const server = express();
const outline = new OutlineVPN({
	apiUrl: env.OUTLINE_API_URL,
	fingerprint: env.OUTLINE_API_FINGERPRINT,
});
const vless = new VlessVPN({ configPath: "/usr/local/etc/xray/config.json" });

server.use(express.json());

async function startAllShadowsocks() {
	const clients = await outline.getUsers();

	for (const client of clients) {
		const port = await startSSLocal(client.id, client);
		runningProcesses.set(client.id, { port });
	}
}

async function stopShadowsocks() {
	const clients = await outline.getUsers();

	for (const client of clients) {
		await stopSSLocal(client.id);
	}
	runningProcesses.clear();
}

server.get("/", async (req, res) => {
	return res.json({ error: false });
});

server.get("/clients", async (req, res) => {
	if (
		req.header("secret-key") !== env.SECRET_KEY &&
		env.NODE_ENV === "production"
	) {
		return res.status(403).send({ error: true, description: "Bad key" });
	}
	const clients = await outline.getUsers();
	return res.json({
		error: false,
		clients: await Promise.all(
			clients.map(async e => {
				let port = 0;
				let shadowsocks = runningProcesses.get(e.id);
				if (!shadowsocks) {
					port = await startSSLocal(e.id, e);
				} else {
					port = shadowsocks?.port;
				}
				return { ...e, socks_port: port };
			})
		),
	});
});

server.get("/vless/clients", async (req, res) => {
	if (
		req.header("secret-key") !== env.SECRET_KEY &&
		env.NODE_ENV === "production"
	) {
		return res.status(403).send({ error: true, description: "Bad key" });
	}
	const clients = await vless.getUsers();
	return res.json({ error: false, clients });
});

server.post("/clients/create", async (req, res) => {
	if (
		req.header("secret-key") !== env.SECRET_KEY &&
		env.NODE_ENV === "production"
	) {
		return res.status(403).send({ error: true, description: "Bad key" });
	}
	let newClient = await outline.createUser();
	if (req.body.name) {
		await outline.renameUser(newClient.id, req.body.name);
		newClient.name = req.body.name;
	}

	const port = await startSSLocal(newClient.id, newClient);

	return res.json({
		error: false,
		client: {
			...newClient,
			socks_port: port,
		},
	});
});

server.post("/vless/clients/create", async (req, res) => {
	if (
		req.header("secret-key") !== env.SECRET_KEY &&
		env.NODE_ENV === "production"
	) {
		return res.status(403).send({ error: true, description: "Bad key" });
	}
	let newClient = await vless.createUser();

	return res.json({
		error: false,
		client: newClient,
	});
});

server.get("/clients/get/:id", async (req, res) => {
	if (
		req.header("secret-key") !== env.SECRET_KEY &&
		env.NODE_ENV === "production"
	) {
		return res.status(403).send({ error: true, description: "Bad key" });
	}
	const client = await outline.getUser(req.params.id);
	if (!client) {
		return res.json({ error: true, description: "Client not found" });
	}
	let port = 0;
	let shadowsocks = runningProcesses.get(client.id);
	if (!shadowsocks) {
		port = await startSSLocal(client.id, client);
	} else {
		port = shadowsocks?.port;
	}

	return res.json({
		error: false,
		client: { ...client, socks_port: port },
	});
});

server.get("/vless/clients/get/:id", async (req, res) => {
	if (
		req.header("secret-key") !== env.SECRET_KEY &&
		env.NODE_ENV === "production"
	) {
		return res.status(403).send({ error: true, description: "Bad key" });
	}
	const client = await vless.getUser(req.params.id);
	if (!client) {
		return res.json({ error: true, description: "Client not found" });
	}

	return res.json({
		error: false,
		client: client,
	});
});

server.post("/clients/enable", async (req, res) => {
	if (
		req.header("secret-key") !== env.SECRET_KEY &&
		env.NODE_ENV === "production"
	) {
		return res.status(403).send({ error: true, description: "Bad key" });
	}
	const client = await outline.getUser(req.body.id);
	if (!client) {
		return res.json({ error: true, description: "Client not found" });
	}
	await startSSLocal(req.body.id, client);
	await outline.enableUser(client.id);

	return res.json({ error: false });
});

server.post("/vless/clients/enable", async (req, res) => {
	if (
		req.header("secret-key") !== env.SECRET_KEY &&
		env.NODE_ENV === "production"
	) {
		return res.status(403).send({ error: true, description: "Bad key" });
	}

	await vless.enableUser(req.body.id);

	return res.json({ error: false });
});

server.post("/clients/disable", async (req, res) => {
	if (
		req.header("secret-key") !== env.SECRET_KEY &&
		env.NODE_ENV === "production"
	) {
		return res.status(403).send({ error: true, description: "Bad key" });
	}
	const client = await outline.getUser(req.body.id);
	if (!client) {
		return res.json({ error: true, description: "Client not found" });
	}
	await stopSSLocal(req.body.id);
	await outline.disableUser(client.id);

	return res.json({ error: false });
});

server.post("/vless/clients/disable", async (req, res) => {
	if (
		req.header("secret-key") !== env.SECRET_KEY &&
		env.NODE_ENV === "production"
	) {
		return res.status(403).send({ error: true, description: "Bad key" });
	}
	const client = await vless.getUser(req.body.id);
	if (!client) {
		return res.json({ error: true, description: "Client not found" });
	}

	await vless.disableUser(client.id);

	return res.json({ error: false });
});

server.post("/clients/delete", async (req, res) => {
	try {
		if (
			req.header("secret-key") !== env.SECRET_KEY &&
			env.NODE_ENV === "production"
		) {
			return res.status(403).send({ error: true, description: "Bad key" });
		}
		const client = await outline.getUser(req.body.id);
		if (!client) {
			return res.json({ error: true, description: "Client not found" });
		}
		await stopSSLocal(req.body.id);
		await outline.deleteUser(client.id);

		return res.json({ error: false });
	} catch (error) {
		return res.json({ error: true, description: `${error}` });
	}
});

server.post("/vless/clients/delete", async (req, res) => {
	try {
		if (
			req.header("secret-key") !== env.SECRET_KEY &&
			env.NODE_ENV === "production"
		) {
			return res.status(403).send({ error: true, description: "Bad key" });
		}
		const client = await vless.getUser(req.body.id);
		if (!client) {
			return res.json({ error: true, description: "Client not found" });
		}

		await vless.deleteUser(client.id);

		return res.json({ error: false });
	} catch (error) {
		return res.json({ error: true, description: `${error}` });
	}
});

server.listen(env.PORT);

startAllShadowsocks();

process.once("SIGINT", stopShadowsocks);
process.once("SIGTERM", stopShadowsocks);
