import { toArray } from "."
import * as vscode from "vscode"

export interface IExtensionConfig {
    enabledWorkspaces?: string[]
    customFunctionPaths?: string | string[]
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
    enabledWorkspaces: [],
    customFunctionPaths: [],
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
 * Returns the settings config of the extension.
 * @returns 
 */
export function getSettingsConfig() {
    const vs = vscode.workspace.getConfiguration("forgevsc")

    return {
        global: {
            enabledWorkspaces: vs.get<string[]>("global.enabledWorkspaces")
        },
        workspace: {
            customFunctionPaths: vs.get<string[]>("workspace.customFunctionPaths"),
            additionalPackages: vs.get<string[]>("workspace.additionalPackages"),
            colors: {
                function: {
                    name: vs.get<string>("workspace.colors.function.name"),
                    dollar: vs.get<string>("workspace.colors.function.dollar"),
                    semicolon: vs.get<string>("workspace.colors.function.semicolon"),
                },
                operators: {
                    negation: vs.get<string>("workspace.colors.operators.negation"),
                    silent: vs.get<string>("workspace.colors.operators.silent"),
                    count: vs.get<string>("workspace.colors.operators.count"),
                    countDelimiter: vs.get<string>("workspace.colors.operators.countDelimiter"),
                }
            },
            features: {
                folding: vs.get<boolean>("workspace.features.folding"),
                hoverInfo: vs.get<boolean>("workspace.features.hoverInfo"),
                suggestions: vs.get<boolean>("workspace.features.suggestions"),
                signatureHelp: vs.get<boolean>("workspace.features.signatureHelp"),
                diagnostics: vs.get<boolean>("workspace.features.diagnostics"),
                autocompletion: vs.get<boolean>("workspace.features.autocompletion"),
            }
        }
    }
}

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
    const vs = getSettingsConfig()
    let file: IExtensionConfig = {}

    if (folders?.length) {
        const root = folders[0].uri
        const uri = await findExtensionConfig(root)

        if (uri) {
            try {
                const raw = await vscode.workspace.fs.readFile(uri)
                const text = new TextDecoder().decode(raw)
                file = JSON.parse(text)
            } catch { }
        }
    }

    cached = {
        enabledWorkspaces: vs.global.enabledWorkspaces ?? [],
        customFunctionPaths: toArray(
            file.customFunctionPaths ?? vs.workspace.customFunctionPaths ?? Defaults.customFunctionPaths
        ),
        additionalPackages: Array.from(new Set([
            ...Defaults.additionalPackages,
            ...(vs.workspace.additionalPackages ?? []),
            ...(file.additionalPackages ?? [])
        ])),
        colors: {
            function: {
                ...Defaults.colors.function,
                ...(vs.workspace.colors?.function ?? {}),
                ...(file.colors?.function ?? {})
            },
            operators: {
                ...Defaults.colors.operators,
                ...(vs.workspace.colors?.operators ?? {}),
                ...(file.colors?.operators ?? {})
            }
        },
        features: {
            folding: file.features?.folding ?? vs.workspace.features?.folding ?? Defaults.features.folding,
            hoverInfo: file.features?.hoverInfo ?? vs.workspace.features?.hoverInfo ?? Defaults.features.hoverInfo,
            suggestions: file.features?.suggestions ?? vs.workspace.features?.suggestions ?? Defaults.features.suggestions,
            signatureHelp: file.features?.signatureHelp ?? vs.workspace.features?.signatureHelp ?? Defaults.features.signatureHelp,
            diagnostics: file.features?.diagnostics ?? vs.workspace.features?.diagnostics ?? Defaults.features.diagnostics,
            autocompletion: file.features?.autocompletion ?? vs.workspace.features?.autocompletion ?? Defaults.features.autocompletion,
        }
    }

    return cached
}