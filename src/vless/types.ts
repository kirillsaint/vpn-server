export interface VlessConfig {
	log: {
		loglevel: "warning";
	};
	inbounds: [
		{
			listen: "0.0.0.0";
			port: 443;
			protocol: "vless";
			settings: {
				clients: Client[];
				decryption: "none";
			};
			streamSettings: {
				network: "tcp";
				security: "reality";
				realitySettings: {
					dest: string;
					serverNames: string[];
					privateKey: string;
					shortIds: string[];
				};
			};
			sniffing: {
				enabled: true;
				destOverride: ["http", "tls", "quic"];
			};
		}
	];
	outbounds: [
		{
			protocol: "freedom";
			tag: "direct";
		},
		{
			protocol: "blackhole";
			tag: "block";
		}
	];
}

export interface Client {
	id: string;
	flow: "xtls-rprx-vision";
}

export interface User {
	id: string;
	flow: "xtls-rprx-vision";
	key: string;
}
