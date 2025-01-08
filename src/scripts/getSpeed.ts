import { exec } from "child_process";
import util from "util";
import { handleError } from "../utils";

const execAsync = util.promisify(exec);

export default async function getSpeed() {
	try {
		console.log("Checking if speedtest-cli is installed...");

		// Проверяем наличие speedtest-cli
		const checkSpeedtest = await execAsync("which speedtest-cli");
		if (!checkSpeedtest.stdout) {
			console.log("speedtest-cli not found, installing...");
			await execAsync("sudo apt update");

			await execAsync("sudo apt install -y speedtest-cli");

			console.log("speedtest-cli installed successfully.");
		} else {
			console.log("speedtest-cli is already installed.");
		}

		console.log("Running speed test...");

		// Запускаем тест скорости
		const response = await execAsync("speedtest-cli --json --secure");

		if (response.stderr) {
			throw new Error(`Error running speedtest-cli: ${response.stderr}`);
		}

		const speedTestResult = JSON.parse(response.stdout);

		// Преобразуем результаты из бит/с в Мбит/с
		const downloadMbps = (speedTestResult.download / 1_000_000).toFixed(2);
		const uploadMbps = (speedTestResult.upload / 1_000_000).toFixed(2);

		console.log(`Download Speed: ${downloadMbps} Mbps`);
		console.log(`Upload Speed: ${uploadMbps} Mbps`);

		return {
			download: parseFloat(downloadMbps) * 100,
			upload: parseFloat(uploadMbps) * 100,
		};
	} catch (error: any) {
		console.error(`Error: ${error.message}`);
		handleError("getSpeed", `${error}`);
	}
}
