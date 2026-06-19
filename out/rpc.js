"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRPCStatusBar = createRPCStatusBar;
exports.updateRPCStatusBar = updateRPCStatusBar;
exports.connectRPC = connectRPC;
exports.disconnectRPC = disconnectRPC;
exports.updateRPC = updateRPC;
exports.updateEditorRPC = updateEditorRPC;
exports.registerRPC = registerRPC;
const _1 = require(".");
const vscode = __importStar(require("vscode"));
const CLIENT_ID = "1511962883993374791";
let rpc = null;
let rpcModule = null;
let connectingInterval = null;
let statusBar = null;
let startTimestamp = Date.now();
/**
 * Returns the repository URL of current workspace.
 * @returns
 */
async function getRepoUrl() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length)
        return null;
    try {
        const root = folders[0].uri;
        const uri = vscode.Uri.joinPath(root, ".git", "config");
        const raw = await vscode.workspace.fs.readFile(uri);
        const config = new TextDecoder().decode(raw);
        const match = config.match(/url = (.+)/);
        if (!match)
            return null;
        let url = match[1].trim();
        url = url
            .replace("git@", "https://")
            .replace(".com:", ".com/")
            .replace(".git", "");
        return url;
    }
    catch {
        return null;
    }
}
/**
 * Loads the RPC module.
 * @returns
 */
async function loadRPC() {
    if (vscode.env.uiKind === vscode.UIKind.Web) {
        _1.Logger.info("[RPC] Discord RPC disabled in web environment.");
        return null;
    }
    if (!rpcModule) {
        rpcModule = await import("@xhayper/discord-rpc");
    }
    return rpcModule.Client;
}
/**
 * Creates a new RPC status bar.
 * @param ctx The extension context.
 * @returns
 */
function createRPCStatusBar(ctx) {
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    statusBar.show();
    ctx.subscriptions.push(statusBar);
}
/**
 * Updates the RPC status bar.
 * @param connected Whether a connection has already been established.
 * @returns
 */
function updateRPCStatusBar(connected) {
    if (!statusBar)
        return;
    if (connected) {
        statusBar.text = vscode.l10n.t("$(plug) RPC Connected");
        statusBar.tooltip = vscode.l10n.t("Discord RPC Connected");
        statusBar.command = undefined;
    }
    else {
        statusBar.text = vscode.l10n.t("$(debug-disconnect) Reconnect RPC");
        statusBar.tooltip = vscode.l10n.t("Reconnect Discord RPC");
        statusBar.command = "forgevsc.reconnectRPC";
    }
}
/**
 * Starts the RPC status bar connecting animation.
 * @returns
 */
function startConnectingAnimation() {
    if (!statusBar)
        return;
    stopConnectingAnimation();
    let i = 0;
    connectingInterval = setInterval(() => {
        if (!statusBar)
            return;
        statusBar.text = vscode.l10n.t("$(sync~spin) Connecting RPC") + ".".repeat(i % 4);
        statusBar.tooltip = vscode.l10n.t("Connecting to Discord RPC...");
        i++;
    }, 400);
}
/**
 * Stops the RPC status bar connecting animation.
 * @returns
 */
function stopConnectingAnimation() {
    if (connectingInterval) {
        clearInterval(connectingInterval);
        connectingInterval = null;
    }
}
/**
 * Connects to Discord RPC.
 * @returns
 */
async function connectRPC() {
    if (vscode.env.uiKind === vscode.UIKind.Web)
        return false;
    if (rpc)
        return true;
    try {
        startConnectingAnimation();
        const Client = await loadRPC();
        if (!Client)
            return false;
        rpc = new Client({ clientId: CLIENT_ID });
        await rpc.login();
        stopConnectingAnimation();
        rpc.on("disconnected", () => {
            _1.Logger.warn("[RPC] Disconnected from Discord RPC.");
            rpc = null;
            updateRPCStatusBar(false);
        });
        updateRPCStatusBar(true);
        _1.Logger.info("[RPC] Connected to Discord RPC.");
        return true;
    }
    catch (error) {
        stopConnectingAnimation();
        updateRPCStatusBar(false);
        _1.Logger.error("[RPC] Failed to connect:", error);
        rpc = null;
        return false;
    }
}
/**
 * Disconnects from Discord RPC.
 * @returns
 */
async function disconnectRPC() {
    try {
        await rpc?.destroy();
    }
    catch { }
    rpc = null;
    updateRPCStatusBar(false);
}
/**
 * Updates the RPC activity.
 * @returns
 */
async function updateRPC(options) {
    if (!rpc?.user)
        return;
    options.largeImageKey ||= "forge";
    options.largeImageText ||= "BotForge";
    options.largeImageUrl ||= _1.DocsUrl;
    const repoUrl = await getRepoUrl();
    if (repoUrl) {
        options.buttons = [{
                label: "View Repository",
                url: repoUrl
            }];
    }
    try {
        await rpc.user.setActivity({
            ...options,
            startTimestamp
        });
    }
    catch (error) {
        _1.Logger.error("[RPC] Failed to update activity:", error);
    }
}
/**
 * Detects the language icon.
 * @returns
 */
function getLanguageAsset(languageId) {
    switch (languageId) {
        case "typescript":
            return {
                key: "ts",
                text: "TypeScript"
            };
        case "typescriptreact":
            return {
                key: "react",
                text: "TypeScript React"
            };
        case "javascript":
            return {
                key: "js",
                text: "JavaScript"
            };
        case "javascriptreact":
            return {
                key: "react",
                text: "JavaScript React"
            };
        case "json":
            return {
                key: "json",
                text: "JSON"
            };
        case "forge":
            return {
                key: "forgescript",
                text: "ForgeScript"
            };
        default:
            return undefined;
    }
}
/**
 * Updates RPC activity from the active editor.
 * @returns
 */
async function updateEditorRPC(editor) {
    if (!editor) {
        await updateRPC({
            details: "Idling...",
            largeImageKey: "idle"
        });
        return;
    }
    const document = editor.document;
    const fileName = document.fileName.split(/[\\/]/).pop() ?? "Unknown File";
    const asset = fileName === ".forgevsc.json" ? {
        key: "fvsc-config",
        text: "ForgeVSC Config"
    } : getLanguageAsset(document.languageId);
    await updateRPC({
        details: `Editing ${fileName}`,
        state: `Workspace: ${vscode.workspace.name}`,
        smallImageKey: asset?.key,
        smallImageText: asset?.text
    });
}
/**
 * Registers automatic RPC tracking.
 * @returns
 */
async function registerRPC(ctx) {
    const connected = await connectRPC();
    if (!connected)
        return;
    await updateEditorRPC(vscode.window.activeTextEditor);
    ctx.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        await updateEditorRPC(editor);
    }), vscode.workspace.onDidSaveTextDocument(async (document) => {
        const editor = vscode.window.activeTextEditor;
        if (editor?.document === document) {
            await updateEditorRPC(editor);
        }
    }), {
        dispose() {
            disconnectRPC();
        }
    });
}
//# sourceMappingURL=rpc.js.map