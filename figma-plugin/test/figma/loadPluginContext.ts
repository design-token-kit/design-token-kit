import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface PluginTestContext {
    sendMessage: (message: PluginMessage) => Promise<void>;
    postedMessages: Array<{ type: string; payload: unknown }>;
}

interface PluginMessage {
    type: string;
    accessToken?: string;
}

interface LoadPluginContextOptions {
    figma?: Record<string, unknown>;
    fetch?: typeof globalThis.fetch;
}

export function loadPluginContext(options: LoadPluginContextOptions = {}): PluginTestContext {
    const codePath = path.join(__dirname, "..", "..", ".figma-build", "code.js");
    const code = readFileSync(codePath, "utf8");
    const postedMessages: Array<{ type: string; payload: unknown }> = [];
    const context = {
        __html__: "",
        console: globalThis.console,
        fetch: options.fetch ?? globalThis.fetch,
        figma: {
            root: {
                id: "0:0",
                name: "Test File",
                children: [],
            },
            fileKey: "test-file-key",
            loadAllPagesAsync: async () => {},
            showUI() {},
            notify() {},
            ui: {
                postMessage(message: { type: string; payload: unknown }) {
                    postedMessages.push(message);
                },
            },
            ...(options.figma ?? {}),
        },
    };

    vm.createContext(context);
    vm.runInContext(code, context);

    return {
        postedMessages,
        async sendMessage(message: PluginMessage) {
            const pluginUi = context.figma.ui as { onmessage?: (message: PluginMessage) => Promise<void> };
            if (pluginUi.onmessage === undefined) {
                throw new Error("Plugin UI message handler was not registered.");
            }

            await pluginUi.onmessage(message);
        },
    };
}

export function toPlainJson<TValue>(value: TValue): TValue {
    return JSON.parse(JSON.stringify(value)) as TValue;
}
