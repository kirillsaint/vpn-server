import express from "express";
import { load } from "ts-dotenv";
import { OutlineVPN } from "./outline";
import { runningProcesses, startSSLocal, stopSSLocal } from "./shadowsocks";

export const env = load({
	NODE_ENV: ["production" as const, "development" as const],
	PORT: Number,
	SECRET_KEY: String,
	OUTLINE_API_URL: String,
	OUTLINE_API_FINGERPRINT: String,
});

const server = express();
const outline = new OutlineVPN({
	apiUrl: env.OUTLINE_API_URL,
	fingerprint: env.OUTLINE_API_FINGERPRINT,
});

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
		clients: clients.map(e => {
			return { ...e, socks_port: runningProcesses.get(e.id).port };
		}),
	});
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

	await startSSLocal(newClient.id, newClient);

	return res.json({ error: false, newClient });
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

	return res.json({
		error: false,
		client: { ...client, socks_port: runningProcesses.get(client.id).port },
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

server.listen(env.PORT);

startAllShadowsocks();

process.once("SIGINT", stopShadowsocks);
process.once("SIGTERM", stopShadowsocks);
