import { exec, spawn } from "child_process";
import cron from "node-cron";
import path from "path";
import util from "util";
import { env } from "..";
import { User } from "../outline/types";
import { generatePort } from "../utils";

const execAsync = util.promisify(exec);

cron.schedule("0 0 * * *", async () => {
	await execAsync("pm2 flush");
});

export const runningProcesses = new Map(); // Сохранение активных процессов

export function getSSLocalPath() {
	return path.join(
		`./bin/shadowsocks/${
			process.platform === "darwin" ? "macos" : "linux"
		}/ss-local`
	);
}

export async function startSSLocal(userId: string, userConfig: User) {
	const localPort = await generatePort();
	const url = env.OUTLINE_API_URL;
	const parsedUrl = new URL(url);

	const args = [
		"-s",
		parsedUrl.hostname,
		"-p",
		userConfig.port.toString(),
		"-l",
		localPort.toString(),
		"-k",
		userConfig.password,
		"-m",
		userConfig.method,
		"-b",
		"0.0.0.0",
		"-u",
	];

	const process = spawn(getSSLocalPath(), args);

	process.stdout?.on("data", data => {
		console.log(`[ss-local:${userId}:${localPort}] stdout: ${data}`);
	});

	process.stderr?.on("data", data => {
		console.error(`[ss-local:${userId}:${localPort}] stderr: ${data}`);
	});

	process.on("close", code => {
		console.log(
			`[ss-local:${userId}:${localPort}] process exited with code ${code}`
		);
		runningProcesses.delete(userId); // Удаляем процесс из отслеживаемых
	});

	runningProcesses.set(userId, { process, port: localPort });

	return localPort;
}

export async function stopSSLocal(userId: string) {
	const { process, port } = runningProcesses.get(userId);
	if (process) {
		process?.kill();
		runningProcesses.delete(userId);
		console.log(`[ss-local:${userId}:${port}] stopped`);
		return;
	}
	console.error(`No ss-local process found for user ${userId}`);
}
