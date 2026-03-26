"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommands = registerCommands;
const _1 = require(".");
const vscode_1 = __importDefault(require("vscode"));
function registerCommands(ctx) {
    ctx.subscriptions.push(
    // Create Config
    vscode_1.default.commands.registerCommand("forgevsc.createConfig", async () => {
        const folders = vscode_1.default.workspace.workspaceFolders;
        if (!folders?.length) {
            vscode_1.default.window.showErrorMessage("Open a workspace folder first.");
            return;
        }
        const root = folders[0].uri;
        const path = await (0, _1.findExtensionConfig)(root);
        let fileName = ".forgevsc.json";
        let uri;
        if (path) {
            const action = await vscode_1.default.window.showWarningMessage("Extension config file already exists.", "Open", "Overwrite", "Cancel");
            if (action === "Open") {
                const doc = await vscode_1.default.workspace.openTextDocument(path);
                await vscode_1.default.window.showTextDocument(doc);
                return;
            }
            if (action !== "Overwrite")
                return;
            uri = path;
        }
        else {
            const choice = await vscode_1.default.window.showQuickPick([
                {
                    label: "$(root-folder) Workspace Root",
                    detail: fileName,
                    description: "Default",
                    target: vscode_1.default.Uri.joinPath(root, fileName)
                },
                {
                    label: "$(folder) VSCode Folder",
                    detail: ".vscode/" + fileName,
                    target: vscode_1.default.Uri.joinPath(root, ".vscode", fileName)
                }
            ], {
                placeHolder: "Where do you want to create the config file?"
            });
            if (!choice)
                return;
            uri = choice.target;
            if (choice.detail.startsWith(".vscode")) {
                const dir = vscode_1.default.Uri.joinPath(root, ".vscode");
                try {
                    await vscode_1.default.workspace.fs.createDirectory(dir);
                }
                catch { }
            }
        }
        const content = JSON.stringify(_1.Defaults, null, 2) + "\n";
        await vscode_1.default.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));
        const doc = await vscode_1.default.workspace.openTextDocument(uri);
        await vscode_1.default.window.showTextDocument(doc);
        vscode_1.default.window.showInformationMessage(path
            ? "Config file overwritten successfully!"
            : "Successfully created config file!");
    }), 
    // Reload Function Metadata
    vscode_1.default.commands.registerCommand("forgevsc.reloadFunctionMetadata", async () => {
        await (0, _1.getFunctions)(true);
        vscode_1.default.window.showInformationMessage("Successfully fetched function metadata!");
    }), 
    // Open Extension Page
    vscode_1.default.commands.registerCommand("forgevsc.openExtensionPage", async () => {
        await vscode_1.default.commands.executeCommand("workbench.extensions.action.showExtensionsWithIds", [ctx.extension.id]);
    }), 
    // Open Extension Log
    vscode_1.default.commands.registerCommand("forgevsc.openExtensionLog", async () => {
        _1.Logger.show();
    }), 
    // Create Guide
    vscode_1.default.commands.registerCommand("forgevsc.createGuide", async () => {
        await vscode_1.default.env.openExternal(vscode_1.default.Uri.parse(_1.DocsUrl));
    }));
}
//# sourceMappingURL=commands.js.map