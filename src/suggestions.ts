import {
	bracketDepth,
	findFunction,
	findMatchingBracket,
	findOpeningBracket,
	FunctionHeadRegex,
	getExtensionConfig,
	isEscaped,
	languages,
	locateCodeBlock
} from "."
import vscode from "vscode"

/**
 * Registers the suggestions for function brackets.
 * @param ctx The extension context.
 */
export function registerSuggestions(ctx: vscode.ExtensionContext) {
	ctx.subscriptions.push(
		vscode.languages.registerInlineCompletionItemProvider(
			languages,
			new ForgeInlineCompletionItemProvider()
		)
	)
}

class ForgeInlineCompletionItemProvider implements vscode.InlineCompletionItemProvider {
	async provideInlineCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
		const code = locateCodeBlock(document, position)
		const config = getExtensionConfig()
		if (!code || !config.features.suggestions) return null

		const slice = code.slice.replace(/[ \t\r]+$/g, "")
		const nextChar = document.getText(new vscode.Range(position, position.translate(0, 1)))

		// Suggest brackets
		if (nextChar !== "[") {
			const match = slice.match(FunctionHeadRegex)
			if (match) {
				const startIndex = slice.lastIndexOf("$")
				if (startIndex !== -1 && isEscaped(slice, startIndex)) return null

				const found = await findFunction(match[1])
				if (found?.fn.brackets !== undefined) {
					return [new vscode.InlineCompletionItem("[]", new vscode.Range(position, position))]
				}
			}
		}

		// Suggest closing bracket
		if (nextChar !== "]") {
			const openIndex = findOpeningBracket(code.slice)
			if (openIndex !== -1) {
				const head = code.slice.slice(0, openIndex)
				const index = head.lastIndexOf("$")
				if (index !== -1 && isEscaped(head, index)) return null

				if (FunctionHeadRegex.test(head)) {
					const block = document.getText().slice(code.start, code.end)
					const close = findMatchingBracket(block, openIndex)
					const missingClosing = bracketDepth(block) > 0

					if (close === -1 || missingClosing) {
						return [new vscode.InlineCompletionItem("]", new vscode.Range(position, position))]
					}
				}
			}
		}

		return null
	}
}