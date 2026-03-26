import { locateCodeBlock, findMatchingBracket, languages, FunctionOpenScanRegex, getExtensionConfig, isEscaped } from "."
import vscode from "vscode"

/**
 * Registers the folding for function contents.
 * @param ctx The extension context.
 */
export function registerFolding(ctx: vscode.ExtensionContext) {
    ctx.subscriptions.push(
        vscode.languages.registerFoldingRangeProvider(languages, {
            provideFoldingRanges(document) {
                const config = getExtensionConfig()
                if (!config.features.folding) return null

                const ranges: vscode.FoldingRange[] = []
                const text = document.getText()
                let match: RegExpExecArray | null

                while ((match = FunctionOpenScanRegex.exec(text))) {
                    const index = match.index
                    const startPos = document.positionAt(index)
                    if (!locateCodeBlock(document, startPos) || isEscaped(text, index)) continue

                    const openIndex = index + match[0].length - 1
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