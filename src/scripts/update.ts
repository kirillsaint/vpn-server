/**
 * Скрипт, который можно запустить при обновлении серверов
 */
import fs from "fs";

async function updateEnv() {
	await fs.promises.appendFile(".env", "\nAPI_URL=netblocknet.com");
}

updateEnv();
