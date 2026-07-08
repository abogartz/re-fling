import { BrowserWindow, Updater } from "electrobun/bun";
import { getLogs, clearLogs } from "../bun/logs";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// Check if Vite dev server is running for HMR
async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			console.warn(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
			return DEV_SERVER_URL;
		} catch {
			console.warn(
				"Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
			);
		}
	}
	return "views://mainview/index.html";
}

// Create the main application window
const url = await getMainViewUrl();

const mainWindow = new BrowserWindow({
	title: "React + Tailwind + Vite",
	url,
	frame: {
		width: 900,
		height: 700,
		x: 200,
		y: 200,
	},
});

// Set up custom message handler to intercept log-related messages
// before they hit the RPC system (which would throw "Unexpected RPC message type")
mainWindow.webview.rpcHandler = (msg: unknown) => {
	try {
		const message = typeof msg === "string" ? JSON.parse(msg) : msg;
		if (!message || !message.type) {
			// Pass through to default RPC handler
			return;
		}

		if (message.type === "open-logs") {
			openLogsWindow();
		}
	} catch (err) {
		console.error("[Logs IPC] Error handling message:", err);
	}
};

// Logs window management
let logsWindow: BrowserWindow | null = null;
let logsWindowOpen = false;

function openLogsWindow() {
	if (logsWindowOpen) {
		// Toggle: close if already open
		logsWindow?.close();
		logsWindow = null;
		logsWindowOpen = false;
		return;
	}

	logsWindow = new BrowserWindow({
		title: "ReFling Logs",
		url: "views://logsview/index.html",
		frame: {
			width: 600,
			height: 450,
			x: 300,
			y: 100,
		},
		titleBarStyle: "default",
	});

	logsWindowOpen = true;

	// Set up message handler for logs window
	logsWindow.webview.rpcHandler = (msg: unknown) => {
		try {
			const message = typeof msg === "string" ? JSON.parse(msg) : msg;
			if (!message || !message.type) {
				return;
			}

			if (message.type === "request-logs") {
				const logs = getLogs();
				logsWindow?.webview?.sendMessageToWebviewViaExecute(
					JSON.stringify({ type: "logs-update", logs }),
				);
			} else if (message.type === "clear-logs") {
				clearLogs();
				logsWindow?.webview?.sendMessageToWebviewViaExecute(
					JSON.stringify({ type: "logs-update", logs: [] }),
				);
			}
		} catch (err) {
			console.error("[Logs IPC] Error handling message:", err);
		}
	};

	// Send initial logs when window is ready
	setTimeout(() => {
		const logs = getLogs();
		if (logs.length > 0) {
			logsWindow?.webview?.sendMessageToWebviewViaExecute(
				JSON.stringify({ type: "logs-update", logs }),
			);
		}
	}, 500);

	logsWindow.on("close", () => {
		logsWindow = null;
		logsWindowOpen = false;
	});
}

// Send logs to the logs window (can be called from anywhere)
export function sendLogsToWindow(logs: string[]) {
	if (!logsWindow?.webview) {
		return;
	}
	logsWindow.webview.sendMessageToWebviewViaExecute(
		JSON.stringify({ type: "logs-update", logs }),
	);
}

// Clear logs in the logs window (can be called from anywhere)
export function clearLogsInWindow() {
	clearLogs();
	if (!logsWindow?.webview) {
		return;
	}
	logsWindow.webview.sendMessageToWebviewViaExecute(
		JSON.stringify({ type: "logs-update", logs: [] }),
	);
}

console.warn("React Tailwind Vite app started!");
