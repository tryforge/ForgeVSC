import { toArray } from "."
import vscode from "vscode"

export interface IExtensionConfig {
    customFunctionsPath?: string | string[]
    additionalPackages?: string[]
    colors?: {
        function?: {
            name?: string
            dollar?: string
            semicolon?: string
        }
        operators?: {
            negation?: string
            silent?: string
            count?: string
            countDelimiter?: string
        }
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
    customFunctionsPath: [],
    additionalPackages: [],
    colors: {
        function: {
            name: "#ac75ff",
            dollar: "#fe7ceb",
            semicolon: "#c586c0",
        },
        operators: {
            negation: "#4FA3FF",
            silent: "#FF9F43",
            count: "#33D17A",
            countDelimiter: "#76E3A0"
        },
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

/**
 * Returns the config options of the extension.
 * @returns 
 */
export function getExtensionConfig() {
    return cached
}

/**
 * Finds the config file path of the extension.
 * @param root The root directory.
 * @returns 
 */
export async function findExtensionConfig(root: vscode.Uri) {
    const paths = [
        vscode.Uri.joinPath(root, ".forgevsc.json"),
        vscode.Uri.joinPath(root, ".vscode", ".forgevsc.json")
    ]

    for (const uri of paths) {
        try {
            await vscode.workspace.fs.stat(uri)
            return uri
        } catch { }
    }

    return null
}

/**
 * Loads the config options of the extension.
 * @returns 
 */
export async function loadExtensionConfig() {
    const folders = vscode.workspace.workspaceFolders
    if (!folders?.length) {
        cached = Defaults
        return cached
    }

    const root = folders[0].uri
    const uri = await findExtensionConfig(root)

    if (uri) {
        try {
            const raw = await vscode.workspace.fs.readFile(uri)
            const parsed = JSON.parse(Buffer.from(raw).toString("utf8")) as IExtensionConfig

            cached = {
                customFunctionsPath: toArray(parsed.customFunctionsPath ?? Defaults.customFunctionsPath),
                additionalPackages: Array.from(
                    new Set([...Defaults.additionalPackages, ...(parsed.additionalPackages ?? [])])
                ),
                colors: {
                    function: { ...Defaults.colors.function, ...(parsed.colors?.function ?? {}) },
                    operators: { ...Defaults.colors.operators, ...(parsed.colors?.operators ?? {}) },
                },
                features: { ...Defaults.features, ...(parsed.features ?? {}) },
            }

            return cached
        } catch { }
    }

    cached = Defaults
    return cached
}