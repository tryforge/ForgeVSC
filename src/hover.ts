import { findFunction, generateUsage, getExtensionConfig, languages, locateCodeBlock, OperatorChain, OperatorInfo } from "."
import * as vscode from "vscode"

/**
 * Registers the hover info for functions and operators.
 * @param ctx The extension context.
 */
export function registerHover(ctx: vscode.ExtensionContext) {
    ctx.subscriptions.push(
        vscode.languages.registerHoverProvider(languages, {
            async provideHover(document, position) {
                const config = getExtensionConfig()
                if (!locateCodeBlock(document, position) || !config.features.hoverInfo) return

                // Operator hover
                const operatorRange = document.getWordRangeAtPosition(position, /@\[[^\]]?\]|[!#]/)
                if (operatorRange && operatorRange.contains(position)) {
                    const line = document.lineAt(position.line).text
                    const opStr = document.getText(operatorRange)
                    const opStart = operatorRange.start.character
                    const opEnd = operatorRange.end.character

                    const dollar = line.lastIndexOf("$", opStart)
                    if (dollar === -1) return

                    const between = line.slice(dollar, opStart)
                    const prefixOnly = between.slice(1)
                    if (prefixOnly.length && !new RegExp(`^${OperatorChain}$`).test(prefixOnly)) return

                    const after = line.slice(opEnd)
                    const afterOk = new RegExp(String.raw`^(?:${OperatorChain})[a-zA-Z_]`).test(after)
                    if (!afterOk) return

                    const op = (opStr.startsWith("@") ? "@" : opStr) as keyof typeof OperatorInfo
                    const doc = OperatorInfo[op]
                    if (!doc) return

                    const md = new vscode.MarkdownString()
                    md.appendMarkdown(`**${doc.name} (\`${opStr}\`)**\n\n${doc.description}`)
                    return new vscode.Hover(md, operatorRange)
                }

                const line = document.lineAt(position.line).text
                // const Regex = /\$!?#?(?:@\[[^\]]?\])?[a-zA-Z_]+/g
                const Regex = /\$!?#?(?:@\[[^\]]?\])?[a-zA-Z_]+(\[)?/g
                let match: RegExpExecArray | null

                // Function hover
                while ((match = Regex.exec(line))) {
                    const hasOpening = match[1] === "["
                    const start = match.index
                    let end = start + match[0].length
                    if (hasOpening) end--

                    if (position.character >= start && position.character <= end) {
                        const found = await findFunction(match[0])
                        if (!found) return

                        const { fn, matchedText } = found
                        const acceptsArgs = fn.brackets !== undefined
                        const md = new vscode.MarkdownString()
                        md.appendCodeblock(
                            `${fn.brackets || (hasOpening && acceptsArgs) ? generateUsage(fn) : fn.name}${fn.output ? `: ` + (fn.output as Array<any>).join(", ") : ""}\n`
                        )
                        md.appendText(`${fn.description}\n`)
                        if (fn.version) {
                            md.appendMarkdown(`---\n`)
                            md.appendMarkdown(
                                `##### v${fn.version} | [Documentation](https://docs.botforge.org/function/${fn.name})`
                            )
                        }
                        md.isTrusted = true

                        const hoverEnd = Math.min(end, start + matchedText.length)
                        const range = new vscode.Range(position.line, start, position.line, hoverEnd)
                        return new vscode.Hover(md, range)
                    }
                }
            }
        })
    )
}