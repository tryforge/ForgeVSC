import { extractFunctionName, OperatorChain, findFunction, locateCodeBlock, getExtensionConfig } from "."
import * as vscode from "vscode"

export const FunctionHeadRegex = new RegExp(String.raw`(\$${OperatorChain}[a-zA-Z_]+)$`)

/**
 * Checks whether the input is escaped.
 * @param input The input text.
 * @param i The index number.
 * @returns 
 */
export function isEscaped(input: string, i: number) {
    let slashes = 0
    for (let j = i - 1; j >= 0 && input[j] === "\\"; j--) slashes++
    return slashes % 2 === 1
}

/**
 * Checks whether a function has an unclosed bracket.
 * @param before The input text.
 * @returns 
 */
export function hasUnclosedBracket(before: string) {
    let depth = 0
    for (let i = 0; i < before.length; i++) {
        const c = before[i]
        if (isEscaped(before, i)) continue
        if (c === "[") depth++
        else if (c === "]" && depth > 0) depth--
    }
    return depth > 0
}

export class ForgeInlineCompletionItemProvider implements vscode.InlineCompletionItemProvider {
    async provideInlineCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
        const code = locateCodeBlock(document, position)
        const config = getExtensionConfig()
        if (!code || !config.features.suggestions) return null

        const slice = code.slice.replace(/[ \t\r]+$/g, "")
        const nextChar = document.getText(new vscode.Range(position, position.translate(0, 1)))

        // Suggest brackets (doesn't work)
        const match = slice.match(FunctionHeadRegex)
        if (match && nextChar !== "[") {
            const full = match[1]
            const fnName = extractFunctionName(full, true) ?? extractFunctionName(full)
            if (fnName) {
                const fn = await findFunction(fnName)
                if (fn && fn.brackets !== undefined) {
                    return [new vscode.InlineCompletionItem("[]", new vscode.Range(position, position))]
                }
            }
        }

        // Suggest closing bracket
        if (slice && hasUnclosedBracket(code.slice) && nextChar !== "]") {
            return [new vscode.InlineCompletionItem("]", new vscode.Range(position, position))]
        }

        return null
    }
}