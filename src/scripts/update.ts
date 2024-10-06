/**
 * Скрипт, который можно запустить при обновлении серверов
 */

import { exec, execSync } from "child_process";
import fs from "fs";
import util from "util";

const execAsync = util.promisify(exec);

export async function installVless() {
	await execAsync(
		"bash <(curl -Ls https://raw.githubusercontent.com/XTLS/Xray-install/main/install-release.sh)"
	);
	await execSync("mkdir -p /usr/local/etc/xray");
	const generateKeys = await execAsync("xray x25519");
	const privateKey = generateKeys.stdout.split("\n")[0].split(":")[1].trim();
	const publicKey = generateKeys.stdout.split("\n")[1].split(":")[1].trim();
	const env = (await fs.promises.readFile(".env")).toString();
	const shortId = await execAsync("head -c 16 /dev/urandom | xxd -ps -c 16");
	await fs.promises.rm(".env", { force: true, recursive: true });
	await fs.promises.writeFile(
		".env",
		`${env}\nVLESS_PUBLIC_KEY=${publicKey}\nVLESS_SHORT_ID=${shortId.stdout}`
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
							privateKey: privateKey,
							shortIds: [`${shortId.stdout}`],
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
