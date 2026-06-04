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
exports.registerDefaultCommands = registerDefaultCommands;
exports.registerCommands = registerCommands;
const _1 = require(".");
const vscode = __importStar(require("vscode"));
/**
 * Registers the default commands which do not require extension enablement.
 * @param ctx The extension context.
 */
function registerDefaultCommands(ctx) {
    ctx.subscriptions.push(
    // Open Extension Log
    vscode.commands.registerCommand("forgevsc.openExtensionLog", () => {
        _1.Logger.show();
    }), 
    // Open Settings (Backend)
    vscode.commands.registerCommand("forgevsc.openSettings", async (setting, user = true) => {
        await vscode.commands.executeCommand("workbench.action." + (user ? "openSettings" : "openWorkspaceSettings"), setting?.trim() || "@ext:tryforge.forgevsc");
    }), 
    // Open Extension Settings (UI)
    vscode.commands.registerCommand("forgevsc.openExtensionSettings", async () => {
        const items = [];
        if (!!vscode.workspace.workspaceFolders?.length) {
            items.push({
                label: vscode.l10n.t("$(folder) Workspace Settings"),
                detail: vscode.workspace.name || vscode.l10n.t("Workspace"),
                description: vscode.l10n.t("Folder"),
                target: "workbench.action.openWorkspaceSettings"
            });
        }
        items.push({
            label: vscode.l10n.t("$(account) User Settings"),
            description: vscode.l10n.t("Global"),
            target: "workbench.action.openSettings"
        });
        const choice = await vscode.window.showQuickPick(items, {
            placeHolder: vscode.l10n.t("Which extension settings would you like to open?")
        });
        if (!choice)
            return;
        await vscode.commands.executeCommand(choice.target, "@ext:tryforge.forgevsc");
    }));
}
/**
 * Registers the commands which require extension enablement.
 * @param ctx The extension context.
 */
function registerCommands(ctx) {
    ctx.subscriptions.push(
    // Create Config
    vscode.commands.registerCommand("forgevsc.createConfig", async () => {
        const btnOpenSettings = vscode.l10n.t("Open Settings");
        const action = await vscode.window.showWarningMessage(vscode.l10n.t("The custom configuration file is deprecated and maintained only for legacy compatibility. Please use extension settings instead."), btnOpenSettings, vscode.l10n.t("Dismiss"));
        if (action === btnOpenSettings) {
            await vscode.commands.executeCommand("forgevsc.openSettings", undefined, false);
            return;
        }
        const folders = vscode.workspace.workspaceFolders;
        if (!folders?.length) {
            vscode.window.showErrorMessage(vscode.l10n.t("Open a workspace folder first."));
            return;
        }
        const root = folders[0].uri;
        const path = await (0, _1.findExtensionConfig)(root);
        let fileName = ".forgevsc.json";
        let uri;
        if (path) {
            const btnOpen = vscode.l10n.t("Open");
            const btnOverwrite = vscode.l10n.t("Overwrite");
            const action = await vscode.window.showWarningMessage(vscode.l10n.t("Extension config file already exists."), btnOpen, btnOverwrite, vscode.l10n.t("Cancel"));
            if (action === btnOpen) {
                const doc = await vscode.workspace.openTextDocument(path);
                await vscode.window.showTextDocument(doc);
                return;
            }
            if (action !== btnOverwrite)
                return;
            uri = path;
        }
        else {
            const choice = await vscode.window.showQuickPick([
                {
                    label: vscode.l10n.t("$(root-folder) Workspace Root"),
                    detail: fileName,
                    description: vscode.l10n.t("Default"),
                    target: vscode.Uri.joinPath(root, fileName)
                },
                {
                    label: vscode.l10n.t("$(folder) VSCode Folder"),
                    detail: ".vscode/" + fileName,
                    target: vscode.Uri.joinPath(root, ".vscode", fileName)
                }
            ], {
                placeHolder: vscode.l10n.t("Where do you want to create the config file?")
            });
            if (!choice)
                return;
            uri = choice.target;
            if (choice.detail.startsWith(".vscode")) {
                const dir = vscode.Uri.joinPath(root, ".vscode");
                try {
                    await vscode.workspace.fs.createDirectory(dir);
                }
                catch { }
            }
        }
        const { enabledWorkspaces, rpc, ...Config } = _1.Defaults;
        const content = JSON.stringify(Config, null, 2) + "\n";
        const text = new TextEncoder().encode(content);
        await vscode.workspace.fs.writeFile(uri, text);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage(path
            ? vscode.l10n.t("Config file overwritten successfully!")
            : vscode.l10n.t("Successfully created config file!"));
    }), 
    // Reload Function Metadata
    vscode.commands.registerCommand("forgevsc.reloadFunctionMetadata", async () => {
        await (0, _1.getFunctions)(true);
        vscode.window.showInformationMessage(vscode.l10n.t("Successfully fetched function metadata!"));
    }), 
    // Create Guide
    vscode.commands.registerCommand("forgevsc.createGuide", async () => {
        await vscode.env.openExternal(vscode.Uri.parse(_1.DocsUrl));
    }), 
    // Reconnect RPC
    vscode.commands.registerCommand("forgevsc.reconnectRPC", async () => {
        await (0, _1.disconnectRPC)();
        const connected = await (0, _1.connectRPC)();
        if (connected)
            await (0, _1.updateEditorRPC)(vscode.window.activeTextEditor);
    }));
}
//# sourceMappingURL=commands.js.map