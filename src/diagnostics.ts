import { getFunctions } from "./extension"
import * as vscode from "vscode"

export async function validateDocument(
    document: vscode.TextDocument | undefined,
    collection: vscode.DiagnosticCollection
) {
	if (!document || document.languageId !== "javascript") return

	const functions = await getFunctions()
	const diagnostics: vscode.Diagnostic[] = []
	const text = document.getText()
	const Regex = /\$[a-zA-Z_]+\[?[^\]\n]*\]?/g
	let match: RegExpExecArray | null

	while ((match = Regex.exec(text))) {
		const full = match[0]
		const nameMatch = full.match(/\$[a-zA-Z_]+/)
		if (!nameMatch) continue

		const fnName = nameMatch[0] as `$${string}`
		const hasBrackets = full.includes("[")
		const hasClosing = full.includes("]")

		const fn = functions.find((x) => x.name === fnName || (x.aliases ?? []).includes(fnName))
		if (!fn) continue

		const acceptsArgs = fn.brackets !== undefined && fn.args?.length
		const requiresArgs = fn.brackets

		const start = document.positionAt(match.index)
		const end = document.positionAt(match.index + full.length)
		const range = new vscode.Range(start, end)

		// Missing brackets but required
		if (requiresArgs && !hasBrackets) {
			diagnostics.push(new vscode.Diagnostic(
				range,
				`Function ${fnName} requires brackets`,
				vscode.DiagnosticSeverity.Error
			))
		}

		// Missing closing bracket
		else if (acceptsArgs && hasBrackets && !hasClosing) {
			diagnostics.push(new vscode.Diagnostic(
				range,
				`Function ${fnName} is missing brace closure`,
				vscode.DiagnosticSeverity.Error
			))
		}
	}

	collection.set(document.uri, diagnostics)
}