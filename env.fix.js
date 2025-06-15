const fs = require("fs");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

(async () => {
	try {
		if (fs.existsSync(".env")) {
			await fs.promises.copyFile(".env", "env.backup");
		} else {
			if (fs.existsSync("env.backup")) {
				await fs.promises.copyFile("env.backup", ".env");
			}
		}
	} catch (error) {}

	try {
		console.log("killing port");
		await exec("sudo kill -9 $(sudo lsof -t -i:3000)");
	} catch (error) {}
})();
