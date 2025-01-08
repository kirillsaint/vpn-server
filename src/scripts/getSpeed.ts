import { exec } from "child_process";
import util from "util";
import { handleError, retry } from "../utils";

const execAsync = util.promisify(exec);

export default async function getSpeed() {
	try {
		console.log("Checking if speedtest-cli is installed...");

		// Проверяем наличие speedtest-cli
		try {
			await execAsync("which speedtest-cli");

			console.log("speedtest-cli is already installed.");
		} catch (error) {
			console.log("speedtest-cli not found, installing...");
			try {
				await execAsync("sudo apt update");
			} catch (error) {}

			try {
				await execAsync("sudo apt install -y speedtest-cli");
			} catch (error) {}

			console.log("speedtest-cli installed successfully.");
		}

		console.log("Running speed test...");

		// Запускаем тест скорости
		const result = await retry(async () => {
			const response = await execAsync("speedtest-cli --json --secure");

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
		}, 3);

		return result;
	} catch (error: any) {
		console.error(`Error: ${error.message}`);
		handleError("getSpeed", `${error}`);
	}
}
