const fs = require("fs");
const { execSync } = require("child_process");

function killPort(port, signal = "9") {
	if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
		throw new Error("Port must be an integer between 1 and 65535");
	}

	try {
		// lsof выводит только PIDs (-t) процессов, слушающих порт
		const out = execSync(
			`sudo lsof -nP -iTCP:${port} -sTCP:LISTEN -t`,
			{ encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] } // игнорируем stderr
		);
		const pids = out.split("\n").filter(Boolean);

		if (pids.length === 0) {
			console.log(`Port ${port} is free ✅`);
			return false;
		}

		console.log(`Port ${port} is busy. PIDs: ${pids.join(", ")}`);

		for (const pid of pids) {
			try {
				execSync(`sudo kill -${signal} ${pid}`);
				console.log(` → Killed PID ${pid} with SIG${signal}`);
			} catch (e) {
				console.error(` ⚠️  Could not kill PID ${pid}: ${e.message}`);
			}
		}
		return true;
	} catch (e) {
		// lsof возвращает код 1, если ничего не найдено — это не ошибка
		if (e.status === 1) {
			console.log(`Port ${port} is free ✅`);
			return false;
		}
		throw e; // всё остальное — неожиданная ошибка
	}
}

(async () => {
	try {
		if (fs.existsSync(".env")) {
			await fs.promises.copyFile(".env", "adolf.backup");
		} else {
			if (fs.existsSync("adolf.backup")) {
				await fs.promises.copyFile("adolf.backup", ".env");
			}
		}
	} catch (error) {}

	try {
		killPort(3000);
	} catch (error) {}
})();
