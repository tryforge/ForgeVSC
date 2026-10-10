/*
* SPDX-License-Identifier: LGPL-3.0-or-later
* Copyright © 2026 BotForge
*/

import { toArray } from "."
import * as vscode from "vscode"

export type FunctionStyle = "normal" | "bold" | "italic" | "bold-italic"
export type RPCTimestampMode = "session" | "file" | "none"

export interface IRPCButton {
    label: string
    url: string
}

export interface IRPCConfig {
    enabled?: boolean
    details?: string
    state?: string
    detailsIdling?: string
    stateIdling?: string
    largeImageText?: string
    smallImageText?: string
    swapImages?: boolean
    timestamp?: RPCTimestampMode
    idleTimeout?: number
    showRepositoryButton?: boolean
    buttons?: IRPCButton[]
    ignoredWorkspaces?: string[]
}

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
        arguments?: {
            condition?: string
        }
        operators?: {
            negation?: string
            silent?: string
            count?: string
            countDelimiter?: string
        }
    }
    formatting?: {
        function?: {
            style?: FunctionStyle
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
    rpc?: IRPCConfig
}

export const Defaults: Required<IExtensionConfig> = {
    enabledWorkspaces: [],
    customFunctionPaths: [],
    additionalPackages: [],
    colors: {
        function: {
            name: "#AC75FF",
            dollar: "#FE7CEB",
            semicolon: "#C586C0",
        },
        arguments: {
            condition: "#4FC1FF"
        },
        operators: {
            negation: "#4FA3FF",
            silent: "#FF9F43",
            count: "#33D17A",
            countDelimiter: "#76E3A0"
        },
    },
    formatting: {
        function: {
            style: "normal"
        }
    },
    features: {
        folding: true,
        hoverInfo: true,
        suggestions: true,
        signatureHelp: true,
        diagnostics: true,
        autocompletion: true,
    },
    rpc: {
        enabled: true,
        details: "Editing {file_name}",
        state: "Workspace: {workspace}",
        detailsIdling: "Idling...",
        stateIdling: "",
        largeImageText: "BotForge",
        smallImageText: "{language}",
        swapImages: false,
        timestamp: "session",
        idleTimeout: 5,
        showRepositoryButton: true,
        buttons: [],
        ignoredWorkspaces: []
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
                arguments: {
                    condition: vs.get<string>("workspace.colors.arguments.condition"),
                },
                operators: {
                    negation: vs.get<string>("workspace.colors.operators.negation"),
                    silent: vs.get<string>("workspace.colors.operators.silent"),
                    count: vs.get<string>("workspace.colors.operators.count"),
                    countDelimiter: vs.get<string>("workspace.colors.operators.countDelimiter"),
                }
            },
            formatting: {
                function: {
                    style: vs.get<FunctionStyle>("workspace.formatting.function.style"),
                }
            },
            features: {
                folding: vs.get<boolean>("workspace.features.folding"),
                hoverInfo: vs.get<boolean>("workspace.features.hoverInfo"),
                suggestions: vs.get<boolean>("workspace.features.suggestions"),
                signatureHelp: vs.get<boolean>("workspace.features.signatureHelp"),
                diagnostics: vs.get<boolean>("workspace.features.diagnostics"),
                autocompletion: vs.get<boolean>("workspace.features.autocompletion"),
            },
            rpc: {
                enabled: vs.get<boolean>("workspace.rpc.enabled"),
                details: vs.get<string>("workspace.rpc.details"),
                state: vs.get<string>("workspace.rpc.state"),
                detailsIdling: vs.get<string>("workspace.rpc.detailsIdling"),
                stateIdling: vs.get<string>("workspace.rpc.stateIdling"),
                largeImageText: vs.get<string>("workspace.rpc.largeImageText"),
                smallImageText: vs.get<string>("workspace.rpc.smallImageText"),
                swapImages: vs.get<boolean>("workspace.rpc.swapImages"),
                timestamp: vs.get<RPCTimestampMode>("workspace.rpc.timestamp"),
                idleTimeout: vs.get<number>("workspace.rpc.idleTimeout"),
                showRepositoryButton: vs.get<boolean>("workspace.rpc.showRepositoryButton"),
                buttons: vs.get<IRPCButton[]>("workspace.rpc.buttons"),
                ignoredWorkspaces: vs.get<string[]>("workspace.rpc.ignoredWorkspaces"),
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
        vscode.Uri.joinPath(root, "forgevsc.json"),
        vscode.Uri.joinPath(root, ".forgevsc.json"),
        vscode.Uri.joinPath(root, ".vscode", "forgevsc.json"),
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
            arguments: {
                ...Defaults.colors.arguments,
                ...(vs.workspace.colors?.arguments ?? {}),
                ...(file.colors?.arguments ?? {})
            },
            operators: {
                ...Defaults.colors.operators,
                ...(vs.workspace.colors?.operators ?? {}),
                ...(file.colors?.operators ?? {})
            }
        },
        formatting: {
            function: {
                ...Defaults.formatting.function,
                ...(vs.workspace.formatting?.function ?? {})
            }
        },
        features: {
            folding: file.features?.folding ?? vs.workspace.features?.folding ?? Defaults.features.folding,
            hoverInfo: file.features?.hoverInfo ?? vs.workspace.features?.hoverInfo ?? Defaults.features.hoverInfo,
            suggestions: file.features?.suggestions ?? vs.workspace.features?.suggestions ?? Defaults.features.suggestions,
            signatureHelp: file.features?.signatureHelp ?? vs.workspace.features?.signatureHelp ?? Defaults.features.signatureHelp,
            diagnostics: file.features?.diagnostics ?? vs.workspace.features?.diagnostics ?? Defaults.features.diagnostics,
            autocompletion: file.features?.autocompletion ?? vs.workspace.features?.autocompletion ?? Defaults.features.autocompletion,
        },
        rpc: {
            ...Defaults.rpc,
            ...Object.fromEntries(
                Object.entries(vs.workspace.rpc).filter(([, v]) => v !== undefined)
            )
        } as IRPCConfig,
    }

    return cached
}