import { findFunction, FunctionScanRegex, getExtensionConfig, isEscaped, languages, locateCodeBlock, validateOperatorPrefix } from "."
import { IArg } from "@tryforge/forgescript"
import * as vscode from "vscode"

/**
 * Splits an argument string into an array of arguments.
 * @param argString The argument string.
 * @returns 
 */
export function splitArgs(argString?: string) {
	if (argString === undefined) return []

	const args: string[] = []
	let current = ""
	let depth = 0

	for (let i = 0; i < argString.length; i++) {
		const escaped = isEscaped(argString, i)
		const char = argString[i]

		if (char === "[" && !escaped) depth++
		else if (char === "]" && !escaped) depth--

		if (char === ";" && depth === 0 && !escaped) {
			args.push(current)
			current = ""
		} else current += char
	}

	args.push(current)
	return args
}

/**
 * Finds the matching bracket position from the start index.
 * @param input The input text.
 * @param openIndex The index of the opening bracket.
 * @returns 
 */
export function findMatchingBracket(input: string, openIndex: number) {
	let depth = 1

	for (let i = openIndex + 1; i < input.length; i++) {
		const c = input[i]
		if (isEscaped(input, i)) continue

		if (c === "[") depth++
		else if (c === "]") {
			depth--
			if (depth === 0) return i
		}
	}

	return -1
}

export async function validateDocument(
	document: vscode.TextDocument | undefined,
	collection: vscode.DiagnosticCollection
) {
	const config = getExtensionConfig()
	if (!document || !languages.includes(document.languageId) || !config.features.diagnostics) return

	const diagnostics: vscode.Diagnostic[] = []
	const text = document.getText()
	// const Regex = /^\$!?#?(?:@\[[^\]]*\])?/
	let match: RegExpExecArray | null

	while ((match = FunctionScanRegex.exec(text))) {
		const start = document.positionAt(match.index)
		if (!locateCodeBlock(document, start)) continue

		const full = match[0]
		const found = await findFunction(full, true)
		if (!found) continue
		const fn = found.fn

		// Invalid operator order
		const { isInvalidOrder, rawPrefix } = validateOperatorPrefix(full)
		if (isInvalidOrder) {
			const offset = rawPrefix.length
			const opStart = document.positionAt(match.index + 1)
			const opEnd = document.positionAt(match.index + offset)
			diagnostics.push(new vscode.Diagnostic(
				new vscode.Range(opStart, opEnd),
				`Function \`${fn.name}\` has invalid operator order`,
				vscode.DiagnosticSeverity.Error
			))
			continue
		}

		const args: IArg<any>[] = fn.args ?? []
		const acceptsArgs = fn.brackets !== undefined && args.length > 0
		const requiresArgs = fn.brackets

		const hasOpening = full.endsWith("[")
		const openIndex = hasOpening ? (match.index + full.length - 1) : -1

		const end = document.positionAt(match.index + full.length)
		const range = new vscode.Range(start, end)

		// Missing required brackets
		if (requiresArgs && !hasOpening) {
			diagnostics.push(new vscode.Diagnostic(
				range,
				`Function \`${fn.name}\` requires brackets`,
				vscode.DiagnosticSeverity.Error
			))
			continue
		}

		if (args.length === 0) continue

		if (acceptsArgs && hasOpening) {
			const closeIndex = findMatchingBracket(text, openIndex)

			// Missing closing bracket
			if (closeIndex === -1) {
				diagnostics.push(new vscode.Diagnostic(
					range,
					`Function \`${fn.name}\` is missing brace closure`,
					vscode.DiagnosticSeverity.Error
				))
				continue
			}

			const argString = text.slice(openIndex + 1, closeIndex)
			const providedArgs = splitArgs(argString)

			// Too few arguments
			for (let i = 0; i < args.length; i++) {
				const expected = args[i]
				const provided = providedArgs[i]

				if (expected.required && provided === undefined) {
					const argStart = document.positionAt(openIndex + 1)
					const argEnd = document.positionAt(closeIndex)
					diagnostics.push(new vscode.Diagnostic(
						new vscode.Range(argStart, argEnd),
						`Function \`${fn.name}\` is missing argument \`${expected.name}\``,
						vscode.DiagnosticSeverity.Error
					))
				}
			}

			// Too many arguments
			if (providedArgs.length > args.length && !args.at(-1)?.rest) {
				const end = document.positionAt(closeIndex + 1)
				diagnostics.push(new vscode.Diagnostic(
					new vscode.Range(start, end),
					`Function \`${fn.name}\` expects ${args.length} argument${args.length === 1 ? "" : "s"} at most, received ${providedArgs.length}`,
					vscode.DiagnosticSeverity.Error
				))
			}
		}
	}

	collection.set(document.uri, diagnostics)
}