import { Defaults, DocsUrl, findExtensionConfig, getFunctions, Logger } from "."
import * as vscode from "vscode"

/**
 * Registers the default commands which do not require extension enablement.
 * @param ctx The extension context.
 */
export function registerDefaultCommands(ctx: vscode.ExtensionContext) {
    ctx.subscriptions.push(
        // Open Extension Log
        vscode.commands.registerCommand("forgevsc.openExtensionLog", () => {
            Logger.show()
        }),

        // Open Settings (Backend)
        vscode.commands.registerCommand("forgevsc.openSettings", async (setting?: string, user: boolean = true) => {
            await vscode.commands.executeCommand(
                "workbench.action." + (user ? "openSettings" : "openWorkspaceSettings"),
                setting?.trim() || "@ext:tryforge.forgevsc"
            )
        }),

        // Open Extension Settings (UI)
        vscode.commands.registerCommand("forgevsc.openExtensionSettings", async () => {
            const items = []

            if (!!vscode.workspace.workspaceFolders?.length) {
                items.push({
                    label: "$(folder) Workspace Settings",
                    detail: vscode.workspace.name || "Workspace",
                    description: "Folder",
                    target: "workbench.action.openWorkspaceSettings"
                })
            }

            items.push({
                label: "$(account) User Settings",
                description: "Global",
                target: "workbench.action.openSettings"
            })

            const choice = await vscode.window.showQuickPick(items, {
                placeHolder: "Which extension settings would you like to open?"
            })
            if (!choice) return

            await vscode.commands.executeCommand(choice.target, "@ext:tryforge.forgevsc")
        })
    )
}

/**
 * Registers the commands which require extension enablement.
 * @param ctx The extension context.
 */
export function registerCommands(ctx: vscode.ExtensionContext) {
    ctx.subscriptions.push(
        // Create Config
        vscode.commands.registerCommand("forgevsc.createConfig", async () => {
            const action = await vscode.window.showWarningMessage(
                "The custom configuration file is deprecated and maintained only for legacy compatibility. Please use extension settings instead.",
                "Open Settings",
                "Dismiss"
            )
            if (action === "Open Settings") {
                await vscode.commands.executeCommand("forgevsc.openSettings", undefined, false)
                return
            }

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

            const { enabledWorkspaces, ...Config } = Defaults
            const content = JSON.stringify(Config, null, 2) + "\n"
            const text = new TextEncoder().encode(content)
            await vscode.workspace.fs.writeFile(uri, text)

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

        // Create Guide
        vscode.commands.registerCommand("forgevsc.createGuide", async () => {
            await vscode.env.openExternal(vscode.Uri.parse(DocsUrl))
        })
    )
}