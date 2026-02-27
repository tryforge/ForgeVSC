import * as vscode from "vscode"

export interface IExtensionConfig {
    customFunctionsPath?: string
    additionalPackages?: string[]
    colors?: {
        function?: string
        dollar?: string
        semicolon?: string
        brackets?: string
    }
    features?: {
        folding?: boolean
        hoverInfo?: boolean
        suggestions?: boolean
        signatureHelp?: boolean
        diagnostics?: boolean
        autocompletion?: boolean
    }
}

export const Defaults: Required<IExtensionConfig> = {
    customFunctionsPath: "",
    additionalPackages: [],
    colors: {
        function: "#ac75ff",
        dollar: "#fe7ceb",
        semicolon: "#c586c0",
        brackets: "#ffd700",
    },
    features: {
        folding: true,
        hoverInfo: true,
        suggestions: true,
        signatureHelp: true,
        diagnostics: true,
        autocompletion: true,
    },
}

let cached: Required<IExtensionConfig> = Defaults

export function getExtensionConfig() {
    return cached
}

export async function loadExtensionConfig() {
    const folders = vscode.workspace.workspaceFolders
    if (!folders?.length) {
        cached = Defaults
        return cached
    }

    const uri = vscode.Uri.joinPath(folders[0].uri, ".forgevsc.json")

    try {
        const raw = await vscode.workspace.fs.readFile(uri)
        const parsed = JSON.parse(Buffer.from(raw).toString("utf8")) as IExtensionConfig

        cached = {
            customFunctionsPath: parsed.customFunctionsPath ?? Defaults.customFunctionsPath,
            additionalPackages: Array.from(
                new Set([...Defaults.additionalPackages, ...(parsed.additionalPackages ?? [])])
            ),
            colors: { ...Defaults.colors, ...(parsed.colors ?? {}) },
            features: { ...Defaults.features, ...(parsed.features ?? {}) },
        }
    } catch {
        cached = Defaults
    }

    return cached
}