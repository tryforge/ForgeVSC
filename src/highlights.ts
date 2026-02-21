import { locateCodeBlock, FunctionScanRegex, extractFunctionName, findFunction, languages } from "."
import * as vscode from "vscode"

const legend = new vscode.SemanticTokensLegend(["function"], [])

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

        let match: RegExpExecArray | null
        while ((match = FunctionScanRegex.exec(text))) {
            const start = document.positionAt(match.index)
            if (!locateCodeBlock(document, start)) continue

            const full = match[0]
            const fnName = extractFunctionName(full)
            if (!fnName) continue

            const fn = await findFunction(fnName)
            if (!fn) continue

            const nameMatch = full.match(/[a-zA-Z_]+/)
            if (!nameMatch || nameMatch.index === undefined) continue

            const offset = match.index + nameMatch.index
            const nameLength = nameMatch[0].length
            const nameStart = document.positionAt(offset)

            builder.push(nameStart.line, nameStart.character, nameLength, 0, 0)
        }

        return builder.build()
    }
}