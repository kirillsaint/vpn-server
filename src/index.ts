import axios from "axios";
import express from "express";
import cron from "node-cron";
import { load } from "ts-dotenv";
import { OutlineVPN } from "./outline";
import random from "./random";
import getSpeed from "./scripts/getSpeed";
import { getSocks5ProxyPort, startSSLocal, stopSSLocal } from "./shadowsocks";
import { getLoad, getServerIPs, handleError, sleep } from "./utils";
import { VlessVPN } from "./vless";

export const env = load({
	NODE_ENV: ["production" as const, "development" as const],
	API_URL: String,
	PORT: Number,
	SECRET_KEY: String,
	OUTLINE_API_URL: String,
	OUTLINE_API_FINGERPRINT: String,
	VLESS_PUBLIC_KEY: String,
	VLESS_SHORT_ID: String,
});

const server = express();
export const outline = new OutlineVPN({
	apiUrl: env.OUTLINE_API_URL,
	fingerprint: env.OUTLINE_API_FINGERPRINT,
});
const vless = new VlessVPN({ configPath: "/usr/local/etc/xray/config.json" });

server.use(express.json());

async function setIPv6() {
	try {
		const ips = getServerIPs();
		if (ips.ipv6) {
			await axios.post(`https://${env.API_URL}/server-api/set_ipv6`, {
				ip: ips.ipv4,
				key: env.SECRET_KEY,
				ipv6: ips.ipv6,
			});
		}
	} catch (error) {
		handleError("setIPv6", `${error}`);
	}
}

async function startAllShadowsocks() {
	await startSSLocal();
}

async function stopShadowsocks() {
	await stopSSLocal();
}

server.get("/", async (req, res) => {
	res.setHeader("Access-Control-Allow-Origin", "*");
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
				return { ...e, socks_port: await getSocks5ProxyPort() };
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

	return res.json({
		error: false,
		client: {
			...newClient,
			socks_port: await getSocks5ProxyPort(),
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

	return res.json({
		error: false,
		client: { ...client, socks_port: await getSocks5ProxyPort() },
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

server.get("/socks", async (req, res) => {
	if (
		req.header("secret-key") !== env.SECRET_KEY &&
		env.NODE_ENV === "production"
	) {
		return res.status(403).send({ error: true, description: "Bad key" });
	}
	return res.json({ error: false, port: await getSocks5ProxyPort() });
});

setIPv6();

server.listen(env.PORT);

startAllShadowsocks();

const updateSpeed = async () => {
	await sleep(180000 + random.number(5000, 600000));
	const speed = await getSpeed();
	if (speed) {
		try {
			await axios.post(`https://${env.API_URL}/server-api/set_speed`, {
				ip: getServerIPs().ipv4,
				key: env.SECRET_KEY,
				upload: speed.upload,
				download: speed.download,
			});
		} catch (error) {
			handleError("updateSpeed-request", `${error}`);
		}
	}
};
const updateLoad = async () => {
	const load = await getLoad();

	try {
		await axios.post(`https://${env.API_URL}/server-api/set_load`, {
			ip: getServerIPs().ipv4,
			key: env.SECRET_KEY,
			...load,
		});
	} catch (error) {
		handleError("setLoad-request", `${error}`);
	}
};
updateSpeed();

cron.schedule("*/30 * * * *", updateSpeed);
cron.schedule("* * * * *", updateLoad);

process.once("SIGINT", stopShadowsocks);
process.once("SIGTERM", stopShadowsocks);
