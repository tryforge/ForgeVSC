import { ArgType, EnumLike, IArg, INativeFunction } from "@tryforge/forgescript"
import { ForgeSignatureHelpProvider } from "./signature"
import { validateDocument } from "./diagnostics"
import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs"

export type FunctionMetadata = Omit<INativeFunction<any>, "execute">
let functions: FunctionMetadata[] | null = null

export async function activate(ctx: vscode.ExtensionContext) {
	const diagnostics = vscode.languages.createDiagnosticCollection("forge")
	ctx.subscriptions.push(diagnostics)

	validateDocument(vscode.window.activeTextEditor?.document, diagnostics)

	ctx.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((e) => validateDocument(e.document, diagnostics)),
		vscode.workspace.onDidOpenTextDocument((doc) => validateDocument(doc, diagnostics))
	)

	ctx.subscriptions.push(
		vscode.languages.registerSignatureHelpProvider(
			"javascript",
			new ForgeSignatureHelpProvider(),
			"[",
			";"
		)
	)

	await registerAutocompletion(ctx)
	await registerHover(ctx)
}

/**
 * Returns all forge packages of the workspace.
 * @returns 
 */
export function getForgePackages() {
	const folders = vscode.workspace.workspaceFolders
	if (!folders) return []

	const pkgPath = path.join(folders[0].uri.fsPath, "package.json")
	if (!fs.existsSync(pkgPath)) return []

	const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))
	const deps = [...Object.keys(pkg.dependencies ?? {})]

	return deps.filter((dep) => dep.startsWith("@tryforge/") || dep.includes("forge"))
}

/**
 * Fetches all functions from metadata.
 * @returns 
 */
export async function fetchFunctions() {
	const folders = vscode.workspace.workspaceFolders
	if (!folders) return []

	const root = folders[0].uri.fsPath
	const pkgNames = getForgePackages()
	let extensionFunctions: FunctionMetadata[] = []

	for (const pkgName of pkgNames) {
		const pkgPath = path.join(root, "node_modules", pkgName, "package.json")
		if (!fs.existsSync(pkgPath)) continue

		try {
			const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))
			const localMeta = path.join(root, "node_modules", pkgName, "metadata", "functions.json")

			if (fs.existsSync(localMeta)) {
				const data = JSON.parse(fs.readFileSync(localMeta, "utf8"))
				extensionFunctions.push(...data)
				continue
			}

			if ("repository" in pkg && pkg.repository?.url) {
				const repoUrl = pkg.repository.url
					.replace("git+", "")
					.replace(".git", "")
					.replace("github.com", "raw.githubusercontent.com")
				const metaUrl = `${repoUrl}/main/metadata/functions.json`

				const res = await fetch(metaUrl).catch(() => undefined)
				if (res?.ok) {
					const data = await res.json()
					extensionFunctions.push(...data as FunctionMetadata[])
				}
			}
		} catch { }
	}

	let main: FunctionMetadata[] = []
	if (!pkgNames.includes("@tryforge/forgescript")) {
		const mainUrl = "https://raw.githubusercontent.com/tryforge/ForgeScript/main/metadata/functions.json"
		const mainRes = await fetch(mainUrl).catch(() => undefined)
		main = mainRes?.ok ? await mainRes.json() as FunctionMetadata[] : []
	}

	return [...main, ...extensionFunctions]
}

/**
 * Returns all cached functions.
 * @returns 
 */
export async function getFunctions() {
	if (!functions) functions = await fetchFunctions()
	return functions
}

/**
 * Checks whether the current position is inside the code.
 * @param document The text document.
 * @param position The current position of the cursor.
 * @returns 
 */
