import { findFunction, findOpeningBracket, FunctionRegex, generateUsage, getExtensionConfig, languages, locateCodeBlock, splitArgs } from "."
import { IArg } from "@tryforge/forgescript"
import * as vscode from "vscode"

// export const FunctionPrefixRegex = /\$!?#?(?:@\[[^\]\n]?\])?[a-zA-Z_]+$/

/**
 * Registers the signature help for arguments.
 * @param ctx The extension context.
 */
export function registerSignatureHelp(ctx: vscode.ExtensionContext) {
	ctx.subscriptions.push(
		vscode.languages.registerSignatureHelpProvider(
			languages,
			new ForgeSignatureHelpProvider(),
			"[",
			";",
			"]"
		)
	)
}

export class ForgeSignatureHelpProvider implements vscode.SignatureHelpProvider {
	async provideSignatureHelp(document: vscode.TextDocument, position: vscode.Position) {
		const code = locateCodeBlock(document, position)
		const config = getExtensionConfig()
		if (!code || !config.features.signatureHelp) return null

		const text = code.slice
		const openIndex = findOpeningBracket(text)
		if (openIndex === -1) return null

		const beforeBracket = text.slice(0, openIndex)
		const match = beforeBracket.match(new RegExp(FunctionRegex.source + "$"))
		if (!match) return null

		const typedToken = match[0]
		const found = await findFunction(typedToken)
		if (!found) return null

		const { fn, matchedText } = found
		if (matchedText.length !== typedToken.length) return null

		const argsTyped = text.slice(openIndex + 1)
		const args: IArg<any>[] = fn.args ?? []
		if (args.length === 0) return null

		const help = new vscode.SignatureHelp()
		const sig = new vscode.SignatureInformation(generateUsage(fn, true))

		sig.documentation = fn.description
		sig.parameters = args.map((arg) => {
			const param = new vscode.ParameterInformation(
				`${arg.rest ? "..." : ""}${arg.name}${arg.required ? "" : "?"}: ${arg.type}`,
				new vscode.MarkdownString(`${arg.description}${arg.condition ? "\n\n*(Conditional)*" : ""}\n\n---`)
			)
			return param
		})

		const parts = splitArgs(argsTyped)
		const typedCount = argsTyped.trim() === "" ? 0 : parts.length
		const hasRest = args.at(-1)?.rest === true

		if (!hasRest && typedCount > args.length) return null
		const activeParam = Math.max(typedCount - 1, 0)

		help.signatures = [sig]
		help.activeSignature = 0
		help.activeParameter = Math.min(activeParam, args.length - 1)

		return help
	}
}