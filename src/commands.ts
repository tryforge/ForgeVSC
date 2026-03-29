import { Defaults, DocsUrl, findExtensionConfig, getFunctions, Logger } from "."
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
            const path = await findExtensionConfig(root)

            let fileName = ".forgevsc.json"
            let uri: vscode.Uri

            if (path) {
                const action = await vscode.window.showWarningMessage(
                    "Extension config file already exists.",
                    "Open",
                    "Overwrite",
                    "Cancel"
                )
                if (action === "Open") {
                    const doc = await vscode.workspace.openTextDocument(path)
                    await vscode.window.showTextDocument(doc)
                    return
                }
                if (action !== "Overwrite") return
                uri = path
            } else {
                const choice = await vscode.window.showQuickPick(
                    [
                        {
                            label: "$(root-folder) Workspace Root",
                            detail: fileName,
                            description: "Default",
                            target: vscode.Uri.joinPath(root, fileName)
                        },
                        {
                            label: "$(folder) VSCode Folder",
                            detail: ".vscode/" + fileName,
                            target: vscode.Uri.joinPath(root, ".vscode", fileName)
                        }
                    ],
                    {
                        placeHolder: "Where do you want to create the config file?"
                    }
                )
                if (!choice) return

                uri = choice.target
                if (choice.detail.startsWith(".vscode")) {
                    const dir = vscode.Uri.joinPath(root, ".vscode")
                    try {
                        await vscode.workspace.fs.createDirectory(dir)
                    } catch { }
                }
            }

            const content = JSON.stringify(Defaults, null, 2) + "\n"
            await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"))

            const doc = await vscode.workspace.openTextDocument(uri)
            await vscode.window.showTextDocument(doc)

            vscode.window.showInformationMessage(path
                ? "Config file overwritten successfully!"
                : "Successfully created config file!"
            )
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

        // Open Extension Log
        vscode.commands.registerCommand("forgevsc.openExtensionLog", async () => {
            Logger.show()
        }),

        // Create Guide
        vscode.commands.registerCommand("forgevsc.createGuide", async () => {
            await vscode.env.openExternal(vscode.Uri.parse(DocsUrl))
        })
    )
}