export function isInsideCode(document: vscode.TextDocument, position: vscode.Position) {
	const text = document.getText()
	const offset = document.offsetAt(position)

	const CodeRegex = /code:\s*(["`])([\s\S]*?)\1/g
	let match: RegExpExecArray | null

	while ((match = CodeRegex.exec(text)) !== null) {
		const quoteChar = match[1]
		const content = match[2]
		const start = match.index + match[0].indexOf(quoteChar) + 1
		const end = start + content.length

		if (offset >= start && offset <= end) {
			return true
		}
	}

	return false
}

/**
 * Generates the usage string for a function.
 * @param fn The function metadata.
 * @param withTypes Whether to include types for arguments.
 * @returns
 */
export function generateUsage(fn: FunctionMetadata, withTypes: boolean = false) {
	const args = fn.args as IArg<any>[] | undefined
	const usage = args?.length
		? `[${args.map((arg) =>
			`${arg.rest ? "..." : ""}${arg.name}${arg.required ? "" : "?"}${withTypes ? `: ${arg.type}` : ""}`
		).join(";")}]`
		: ""

	return fn.name + usage
}

/**
 * Registers the autocompletion for functions.
 * @param ctx The extension context.
 */
export async function registerAutocompletion(ctx: vscode.ExtensionContext) {
	const functions = await getFunctions()

	const provider = vscode.languages.registerCompletionItemProvider("javascript", {
		provideCompletionItems(document, position) {
			if (!isInsideCode(document, position)) return

			const line = document.lineAt(position).text
			const before = line.substring(0, position.character)

			// Enum autocompletion
			const argMatch = before.match(/\$([a-zA-Z_]+)\[([^\]]*)$/)
			if (argMatch) {
				const fnName: `$${string}` = `$${argMatch[1]}`
				const argsTyped = argMatch[2]

				const fn = functions.find((x) => x.name === fnName || (x.aliases ?? []).includes(fnName))
				if (!fn || !fn.args) return

				const args: IArg<any>[] = fn.args
				const activeIndex = argsTyped.split(";").length - 1
				const activeArg = args[activeIndex]
				if (!activeArg) return

				const enumValues = activeArg.enum
				if (!enumValues) return

				const currentValueMatch = argsTyped.match(/([^;]*)$/)
				const currentValue = currentValueMatch?.[1] ?? ""

				return enumValues.map((val: string) => {
					const item = new vscode.CompletionItem(val, vscode.CompletionItemKind.EnumMember)

					item.insertText = val

					const start = position.translate(0, -currentValue.length)
					item.range = new vscode.Range(start, position)

					return item
				})
			}

			// Function autocompletion
			const match = before.match(/\$[a-zA-Z_]*$/)
			if (!match) return

			return functions.flatMap((fn) => {
				const names = [fn.name, ...(fn.aliases ?? [])]

				return names.map((name) => {
					const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function)

					item.insertText = fn.name
					item.detail = generateUsage(fn)
					item.documentation = new vscode.MarkdownString(
						`${(fn.deprecated ? "🛑 **Deprecated**\n" : fn.experimental ? "⚠️ **Experimental**\n" : "") + "\n" + fn.description}`
					)
					if (fn.deprecated) item.tags = [vscode.CompletionItemTag.Deprecated]

					const startPos = position.translate(0, -match[0].length)
					item.range = new vscode.Range(startPos, position)

					return item
				})
			})
		}
	}, "$", ";", "[")

	ctx.subscriptions.push(provider)
}

/**
 * Registers the hover card for functions.
 * @param ctx The extension context.
 */
export async function registerHover(ctx: vscode.ExtensionContext) {
	const functions = await getFunctions()

	const provider = vscode.languages.registerHoverProvider("javascript", {
		provideHover(document, position) {
			if (!isInsideCode(document, position)) return

			const range = document.getWordRangeAtPosition(position, /\$[a-zA-Z_]+/)
			if (!range) return

			const word = document.getText(range)
			const fn = functions.find((x) => x.name === word)
			if (!fn) return

			const md = new vscode.MarkdownString()
			md.appendCodeblock(`${generateUsage(fn)}${fn.output ? `: ` + (fn.output as Array<ArgType | EnumLike>).join(", ") : ""}\n`)
			md.appendText(`${fn.description}\n`)
			md.appendMarkdown(`---\n`)
			md.appendMarkdown(`##### v${fn.version} | [Documentation](https://docs.botforge.org/function/${fn.name})`)
			md.isTrusted = true

			return new vscode.Hover(md)
		}
	})

	ctx.subscriptions.push(provider)
}

export function deactivate() { }