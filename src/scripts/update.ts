/**
 * Скрипт, который можно запустить при обновлении серверов
 */
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

export async function disablePorts(execFunc: (command: string) => void) {
	await execFunc("sudo ufw default allow incoming");
	await execFunc("sudo ufw default allow outgoing");
	await execFunc("sudo ufw deny 25");
	await execFunc("sudo ufw deny 465");
	await execFunc("sudo ufw deny 587");
	await execFunc("sudo ufw --force enable");
}

disablePorts(async (command: string) => {
	console.log(command);
	const data = await execAsync(command);
	console.log(data);
});
