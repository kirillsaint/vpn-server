const fs = require("fs");

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
})();
