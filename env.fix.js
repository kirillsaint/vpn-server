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
		console.log("killing ports");
		await exec("sudo kill -9 $(sudo lsof -t -i:3000) 2>/dev/null || true");
	} catch (error) {}
})();
