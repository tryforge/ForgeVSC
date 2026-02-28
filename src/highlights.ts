import { locateCodeBlock, FunctionScanRegex, findFunction, languages, FunctionPrefixRegex } from "."
import * as vscode from "vscode"

const legend = new vscode.SemanticTokensLegend(["function"], [])

/**
 * Registers the syntax highlighting for functions.
 * @param ctx The extension context.
 */
export function registerHighlighting(ctx: vscode.ExtensionContext) {
    ctx.subscriptions.push(
        vscode.languages.registerDocumentSemanticTokensProvider(
            languages,
            new ForgeSemanticTokensProvider(),
            legend
        )
    )
}

export class ForgeSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
    async provideDocumentSemanticTokens(document: vscode.TextDocument) {
        const builder = new vscode.SemanticTokensBuilder(legend)
        const text = document.getText()

        FunctionScanRegex.lastIndex = 0
        let match: RegExpExecArray | null

        while ((match = FunctionScanRegex.exec(text))) {
            const start = document.positionAt(match.index)
            if (!locateCodeBlock(document, start)) continue

            const full = match[0]
            let found = await findFunction(full)
            if (!found && full.endsWith("[")) found = await findFunction(full.slice(0, -1))
            if (!found) continue

            const { matchedText } = found
            const nameMatch = full.match(/[a-zA-Z_]+/)
            if (!nameMatch || nameMatch.index === undefined) continue

            const prefixMatch = matchedText.match(FunctionPrefixRegex)?.[0] ?? "$"
            const nameLength = Math.max(matchedText.length - prefixMatch.length, 0)
            const nameStart = document.positionAt(match.index + prefixMatch.length)

            builder.push(nameStart.line, nameStart.character, nameLength, 0, 0)
        }

        return builder.build()
    }
}