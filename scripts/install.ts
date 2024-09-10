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
		} catch (error) {
			console.error("Error installing Outline Server:", error);
		}

		// Отключение от сервера
		ssh.dispose();
	})
	.catch(err => {
		console.error("Error connecting to the server:", err);
	});
