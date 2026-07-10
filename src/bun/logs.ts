const MAX_LOGS = 1000;
let logs: string[] = [];
type Listener = () => void;
const listeners = new Set<Listener>();

export function addLog(message: string) {
	logs.push(`[${new Date().toISOString()}] ${message}`);
	if (logs.length > MAX_LOGS) {
		logs = logs.slice(logs.length - MAX_LOGS);
	}
	listeners.forEach(fn => fn());
}

export function getLogs(): string[] {
	return [...logs];
}

export function clearLogs(): void {
	logs = [];
	listeners.forEach(fn => fn());
}

export function onLogsChange(listener: Listener): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
