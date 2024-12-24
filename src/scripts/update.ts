/**
 * Скрипт, который можно запустить при обновлении серверов
 */
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

async () => {
	const blacklist = [6881, 6882, 6883, 6884, 6885, 6886, 6887, 6888, 6889];

	for (const port of blacklist) {
		try {
			await execAsync(`sudo ufw deny ${port}`);
		} catch (error) {}
	}
};
