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
exports.registerCommands = registerCommands;
const _1 = require(".");
const vscode = __importStar(require("vscode"));
function registerCommands(ctx) {
    // Create Config
    ctx.subscriptions.push(vscode.commands.registerCommand("forgevsc.createConfig", async () => {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders?.length) {
            vscode.window.showErrorMessage("Open a workspace folder first.");
            return;
        }
        const root = folders[0].uri;
        const uri = vscode.Uri.joinPath(root, ".forgevsc.json");
        try {
            await vscode.workspace.fs.stat(uri);
            const choice = await vscode.window.showWarningMessage("Extension config file (.forgevsc.json) already exists.", "Open", "Overwrite", "Cancel");
            if (choice === "Open") {
                const doc = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(doc);
                return;
            }
            if (choice !== "Overwrite")
                return;
        }
        catch { }
        const content = JSON.stringify(_1.Defaults, null, 2) + "\n";
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage("Successfully created config file (.forgevsc.json)!");
    }));
    // Reload Metadata
    ctx.subscriptions.push(vscode.commands.registerCommand("forgevsc.reloadMetadata", async () => {
        await (0, _1.getFunctions)(true);
        vscode.window.showInformationMessage("Successfully fetched metadata!");
    }));
    // Open Extension Page
    ctx.subscriptions.push(vscode.commands.registerCommand("forgevsc.openExtensionPage", async () => {
        await vscode.commands.executeCommand("workbench.extensions.action.showExtensionsWithIds", [ctx.extension.id]);
    }));
}
//# sourceMappingURL=commands.js.map