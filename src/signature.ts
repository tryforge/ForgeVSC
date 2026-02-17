import { IArg } from "@tryforge/forgescript"
import { generateUsage, getFunctions, isInsideCode } from "./extension"
import * as vscode from "vscode"

export class ForgeSignatureHelpProvider implements vscode.SignatureHelpProvider {
	async provideSignatureHelp(document: vscode.TextDocument, position: vscode.Position) {
		if (!isInsideCode(document, position)) return null

		const text = document.lineAt(position).text.substring(0, position.character)
		const match = text.match(/\$([a-zA-Z_]+)\[([^\]]*)$/)
		if (!match) return null

		const fnName: `$${string}` = `$${match[1]}`
		const argsTyped = match[2]

		const functions = await getFunctions()
		const fn = functions.find((x) => x.name === fnName || (x.aliases ?? []).includes(fnName))
		if (!fn) return null

		const args: IArg<any>[] = fn.args ?? []
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

		const activeParam = argsTyped.split(";").length - 1

        help.signatures = [sig]
		help.activeSignature = 0
		help.activeParameter = Math.min(activeParam, args.length - 1)

		return help
	}
}