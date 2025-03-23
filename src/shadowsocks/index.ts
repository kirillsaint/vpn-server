import { ChildProcess, exec, spawn } from "child_process";
import cron from "node-cron";
import path from "path";
import util from "util";
import { env, outline } from "..";
import { User } from "../outline/types";
import { generatePort } from "../utils";

const execAsync = util.promisify(exec);

cron.schedule("0 0 * * *", async () => {
	await execAsync("pm2 flush");
});

export let SOCKS_PROCESS: {
	port: number | null;
	process: ChildProcess | null;
	user: User | null;
} = { port: null, process: null, user: null };

export function getSSLocalPath() {
	return path.join(
		`./bin/shadowsocks/${
			process.platform === "darwin" ? "macos" : "linux"
		}/ss-local`
	);
}

export async function startSSLocal() {
	console.log("starting ss-local");
	const localPort = await generatePort();
	SOCKS_PROCESS.port = localPort;
	const url = env.OUTLINE_API_URL;
	const parsedUrl = new URL(url);

	const user = await outline.createUser();
	SOCKS_PROCESS.user = user;

	const args = [
		"-s",
		parsedUrl.hostname,
		"-p",
		user.port.toString(),
		"-l",
		localPort.toString(),
		"-k",
		user.password,
		"-m",
		user.method,
		"-b",
		"0.0.0.0",
		"-u",
	];

	const process = spawn(getSSLocalPath(), args);

	process.stdout?.on("data", data => {
		console.log(`[ss-local:${localPort}] stdout: ${data}`);
	});

	process.stderr?.on("data", data => {
		console.error(`[ss-local:${localPort}] stderr: ${data}`);
	});

	process.on("close", async code => {
		console.log(`[ss-local:${localPort}] process exited with code ${code}`);
		if (SOCKS_PROCESS.user) {
			await outline.deleteUser(user.id);
		}
		SOCKS_PROCESS.process = null;
		SOCKS_PROCESS.port = null;
		SOCKS_PROCESS.user = null;
		await startSSLocal();
	});

	SOCKS_PROCESS.process = process;

	return localPort;
}

export async function stopSSLocal() {
	console.log("stopping ss-local");
	const { process, user } = SOCKS_PROCESS;
	if (process) {
		process?.kill();
		if (user) {
			await outline.deleteUser(user.id);
		}
		console.log(`[ss-local] stopped`);
		return;
	}
	console.error(`No ss-local process found`);
}

export async function getSocks5ProxyPort() {
	if (!SOCKS_PROCESS.process) {
		await startSSLocal();
	}

	return SOCKS_PROCESS.port;
}
