import { randomUUID } from "crypto";
import { NodeSSH } from "node-ssh";
import readlineSync from "readline-sync";

const ssh = new NodeSSH();

// Ввод данных от пользователя
const host = readlineSync.question("Enter your VPS IP address: ");
const username = readlineSync.question("Enter your VPS username: ");
const password = readlineSync.question("Enter your VPS password: ", {
	hideEchoBack: true,
});

async function installOutline(): Promise<{
	apiUrl: string;
	certSha256: string;
}> {
	console.log("Installing Outline Server...");

	const installCommand = `sudo bash -c "$(wget -qO- https://raw.githubusercontent.com/Jigsaw-Code/outline-server/master/src/server_manager/install_scripts/install_server.sh)"`;

	const result = await ssh.execCommand(installCommand, { stdin: "y" });

	if (result.stderr) {
		console.error("Error installing Outline Server:", result.stderr);
		throw new Error("unknown error");
	}

	console.log("Outline Server installed successfully");

	const match = result.stdout.match(/{.*}/);
	if (match) {
		const outlineConfig = JSON.parse(match[0]);
		console.log(JSON.stringify(outlineConfig));

		return outlineConfig;
	} else {
		throw new Error("unknown error");
	}
}

// Подключение к серверу по SSH
ssh
	.connect({
		host: host,
		username: username,
		password: password,
	})
	.then(async () => {
		console.log("Connected to the server");

		// Выполнение команд на сервере
		try {
			const outline = await installOutline();

			console.log("Installing NodeJS");
			await ssh.execCommand(
				"curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash && nvm install 18 && nvm use 18 && npm i -g yarn",
				{ stdin: "y" }
			);

			console.log("Installing VPN Server");

			await ssh.execCommand(
				"cd /root && git clone https://github.com/kirillsaint/vpn-server.git && cd vpn-server && yarn && yarn build && pm2 start dist/index.js --name vpn-server",
				{ stdin: "y" }
			);

			const env = `NODE_ENV=production\nPORT=3000\nSECRET_KEY=${randomUUID()}\nOUTLINE_API_URL=${
				outline.apiUrl
			}\nOUTLINE_API_FINGERPRINT=${randomUUID()}`;

			await ssh.execCommand(`echo -e "${env}" > /root/vpn-server/.env`, {
				stdin: "y",
			});
			console.log(".env file created successfully");
		} catch (error) {
			console.error("Error installing Outline Server:", error);
		}

		// Отключение от сервера
		ssh.dispose();
	})
	.catch(err => {
		console.error("Error connecting to the server:", err);
	});
