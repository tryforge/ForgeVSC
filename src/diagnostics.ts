import {
	cloneRegex,
	findFunction,
	findMatchingBracket,
	FunctionPrefixRegex,
	FunctionScanRegex,
	getExtensionConfig,
	isEscaped,
	Languages,
	locateCodeBlock,
	splitArgs,
	validateOperatorPrefix
} from "."
import * as vscode from "vscode"

/**
 * Validates a document for diagnostics.
 * @param document The document to validate.
 * @param collection The diagnostic collection.
 * @returns 
 */
export async function validateDocument(
	document: vscode.TextDocument | undefined,
	collection: vscode.DiagnosticCollection
) {
	const config = getExtensionConfig()
	if (!document || !Languages.includes(document.languageId) || !config.features.diagnostics) return

	const diagnostics: vscode.Diagnostic[] = []
	const text = document.getText()
	// const Regex = /^\$!?#?(?:@\[[^\]]*\])?/

	const ScanRegex = cloneRegex(FunctionScanRegex)
	ScanRegex.lastIndex = 0
	let match: RegExpExecArray | null

	while ((match = ScanRegex.exec(text))) {
		const index = match.index
		const start = document.positionAt(index)
		if (!locateCodeBlock(document, start) || isEscaped(text, index)) continue

		const full = match[0]
		const hasOpening = full.endsWith("[")
		const base = hasOpening ? full.slice(0, -1) : full

		const found = await findFunction(base, true)
		if (!found) continue

		const { fn, matchedText } = found
		const end = document.positionAt(index + matchedText.length)

		// Deprecation warning
		if (fn.deprecated) {
			const hint = new vscode.Diagnostic(
				new vscode.Range(start, end),
				`This function is deprecated and its use is discouraged. It may be removed in upcoming releases. Use a supported alternative if available.`,
				vscode.DiagnosticSeverity.Hint
			)
			const warning = new vscode.Diagnostic(
				new vscode.Range(start, end),
				`Function \`${fn.name}\` is deprecated. Use an available alternative instead`,
				vscode.DiagnosticSeverity.Warning
			)
			warning.tags = [vscode.DiagnosticTag.Deprecated]
			diagnostics.push(hint, warning)
		}

		// Experimental hint
		if (fn.experimental) {
			const diagnostic = new vscode.Diagnostic(
				new vscode.Range(start, end),
				`This is an experimental function. It may not work as expected and is not guaranteed to be stable. Expect bugs, changes, or removal.`,
				vscode.DiagnosticSeverity.Hint
			)
			diagnostics.push(diagnostic)
		}
		const { isInvalidOrder, rawPrefix } = validateOperatorPrefix(base)

		// Invalid operator order
		if (isInvalidOrder) {
			const offset = rawPrefix.length
			const opStart = document.positionAt(index + 1)
			const opEnd = document.positionAt(index + offset)
			diagnostics.push(new vscode.Diagnostic(
				new vscode.Range(opStart, opEnd),
				`Function \`${fn.name}\` has invalid operator order`,
				vscode.DiagnosticSeverity.Error
			))
			continue
		}

		// Duplicated operators
		const strictPrefix = base.match(FunctionPrefixRegex)?.[0] ?? "$"
		if (rawPrefix.length > strictPrefix.length) {
			const extraStart = document.positionAt(index + strictPrefix.length)
			const extraEnd = document.positionAt(index + rawPrefix.length)
			diagnostics.push(new vscode.Diagnostic(
				new vscode.Range(extraStart, extraEnd),
				`Function \`${fn.name}\` has duplicated operators supplied`,
				vscode.DiagnosticSeverity.Error
			))
			continue
		}

		const isAttached = matchedText.length === base.length && matchedText.toLowerCase() === base.toLowerCase()
		const hasOpeningAttached = hasOpening && isAttached

		const args = fn.args ?? []
		const acceptsArgs = fn.brackets !== undefined && args.length > 0
		const requiresArgs = fn.brackets

		const range = new vscode.Range(start, end)

		// Missing required brackets
		if (requiresArgs && !hasOpeningAttached) {
			diagnostics.push(new vscode.Diagnostic(
				range,
				`Function \`${fn.name}\` requires brackets`,
				vscode.DiagnosticSeverity.Error
			))
			continue
		}

		if (!isAttached || args.length === 0) continue

		if (acceptsArgs && hasOpening) {
			const openIndex = index + full.length - 1
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