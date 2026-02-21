import { findFunction, FunctionArgumentRegex, generateUsage, locateCodeBlock } from "."
import { IArg } from "@tryforge/forgescript"
import * as vscode from "vscode"

export class ForgeSignatureHelpProvider implements vscode.SignatureHelpProvider {
	async provideSignatureHelp(document: vscode.TextDocument, position: vscode.Position) {
		if (!locateCodeBlock(document, position)) return null

		const text = document.lineAt(position).text.substring(0, position.character)
		const match = text.match(FunctionArgumentRegex)
		if (!match) return null

		const fnName: `$${string}` = `$${match[1]}`
		const argsTyped = match[2]

		const fn = await findFunction(fnName)
		if (!fn) return null

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

		const typedCount = argsTyped.trim() === "" ? 0 : argsTyped.split(";").length
		const hasRest = args.at(-1)?.rest === true

		if (!hasRest && typedCount > args.length) return null
		const activeParam = Math.max(typedCount - 1, 0)

		help.signatures = [sig]
		help.activeSignature = 0
		help.activeParameter = Math.min(activeParam, args.length - 1)

		return help
	}
}