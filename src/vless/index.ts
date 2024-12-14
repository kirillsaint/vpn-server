import { exec } from "child_process";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import util from "util";
import { env } from "..";
import type { Client, User, VlessConfig } from "./types";

const execAsync = util.promisify(exec);

interface Options {
	configPath: string;
}

class VlessVPN {
	configPath: string;

	constructor(options: Options) {
		this.configPath = options.configPath;
	}

	// Чтение конфигурационного файла V2Ray
	private async readConfig(): Promise<VlessConfig> {
		const data = await fs.readFile(this.configPath, "utf-8");
		return JSON.parse(data);
	}

	// Запись обновленного конфига в файл
	private async writeConfig(config: VlessConfig): Promise<void> {
		await fs.writeFile(
			this.configPath,
			JSON.stringify(config, null, 2),
			"utf-8"
		);
		await execAsync("systemctl restart xray");
	}

	// Получить всех пользователей
	public async getUsers(): Promise<User[]> {
		const config = await this.readConfig();
		const clients = config.inbounds[0].settings.clients;
		return clients.map((client: Client) => ({
			id: client.id,
			flow: client.flow || "",
			key: `vless://${client.id}@${
				new URL(env.OUTLINE_API_URL).hostname
			}:443?flow=${client.flow}&type=tcp&security=reality&fp=chrome&sni=${
				config.inbounds[0].streamSettings.realitySettings.serverNames[0]
			}&pbk=${env.VLESS_PUBLIC_KEY}&sid=${env.VLESS_SHORT_ID}&spx=%2F`,
		}));
	}

	// Получить пользователя по id
	public async getUser(id: string): Promise<User | null> {
		const config = await this.readConfig();
		const client = config.inbounds[0].settings.clients.find(
			user => user.id === id
		);
		if (client) {
			return {
				id: client.id,
				flow: client.flow || "",
				key: `vless://${client.id}@${
					new URL(env.OUTLINE_API_URL).hostname
				}:443?flow=${client.flow}&type=tcp&security=reality&fp=chrome&sni=${
					config.inbounds[0].streamSettings.realitySettings.serverNames[0]
				}&pbk=${env.VLESS_PUBLIC_KEY}&sid=${env.VLESS_SHORT_ID}&spx=%2F`,
			};
		}
		return null;
	}

	// Создать нового пользователя
	public async createUser(id?: string): Promise<User> {
		const newUser: Client = {
			id: id || randomUUID(),
			flow: "xtls-rprx-vision",
		};

		const config = await this.readConfig();
		config.inbounds[0].settings.clients.push(newUser);
		await this.writeConfig(config);

		return {
			id: newUser.id,
			flow: newUser.flow,
			key: `vless://${newUser.id}@${
				new URL(env.OUTLINE_API_URL).hostname
			}:443?flow=${newUser.flow}&type=tcp&security=reality&fp=chrome&sni=${
				config.inbounds[0].streamSettings.realitySettings.serverNames[0]
			}&pbk=${env.VLESS_PUBLIC_KEY}&sid=${env.VLESS_SHORT_ID}&spx=%2F`,
		};
	}

	// Удалить пользователя по id
	public async deleteUser(id: string): Promise<boolean> {
		let config = await this.readConfig();
		config.inbounds[0].settings.clients =
			config.inbounds[0].settings.clients.filter(e => e.id !== id);

		await this.writeConfig(config);
		return true;
	}

	// Отключить пользователа
	public async disableUser(id: string): Promise<boolean> {
		return this.deleteUser(id);
	}

	// Удалить лимит данных
	public async enableUser(id: string): Promise<boolean> {
		await this.createUser(id);
		return true;
	}
}

export { VlessVPN };
