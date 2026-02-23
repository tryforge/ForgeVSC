import { locateCodeBlock, findMatchingBracket, languages, FunctionOpenScanRegex } from "."
import * as vscode from "vscode"

export function registerFolding(ctx: vscode.ExtensionContext) {
    ctx.subscriptions.push(
        vscode.languages.registerFoldingRangeProvider(languages, {
            provideFoldingRanges(document) {
                const ranges: vscode.FoldingRange[] = []
                const text = document.getText()
                let match: RegExpExecArray | null

                while ((match = FunctionOpenScanRegex.exec(text))) {
                    const openIndex = match.index + match[0].length - 1
                    const startPos = document.positionAt(match.index)
                    if (!locateCodeBlock(document, startPos)) continue

                    const closeIndex = findMatchingBracket(text, openIndex)
                    if (closeIndex === -1) continue

                    const startLine = document.positionAt(openIndex).line
                    const endLine = document.positionAt(closeIndex).line - 1

                    if (endLine > startLine) {
                        ranges.push(new vscode.FoldingRange(startLine, endLine, vscode.FoldingRangeKind.Region))
                    }
                }

                return ranges
            }
        })
    )
}