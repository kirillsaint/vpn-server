/**
 * Скрипт, который можно запустить при обновлении серверов
 */

import { exec, execSync } from "child_process";
import fs from "fs";
import util from "util";

const execAsync = util.promisify(exec);

export async function installVless() {
	await execAsync(
		`bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install`
	);
	await execSync("mkdir -p /usr/local/etc/xray");
	const generateKeys = await execAsync("xray x25519");
	const privateKey = generateKeys.stdout.split("\n")[0].split(":")[1].trim();
	const publicKey = generateKeys.stdout.split("\n")[1].split(":")[1].trim();
	const env = (await fs.promises.readFile(".env")).toString();
	const shortId = await execAsync("head -c 8 /dev/urandom | xxd -ps -c 8");
	await fs.promises.rm(".env", { force: true, recursive: true });
	await fs.promises.writeFile(
		".env",
		`${env}\nVLESS_PUBLIC_KEY=${publicKey}\nVLESS_SHORT_ID=${shortId.stdout.trim()}`
	);
	await fs.promises.writeFile(
		"/usr/local/etc/xray/config.json",
		JSON.stringify({
			log: {
				access: "/var/log/xray/access.log",
				error: "/var/log/xray/error.log",
				loglevel: "warning",
			},
			inbounds: [
				{
					port: 443,
					protocol: "vless",
					settings: {
						clients: [],
						decryption: "none",
					},
					streamSettings: {
						network: "tcp",
						security: "reality",
						realitySettings: {
							show: false,
							dest: "google.com:443",
							xver: 0,
							serverNames: ["google.com"],
							privateKey: privateKey.trim(),
							shortIds: [`${shortId.stdout.trim()}`],
						},
					},
				},
			],
			outbounds: [
				{
					protocol: "freedom",
					settings: {},
				},
			],
		})
	);
	await execAsync("systemctl restart xray & systemctl enable xray");
}

installVless();
