import {
    buildSourceURL,
    ConditionOperatorInfo,
    findConditionOperator,
    findFunction,
    findGuide,
    findMatchingBracket,
    generateUsage,
    getExtensionConfig,
    getPackageName,
    isEscaped,
    isIgnored,
    Languages,
    locateCodeBlock,
    OperatorChain,
    OperatorInfo,
    splitArgs
} from "."
import * as vscode from "vscode"

/**
 * Registers the hover info for functions and operators.
 * @param ctx The extension context.
 */
export function registerHover(ctx: vscode.ExtensionContext) {
    ctx.subscriptions.push(
        vscode.languages.registerHoverProvider(Languages, {
            async provideHover(document, position) {
                const config = getExtensionConfig()
                if (!locateCodeBlock(document, position) || !config.features.hoverInfo) return

                const text = document.getText()
                const offset = document.offsetAt(position)
                const RegexOpen = /\$!?#?(?:@\[[^\]]?\])?[a-zA-Z0-9]+\[/g
                let fnMatch: RegExpExecArray | null

                // Condition Operator hover
                while ((fnMatch = RegexOpen.exec(text))) {
                    const found = await findFunction(fnMatch[0].slice(0, -1))
                    if (!found) continue

                    const { fn } = found
                    const openIndex = fnMatch.index + fnMatch[0].length - 1
                    const closeIndex = findMatchingBracket(text, openIndex)
                    if (closeIndex === -1) continue

                    const argText = text.slice(openIndex + 1, closeIndex)
                    const args = splitArgs(argText)

                    for (let i = 0; i < args.length; i++) {
                        const meta = fn.args?.[Math.min(i, fn.args.at(-1)?.rest ? fn.args.length - 1 : i)]
                        if (!meta?.condition) continue

                        const op = findConditionOperator(args[i].value)
                        if (!op) continue

                        const start = openIndex + 1 + args[i].start + op.start
                        const end = openIndex + 1 + args[i].start + op.end
                        if (offset < start || offset > end) continue

                        const info = ConditionOperatorInfo[op.operator]
                        if (!info) return

                        const md = new vscode.MarkdownString()
                        md.appendMarkdown(`**${info.name} (\`${op.operator}\`)**\n\n${info.description}`)

                        return new vscode.Hover(
                            md,
                            new vscode.Range(document.positionAt(start), document.positionAt(end))
                        )
                    }
                }

                // Operator hover
                const operatorRange = document.getWordRangeAtPosition(position, /@\[[^\]]?\]|[!#]/)
                if (operatorRange && operatorRange.contains(position)) {
                    const line = document.lineAt(position.line).text
                    const opStart = operatorRange.start.character

                    const offset = document.offsetAt(new vscode.Position(position.line, opStart))
                    if (isIgnored(text, offset)) return

                    const dollar = line.lastIndexOf("$", opStart)
                    if (dollar === -1 || isEscaped(line, dollar)) return

                    const between = line.slice(dollar, opStart)
                    const prefixOnly = between.slice(1)
                    if (prefixOnly.length && !new RegExp(`^${OperatorChain}$`).test(prefixOnly)) return

                    const opEnd = operatorRange.end.character
                    const after = line.slice(opEnd)
                    const afterOk = new RegExp(String.raw`^(?:${OperatorChain})[a-zA-Z0-9]`).test(after)
                    if (!afterOk) return

                    const opStr = document.getText(operatorRange)
                    const op = (opStr.startsWith("@") ? "@" : opStr) as keyof typeof OperatorInfo
                    const doc = OperatorInfo[op]
                    if (!doc) return

                    const md = new vscode.MarkdownString()
                    md.appendMarkdown(`**${doc.name} (\`${opStr}\`)**\n\n${doc.description}`)
                    return new vscode.Hover(md, operatorRange)
                }

                const line = document.lineAt(position.line).text
                // const Regex = /\$!?#?(?:@\[[^\]]?\])?[a-zA-Z0-9]+/g
                const Regex = /\$!?#?(?:@\[[^\]]?\])?[a-zA-Z0-9]+(\[)?/g
                let match: RegExpExecArray | null

                // Function hover
                while ((match = Regex.exec(line))) {
                    const start = match.index
                    const offset = document.offsetAt(new vscode.Position(position.line, start))
                    if (isEscaped(line, start) || isIgnored(text, offset)) continue

                    const hasOpening = match[1] === "["
                    let end = start + match[0].length
                    if (hasOpening) end--

                    if (position.character >= start && position.character <= end) {
                        const lookup = hasOpening ? match[0].slice(0, -1) : match[0]
                        const found = await findFunction(lookup)
                        if (!found) continue

                        const { fn, matchedText } = found
                        const actualEnd = start + matchedText.length
                        if (position.character < start || position.character > actualEnd) continue

                        const { brackets, name, output, description, version, source } = fn
                        const acceptsArgs = brackets !== undefined

                        const bracketIndex = start + matchedText.length
                        const hasBracket = acceptsArgs && line[bracketIndex] === "["

                        const md = new vscode.MarkdownString()
                        md.appendCodeblock(
                            `${(brackets || hasBracket) ? generateUsage(fn) : name}${output ? `: ` + (output as Array<any>).join(", ") : ""}\n`
                        )
                        md.appendText(`${description}\n`)
                        if (version) {
                            const links: string[] = []
                            const sourceUrl = await buildSourceURL(fn)
                            if (sourceUrl) links.push(`[${vscode.l10n.t("Source")}](${sourceUrl})`)
                            const guide = await findGuide({ targetType: "function", targetName: name })
                            const pkgName = guide?.packageName || getPackageName(source)
                            if (pkgName) links.push(`[${vscode.l10n.t("Documentation")}](https://docs.botforge.org/function/${name}?p=${pkgName})`)
                            if (guide) {
                                const cmd = vscode.Uri.parse(
                                    `command:forgevsc.previewGuide?${encodeURIComponent(JSON.stringify([guide.id]))}`
                                )
                                links.push(`[${vscode.l10n.t("Guide")}](${cmd})`)
                            }
                            md.appendMarkdown(`---\n`)
                            md.appendMarkdown(
                                `##### ${pkgName ? `${pkgName} ` : ""}v${version}` + (links.length ? " | " + links.join(" | ") : "")
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