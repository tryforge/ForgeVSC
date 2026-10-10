"use strict";
/*
* SPDX-License-Identifier: LGPL-3.0-or-later
* Copyright © 2026 BotForge
*/
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
exports.clearRPC = clearRPC;
exports.updateRPC = updateRPC;
exports.updateEditorRPC = updateEditorRPC;
exports.queueRPCUpdate = queueRPCUpdate;
exports.refreshRPC = refreshRPC;
exports.registerRPC = registerRPC;
const _1 = require(".");
const vscode = __importStar(require("vscode"));
const CLIENT_ID = "1511962883993374791";
const MIN_UPDATE_INTERVAL = 5_000;
let rpc = null;
let rpcModule = null;
let connectingInterval = null;
let statusBar = null;
let updateTimer = null;
let idleTimer = null;
let lastUpdate = 0;
let currentFileKey;
let startTimestamp = Date.now();
let fileTimestamp = Date.now();
/**
 * Truncates the specified value to the maximum allowed length.
 * @param value The value to truncate.
 */
function truncate(value) {
    const val = value?.trim();
    if (!val || val.length < 2)
        return undefined;
    return val.length > 128 ? val.slice(0, 125) + "..." : val;
}
/**
 * Renders the given template and replaces all placeholders.
 * @param template The template string.
 * @param ctx The RPC context.
 */
function render(template, ctx) {
    if (!template)
        return undefined;
    return truncate(template.replace(/\{(\w+)\}/g, (m, key) => key in ctx ? String(ctx[key] ?? "") : m));
}
/**
 * Returns the branch of current GitHub workspace.
 */
async function getGitBranch() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length)
        return undefined;
    try {
        const raw = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(folders[0].uri, ".git", "HEAD"));
        return new TextDecoder().decode(raw).match(/ref: refs\/heads\/(.+)/)?.[1]?.trim();
    }
    catch {
        return undefined;
    }
}
/**
 * Builds the RPC context, a record of placeholders and corresponding values.
 * @param editor The current text editor.
 * @param asset The RPC asset to use.
 */
async function buildContext(editor, asset) {
    const doc = editor?.document;
    const fileName = doc?.fileName.split(/[\\/]/).pop();
    return {
        file_name: fileName,
        file_extension: fileName?.includes(".") ? fileName.split(".").pop() : "",
        language: asset?.text ?? doc?.languageId,
        workspace: vscode.workspace.name,
        folder: vscode.workspace.workspaceFolders?.[0]?.name,
        line: editor ? editor.selection.active.line + 1 : undefined,
        column: editor ? editor.selection.active.character + 1 : undefined,
        total_lines: doc?.lineCount,
        git_branch: await getGitBranch(),
        extension_version: vscode.extensions.getExtension("tryforge.forgevsc")?.packageJSON.version
    };
}
/**
 * Builds the activity buttons for the RPC.
 */
