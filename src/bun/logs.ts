const MAX_LOGS = 1000;
let logs: string[] = [];

export function addLog(message: string) {
	logs.push(`[${new Date().toISOString()}] ${message}`);
	if (logs.length > MAX_LOGS) {
		logs = logs.slice(logs.length - MAX_LOGS);
	}
}

export function getLogs(): string[] {
	return [...logs];
}

export function clearLogs(): void {
	logs = [];
}
