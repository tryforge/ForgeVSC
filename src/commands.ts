import { Defaults, DocsUrl, getFunctions } from "."
import * as vscode from "vscode"

export function registerCommands(ctx: vscode.ExtensionContext) {
    ctx.subscriptions.push(
        // Create Config
        vscode.commands.registerCommand("forgevsc.createConfig", async () => {
            const folders = vscode.workspace.workspaceFolders
            if (!folders?.length) {
                vscode.window.showErrorMessage("Open a workspace folder first.")
                return
            }

            const root = folders[0].uri
            const uri = vscode.Uri.joinPath(root, ".forgevsc.json")

            try {
                await vscode.workspace.fs.stat(uri)
                const choice = await vscode.window.showWarningMessage(
                    "Extension config file (.forgevsc.json) already exists.",
                    "Open",
                    "Overwrite",
                    "Cancel"
                )
                if (choice === "Open") {
                    const doc = await vscode.workspace.openTextDocument(uri)
                    await vscode.window.showTextDocument(doc)
                    return
                }
                if (choice !== "Overwrite") return
            } catch { }

            const content = JSON.stringify(Defaults, null, 2) + "\n"
            await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"))

            const doc = await vscode.workspace.openTextDocument(uri)
            await vscode.window.showTextDocument(doc)

            vscode.window.showInformationMessage("Successfully created config file (.forgevsc.json)!")
        }),

        // Reload Function Metadata
        vscode.commands.registerCommand("forgevsc.reloadFunctionMetadata", async () => {
            await getFunctions(true)
            vscode.window.showInformationMessage("Successfully fetched function metadata!")
        }),

        // Open Extension Page
        vscode.commands.registerCommand("forgevsc.openExtensionPage", async () => {
            await vscode.commands.executeCommand(
                "workbench.extensions.action.showExtensionsWithIds",
                [ctx.extension.id]
            )
        }),

        // Create Guide
        vscode.commands.registerCommand("forgevsc.createGuide", async () => {
            await vscode.env.openExternal(vscode.Uri.parse(DocsUrl))
        })
    )
}