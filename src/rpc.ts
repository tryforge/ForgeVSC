import { DocsUrl, Logger } from "."
import type { Client, SetActivity } from "@xhayper/discord-rpc"
import * as vscode from "vscode"

const CLIENT_ID = "1511962883993374791"

let rpc: Client | null = null
let rpcModule: typeof import("@xhayper/discord-rpc") | null = null

let connectingInterval: NodeJS.Timeout | null = null
let statusBar: vscode.StatusBarItem | null = null
let startTimestamp = Date.now()

/**
 * Returns the repository URL of current workspace.
 * @returns 
 */
async function getRepoUrl() {
    const folders = vscode.workspace.workspaceFolders
    if (!folders?.length) return null

    try {
        const root = folders[0].uri
        const uri = vscode.Uri.joinPath(root, ".git", "config")

        const raw = await vscode.workspace.fs.readFile(uri)
        const config = new TextDecoder().decode(raw)

        const match = config.match(/url = (.+)/)
        if (!match) return null

        let url = match[1].trim()
        url = url
            .replace("git@", "https://")
            .replace(".com:", ".com/")
            .replace(".git", "")

        return url
    } catch {
        return null
    }
}

/**
 * Loads the RPC module.
 * @returns 
 */
async function loadRPC() {
    if (vscode.env.uiKind === vscode.UIKind.Web) {
        Logger.info("[RPC] Discord RPC disabled in web environment.")
        return null
    }

    if (!rpcModule) {
        rpcModule = await import("@xhayper/discord-rpc")
    }

    return rpcModule.Client
}

/**
 * Creates a new RPC status bar.
 * @param ctx The extension context.
 * @returns 
 */
export function createRPCStatusBar(ctx: vscode.ExtensionContext) {
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50)
    statusBar.show()
    ctx.subscriptions.push(statusBar)
}

/**
 * Updates the RPC status bar.
 * @param connected Whether a connection has already been established.
 * @returns 
 */
export function updateRPCStatusBar(connected: boolean) {
    if (!statusBar) return

    if (connected) {
        statusBar.text = vscode.l10n.t("$(plug) RPC Connected")
        statusBar.tooltip = vscode.l10n.t("Discord RPC Connected")
        statusBar.command = undefined
    } else {
        statusBar.text = vscode.l10n.t("$(debug-disconnect) Reconnect RPC")
        statusBar.tooltip = vscode.l10n.t("Reconnect Discord RPC")
        statusBar.command = "forgevsc.reconnectRPC"
    }
}

/**
 * Starts the RPC status bar connecting animation.
 * @returns 
 */
function startConnectingAnimation() {
    if (!statusBar) return

    stopConnectingAnimation()

    let i = 0
    connectingInterval = setInterval(() => {
        if (!statusBar) return
        statusBar.text = vscode.l10n.t("$(sync~spin) Connecting RPC") + ".".repeat(i % 4)
        statusBar.tooltip = vscode.l10n.t("Connecting to Discord RPC...")
        i++
    }, 400)
}

/**
 * Stops the RPC status bar connecting animation.
 * @returns 
 */
function stopConnectingAnimation() {
    if (connectingInterval) {
        clearInterval(connectingInterval)
        connectingInterval = null
    }
}

/**
 * Connects to Discord RPC.
 * @returns
 */
export async function connectRPC() {
    if (vscode.env.uiKind === vscode.UIKind.Web) return false
    if (rpc) return true

    try {
        startConnectingAnimation()

        const Client = await loadRPC()
        if (!Client) return false

        rpc = new Client({ clientId: CLIENT_ID })
        await rpc.login()

        stopConnectingAnimation()

        rpc.on("disconnected", () => {
            Logger.warn("[RPC] Disconnected from Discord RPC.")
            rpc = null
            updateRPCStatusBar(false)
        })

        updateRPCStatusBar(true)

        Logger.info("[RPC] Connected to Discord RPC.")
        return true
    } catch (error) {
        stopConnectingAnimation()
        updateRPCStatusBar(false)

        Logger.error("[RPC] Failed to connect:", error)
        rpc = null
        return false
    }
}

/**
 * Disconnects from Discord RPC.
 * @returns
 */
export async function disconnectRPC() {
    try {
        await rpc?.destroy()
    } catch { }

    rpc = null
    updateRPCStatusBar(false)
}

/**
 * Updates the RPC activity.
 * @returns
 */
export async function updateRPC(options: SetActivity) {
    if (!rpc?.user) return

    options.largeImageKey ||= "forge"
    options.largeImageText ||= "BotForge"
    options.largeImageUrl ||= DocsUrl

    const repoUrl = await getRepoUrl()
    if (repoUrl) {
        options.buttons = [{
            label: "View Repository",
            url: repoUrl
        }]
    }

    try {
        await rpc.user.setActivity({
            ...options,
            startTimestamp
        })
    } catch (error) {
        Logger.error("[RPC] Failed to update activity:", error)
    }
}

/**
 * Detects the language icon.
 * @returns
 */
function getLanguageAsset(languageId: string) {
    switch (languageId) {
        case "typescript":
            return {
                key: "ts",
                text: "TypeScript"
            }

        case "typescriptreact":
            return {
                key: "react",
                text: "TypeScript React"
            }

        case "javascript":
            return {
                key: "js",
                text: "JavaScript"
            }

        case "javascriptreact":
            return {
                key: "react",
                text: "JavaScript React"
            }

        case "json":
            return {
                key: "json",
                text: "JSON"
            }

        case "forge":
            return {
                key: "forgescript",
                text: "ForgeScript"
            }

        default:
            return undefined
    }
}

/**
 * Updates RPC activity from the active editor.
 * @returns
 */
export async function updateEditorRPC(editor?: vscode.TextEditor) {
    if (!editor) {
        await updateRPC({
            details: "Idling...",
            largeImageKey: "idle"
        })
        return
    }

    const document = editor.document
    const fileName = document.fileName.split(/[\\/]/).pop() ?? "Unknown File"
    const asset = fileName === ".forgevsc.json" ? {
        key: "fvsc-config",
        text: "ForgeVSC Config"
    } : getLanguageAsset(document.languageId)

    await updateRPC({
        details: `Editing ${fileName}`,
        state: `Workspace: ${vscode.workspace.name}`,
        smallImageKey: asset?.key,
        smallImageText: asset?.text
    })
}

/**
 * Registers automatic RPC tracking.
 * @returns
 */
export async function registerRPC(ctx: vscode.ExtensionContext) {
    const connected = await connectRPC()
    if (!connected) return

    await updateEditorRPC(vscode.window.activeTextEditor)

    ctx.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            await updateEditorRPC(editor)
        }),

        vscode.workspace.onDidSaveTextDocument(async (document) => {
            const editor = vscode.window.activeTextEditor
            if (editor?.document === document) {
                await updateEditorRPC(editor)
            }
        }),

        {
            dispose() {
                disconnectRPC()
            }
        }
    )
}