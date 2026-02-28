import {
    findFunction,
    findOpeningBracket,
    FunctionAutocompleteRegex,
    FunctionHeadRegex,
    generateUsage,
    getExtensionConfig,
    getFunctions,
    languages,
    locateCodeBlock,
    splitArgs,
    validateOperatorPrefix
} from "."
import { IArg } from "@tryforge/forgescript"
import * as vscode from "vscode"

/**
 * Registers the autocompletion for functions and enums.
 * @param ctx The extension context.
 */
export function registerAutocompletion(ctx: vscode.ExtensionContext) {
    ctx.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(languages, {
            async provideCompletionItems(document, position) {
                const config = getExtensionConfig()
                if (!locateCodeBlock(document, position) || !config.features.autocompletion) return

                const line = document.lineAt(position).text
                const before = line.substring(0, position.character)

                // Function autocompletion
                const match = before.match(FunctionAutocompleteRegex)
                if (match && !validateOperatorPrefix(match[0]).isInvalidOrder) {
                    const functions = await getFunctions()
                    const items = functions.flatMap((fn) => {
                        const names = [fn.name, ...(fn.aliases ?? [])]

                        return names.map((name) => {
                            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function)

                            item.insertText = name
                            item.detail = generateUsage(fn)
                            item.documentation = new vscode.MarkdownString(
                                `${(fn.deprecated ? "🛑 **Deprecated**\n" : fn.experimental ? "⚠️ **Experimental**\n" : "") + "\n" + fn.description}${fn.version ? `\n\n*@since* — \`${fn.package ?? ""}@${fn.version}\`` : ""}`
                            )
                            item.kind = vscode.CompletionItemKind.Function
                            if (fn.deprecated) item.tags = [vscode.CompletionItemTag.Deprecated]

                            const startPos = position.translate(0, -match[0].length)
                            item.range = new vscode.Range(startPos, position)

                            return item
                        })
                    })

                    if (items.length) return items
                }

                // Enum autocompletion
                const open = findOpeningBracket(before)
                if (open !== -1) {
                    const head = before.slice(0, open)
                    const argsTyped = before.slice(open + 1)

                    const argMatch = head.match(FunctionHeadRegex)
                    if (argMatch) {
                        const fnName = argMatch[1]

                        const found = await findFunction(fnName)
                        const fn = found?.fn
                        if (fn?.args) {
                            const args: IArg<any>[] = fn.args
                            const lastIndex = args.length - 1

                            const parts = splitArgs(argsTyped)
                            let activeIndex = parts.length - 1
                            if (args[lastIndex]?.rest) activeIndex = Math.min(activeIndex, lastIndex)

                            const activeArg = args[activeIndex]
                            const enumValues = activeArg?.enum || (activeArg.type === "Boolean" ? ["true", "false"] : undefined)

                            if (enumValues) {
                                const currentValue = parts[activeIndex] ?? ""

                                return enumValues.map((val: string) => {
                                    const item = new vscode.CompletionItem(val, vscode.CompletionItemKind.EnumMember)
                                    const start = position.translate(0, -currentValue.length)

                                    item.insertText = val
                                    item.range = new vscode.Range(start, position)

                                    return item
                                })
                            }
                        }
                    }
                }

                return
            }
        }, "$", ";", "[")
    )
}