async function buildButtons() {
    const config = (0, _1.getExtensionConfig)().rpc;
    const buttons = [];
    if (config.showRepositoryButton) {
        const repoUrl = await getRepoUrl();
        if (repoUrl)
            buttons.push({ label: "View Repository", url: repoUrl });
    }
    for (const button of config.buttons ?? []) {
        if (!button?.label || !/^https?:\/\//.test(button.url ?? ""))
            continue;
        buttons.push({
            label: button.label.slice(0, 32),
            url: button.url
        });
    }
    return buttons.slice(0, 2); // Max 2 buttons
}
/**
 * Builds the image fields of the activity.
 * @param brandKey The asset key of the image.
 * @param asset The language asset.
 * @param ctx The RPC context.
 */
function buildImages(brandKey, asset, ctx) {
    const config = (0, _1.getExtensionConfig)().rpc;
    const swap = !!config.swapImages && !!asset;
    const largeKey = swap ? asset.key : brandKey;
    const smallKey = asset ? (swap ? brandKey : asset.key) : undefined;
    return {
        largeImageKey: largeKey,
        largeImageText: render(config.largeImageText, ctx),
        largeImageUrl: _1.DocsUrl,
        smallImageKey: smallKey,
        smallImageText: smallKey ? render(config.smallImageText, ctx) : undefined
    };
}
/**
 * Returns whether the current workspace is ignored.
 */
function isWorkspaceIgnored() {
    const { ignoredWorkspaces } = (0, _1.getExtensionConfig)().rpc;
    if (!ignoredWorkspaces?.length)
        return false;
    const names = [vscode.workspace.name, ...(vscode.workspace.workspaceFolders?.map((x) => x.name) ?? [])];
    return names.some((n) => !!n && ignoredWorkspaces.includes(n));
}
/**
 * Returns the repository URL of current workspace.
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
 */
function createRPCStatusBar(ctx) {
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    statusBar.show();
    ctx.subscriptions.push(statusBar);
}
/**
 * Updates the RPC status bar.
 * @param connected Whether a connection has already been established.
 */
function updateRPCStatusBar(connected) {
    if (!statusBar)
        return;
    if (!(0, _1.getExtensionConfig)().rpc.enabled) {
        statusBar.hide();
        return;
    }
    statusBar.show();
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
 */
function stopConnectingAnimation() {
    if (connectingInterval) {
        clearInterval(connectingInterval);
        connectingInterval = null;
    }
}
/**
 * Connects to the Discord RPC.
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
 * Disconnects from the Discord RPC.
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
 * Clears the RPC activity.
 */
async function clearRPC() {
    try {
        await rpc?.user?.clearActivity();
    }
    catch { }
}
/**
 * Updates the RPC activity.
 */
async function updateRPC(options) {
    if (!rpc?.user)
        return;
    const config = (0, _1.getExtensionConfig)().rpc;
    options.largeImageKey ||= "forge";
    options.largeImageUrl ||= _1.DocsUrl;
    const buttons = await buildButtons();
    if (buttons.length)
        options.buttons = buttons;
    const timestamp = config.timestamp === "file"
        ? fileTimestamp
        : config.timestamp === "none"
            ? undefined
            : startTimestamp;
    try {
        await rpc.user.setActivity({ ...options, startTimestamp: timestamp });
    }
    catch (error) {
        _1.Logger.error("[RPC] Failed to update activity:", error);
    }
}
/**
 * Detects the language icon.
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
 * Resolves the language asset. The extension config file gets its own asset.
 * @param doc The current text document.
 */
function resolveAsset(doc) {
    if (!doc)
        return undefined;
    const fileName = doc.fileName.split(/[\\/]/).pop() ?? "";
    if (fileName === ".forgevsc.json" || fileName === "forgevsc.json") {
        return {
            key: "fvsc-config",
            text: "ForgeVSC Config"
        };
    }
    return getLanguageAsset(doc.languageId);
}
/**
 * Updates RPC activity from the active editor.
 * @param editor The current text editor.
 * @param idle Whether the activity reached idle mode.
 */
async function updateEditorRPC(editor, idle = false) {
    if (!rpc?.user)
        return;
    const config = (0, _1.getExtensionConfig)().rpc;
    if (!config.enabled || isWorkspaceIgnored()) {
        await clearRPC();
        return;
    }
    const key = editor?.document.uri.toString();
    if (key !== currentFileKey) {
        currentFileKey = key;
        fileTimestamp = Date.now();
    }
    if (idle || !editor) {
        const ctx = await buildContext(editor);
        await updateRPC({
            details: render(config.detailsIdling, ctx),
            state: render(config.stateIdling, ctx),
            ...buildImages("idle", undefined, ctx)
        });
        return;
    }
    const asset = resolveAsset(editor.document);
    const ctx = await buildContext(editor, asset);
    await updateRPC({
        details: render(config.details, ctx),
        state: render(config.state, ctx),
        ...buildImages("forge", asset, ctx)
    });
}
/**
 * Resets the idle timer.
 */
function resetIdleTimer() {
    if (idleTimer)
        clearTimeout(idleTimer);
    const minutes = (0, _1.getExtensionConfig)().rpc.idleTimeout;
    if (!minutes || minutes <= 0)
        return;
    idleTimer = setTimeout(() => queueRPCUpdate(true), minutes * 60_000);
}
/**
 * Queues the RPC update.
 * @param idle Whether the activity reached idle mode.
 */
function queueRPCUpdate(idle = false) {
    if (!idle)
        resetIdleTimer();
    if (updateTimer)
        clearTimeout(updateTimer);
    const wait = Math.max(500, MIN_UPDATE_INTERVAL - (Date.now() - lastUpdate));
    updateTimer = setTimeout(() => {
        updateTimer = null;
        lastUpdate = Date.now();
        void updateEditorRPC(vscode.window.activeTextEditor, idle);
    }, wait);
}
/**
 * Returns whether specific properties use placeholders.
 * @param keys The placeholder keys.
 */
function usesPlaceholder(...keys) {
    const { details, state, smallImageText, largeImageText } = (0, _1.getExtensionConfig)().rpc;
    return [details, state, smallImageText, largeImageText].some((x) => keys.some((key) => x?.includes(`{${key}}`)));
}
/**
 * Refreshes the RPC connection.
 */
async function refreshRPC() {
    if (vscode.env.uiKind === vscode.UIKind.Web)
        return;
    if (!(0, _1.getExtensionConfig)().rpc.enabled) {
        await clearRPC();
        await disconnectRPC();
        return;
    }
    if (!rpc && !(await connectRPC()))
        return;
    resetIdleTimer();
    await updateEditorRPC(vscode.window.activeTextEditor);
}
/**
 * Registers automatic RPC tracking.
 */
async function registerRPC(ctx) {
    ctx.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => queueRPCUpdate()), vscode.workspace.onDidSaveTextDocument(() => queueRPCUpdate()), vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document === vscode.window.activeTextEditor?.document)
            queueRPCUpdate();
    }), vscode.window.onDidChangeTextEditorSelection(() => {
        if (usesPlaceholder("line", "column"))
            queueRPCUpdate();
    }), {
        dispose() {
            if (updateTimer)
                clearTimeout(updateTimer);
            if (idleTimer)
                clearTimeout(idleTimer);
            disconnectRPC();
        }
    });
    if (!(0, _1.getExtensionConfig)().rpc.enabled)
        return;
    if (await connectRPC()) {
        resetIdleTimer();
        await updateEditorRPC(vscode.window.activeTextEditor);
    }
}
//# sourceMappingURL=rpc.js.map