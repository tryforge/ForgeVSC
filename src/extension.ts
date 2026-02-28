import {
	getExtensionConfig,
	loadCustomFunctions,
	loadExtensionConfig,
	registerAutocompletion,
	registerCommands,
	registerFolding,
	registerHighlighting,
	registerHover,
	registerSignatureHelp,
	registerSuggestions,
	validateDocument
} from "."
import { IArg, INativeFunction } from "@tryforge/forgescript"
import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs"

export type FunctionMetadata = Omit<INativeFunction<any>, "execute"> & { package?: string }
export interface IMetadataCache {
	version: 1
	key: string
	timestamp: number
	functions: FunctionMetadata[]
}

let functionsPromise: Promise<FunctionMetadata[]> | null = null
let functions: FunctionMetadata[] | null = null

let ExtensionContext: vscode.ExtensionContext
export let Logger: vscode.LogOutputChannel

export const OperatorChain = String.raw`(?:!?#?(?:@\[[^\]]?\])?)?`
export const LooseOperatorChain = String.raw`(?:[!#]|(?:@\[[^\]]?\]))*`

export const FunctionPrefixRegex = /^\$(!)?(#)?(?:@\[([^\]]*)\])?/
export const FunctionRegex = new RegExp(String.raw`\$${OperatorChain}[a-zA-Z_]+`)
export const FunctionNameRegex = new RegExp(String.raw`\$${OperatorChain}([a-zA-Z_]+)`)
export const FunctionHeadRegex = new RegExp(String.raw`(\$${OperatorChain}[a-zA-Z_]+)$`)
export const FunctionArgumentRegex = new RegExp(String.raw`\$${OperatorChain}([a-zA-Z_]+)\[([^\]]*)$`)
export const FunctionAutocompleteRegex = new RegExp(String.raw`\$${OperatorChain}[a-zA-Z_]*$`)
export const FunctionOpenScanRegex = new RegExp(String.raw`\$${OperatorChain}[a-zA-Z_]+\[`, "g")
export const FunctionScanRegex = new RegExp(String.raw`\$${LooseOperatorChain}[a-zA-Z_]+(?:\[)?`, "g")
export const LooseFunctionNameRegex = new RegExp(String.raw`^\$${LooseOperatorChain}([a-zA-Z_]+)`)
export const LooseFunctionPrefixRegex = new RegExp(String.raw`^\$${LooseOperatorChain}`)
export const InvalidOperatorRegex = /#.*!|@\[\].*!|@\[\].*#/

export const OperatorInfo = {
	"!": {
		name: "Negation Operator",
		description: `The negation operator disables any possible output of a function. This can be useful for functions that return a "status" after execution, such as booleans or numbers.`,
	},
	"#": {
		name: "Silent Operator",
		description: "The silent operator will suppress any error a function might throw and stops further code execution as well.",
	},
	"@": {
		name: "Count Operator",
		description: "The count operator directly counts the values of a possible array output from a function using a delimiter (separator). This operator only takes in **1 character**.",
	}
}
export const languages = ["javascript", "typescript", "javascriptreact", "typescriptreact"]
const MetadataCacheKey = "forgevsc.metadataCache.v1"

export async function activate(ctx: vscode.ExtensionContext) {
	ExtensionContext = ctx

	Logger = vscode.window.createOutputChannel("ForgeVSC", { log: true })
	Logger.show(true)
	Logger.info("Starting extension...")

	registerCommands(ctx)

	await loadExtensionConfig()
	registerHighlighting(ctx)
	registerFolding(ctx)

	const watcher = vscode.workspace.createFileSystemWatcher("**/.forgevsc.json")
	ctx.subscriptions.push(
		watcher,
		watcher.onDidCreate(async () => await loadExtensionConfig()),
		watcher.onDidChange(async () => await loadExtensionConfig()),
		watcher.onDidDelete(async () => await loadExtensionConfig())
	)

	const diagnostics = vscode.languages.createDiagnosticCollection("forge")
	ctx.subscriptions.push(diagnostics)

	validateDocument(vscode.window.activeTextEditor?.document, diagnostics)

	ctx.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((event) => {
			validateDocument(event.document, diagnostics)

			const editor = vscode.window.activeTextEditor
			if (!editor || (event.document !== editor.document)) return

			for (const change of event.contentChanges) {
				if (change.text === "" || change.text.includes(";")) {
					vscode.commands.executeCommand("editor.action.triggerParameterHints")
					break
				}
			}
		}),
		vscode.workspace.onDidOpenTextDocument((doc) => validateDocument(doc, diagnostics))
	)

	registerHover(ctx)
	registerAutocompletion(ctx)
	registerSignatureHelp(ctx)
	registerSuggestions(ctx)

	Logger.info("Extension started successfully!")
}

/**
 * Builds a cache key.
 * @param pkgNames The names of the packages.
 * @param customPath The custom functions folder path.
 * @returns 
 */
export function buildCacheKey(pkgNames: string[], customPath?: string) {
	return JSON.stringify({
		pkgs: [...pkgNames].sort(),
		custom: customPath ?? ""
	})
}

/**
 * Reads the metadata from cache.
 * @param key The cache key.
 * @returns 
 */
async function readMetadataCache(key: string) {
	const data = ExtensionContext.globalState.get<IMetadataCache>(MetadataCacheKey)
	if (!data) return null
	if (data.version !== 1) return null
	if (data.key !== key) return null
	return data.functions
}

/**
 * Writes the metadata to cache.
 * @param key The cache key.
 * @param functions The function metadata to store.
 */
async function writeMetadataCache(key: string, functions: FunctionMetadata[]) {
	const payload: IMetadataCache = { version: 1, key, timestamp: Date.now(), functions }
	await ExtensionContext.globalState.update(MetadataCacheKey, payload)
}

/**
 * Clears the metadata from cache.
 */
async function clearMetadataCache() {
	await ExtensionContext.globalState.update(MetadataCacheKey, undefined)
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
 * Overwrites matching native functions with custom functions.
 * @param native The native function metadata.
 * @param custom The custom function metadata.
 * @returns 
 */
export function overwriteNative(native: FunctionMetadata[], custom: FunctionMetadata[]) {
	const map = new Map<string, FunctionMetadata>()
	const overwrite = (data: FunctionMetadata[]) => {
		for (const fn of data) map.set(fn.name.toLowerCase(), fn)
	}

	overwrite(native)
	overwrite(custom)

	return [...map.values()]
}

/**
 * Fetches all functions from metadata.
 * @param force Whether to force fetching.
 * @returns 
 */
export async function fetchFunctions(force: boolean = false) {
	const folders = vscode.workspace.workspaceFolders
	if (!folders) return []

	const root = folders[0].uri.fsPath
	const pkgNames = getForgePackages()
	const customPath = getExtensionConfig().customFunctionsPath
	const cacheKey = buildCacheKey(pkgNames, customPath)

	if (!force) {
		const cached = await readMetadataCache(cacheKey)
		if (cached) {
			Logger.info(`Loaded cached metadata (${cached.length} functions).`)
			return cached
		}
	}

	let def = "@tryforge/forgescript"
	let extensionFunctions: FunctionMetadata[] = []
	let failedFetch = []
	let fetchMain = false

	const appendPackage = (data: FunctionMetadata[], pkgName: string) =>
		data.map((x) => ({ ...x, package: pkgName }))

	for (const pkgName of pkgNames) {
		const pkgPath = path.join(root, "node_modules", pkgName, "package.json")
		if (!fs.existsSync(pkgPath)) {
			if (pkgName !== def) failedFetch.push(pkgName)
			continue
		}

		try {
			const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))
			const localMeta = path.join(root, "node_modules", pkgName, "metadata", "functions.json")

			if (fs.existsSync(localMeta)) {
				const data: FunctionMetadata[] = JSON.parse(fs.readFileSync(localMeta, "utf8"))
				const meta = appendPackage(data, pkgName)
				extensionFunctions.push(...meta)
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
					const data = await res.json() as FunctionMetadata[]
					const meta = appendPackage(data, pkgName)
					extensionFunctions.push(...meta)
				}
			} else {
				if (pkgName !== def) failedFetch.push(pkgName)
				else fetchMain = true
			}
		} catch { }
	}

	let main: FunctionMetadata[] = []
	if (!pkgNames.includes(def) || !fs.existsSync(path.join(root, "node_modules")) || fetchMain) {
		const mainUrl = "https://raw.githubusercontent.com/tryforge/ForgeScript/main/metadata/functions.json"
		const mainRes = await fetch(mainUrl).catch(() => undefined)
		if (mainRes?.ok) {
			const data = await mainRes.json() as FunctionMetadata[]
			const meta = appendPackage(data, def)
			main = meta
		} else {
			failedFetch.unshift(def)
			main = []
		}
	}

	const customFunctions = await loadCustomFunctions(customPath) as FunctionMetadata[]
	const metadata = [...main, ...extensionFunctions]
	const failed = failedFetch.length
	const fetched = pkgNames.length - failed

	Logger.info(`Fetched metadata from ${metadata.length} functions across ${fetched} package${fetched === 1 ? "" : "s"}.`)
	if (customPath) Logger.info(`Fetched metadata from ${customFunctions.length} custom function${customFunctions.length === 1 ? "" : "s"}.`)
	if (failed) {
		const text = `Fetching metadata failed for following ${failed} package${failed === 1 ? "" : "s"}: ` + failedFetch.join(", ")
		Logger.error(text)
		vscode.window.showErrorMessage(text)
	}
	const merged = overwriteNative(metadata, customFunctions)

	await writeMetadataCache(cacheKey, merged)
	return merged
}

/**
 * Returns all cached functions.
 * @param force Whether to force fetching.
 * @returns 
 */
export async function getFunctions(force: boolean = false) {
	if (functions && !force) return functions

	if (!functionsPromise) {
		functionsPromise = (async () => {
			const res = await fetchFunctions(force)
			functions = res
			return res
		})().finally(() => {
			functionsPromise = null
		})
	}

	return functionsPromise
}

/**
 * Locates the code block and returns relevant data.
 * @param document The text document.
 * @param position The current position of the cursor.
 * @returns 
 */
export function locateCodeBlock(document: vscode.TextDocument, position: vscode.Position) {
	const text = document.getText()
	const offset = document.offsetAt(position)

	const CodeRegex = /code:\s*(["`'])/g
	let match: RegExpExecArray | null

	while ((match = CodeRegex.exec(text)) !== null) {
		const quoteChar = match[1]
		const start = CodeRegex.lastIndex

		let end = -1
		for (let i = start; i < text.length; i++) {
			if (text[i] !== quoteChar || isEscaped(text, i, true)) continue
			end = i
			break
		}
		if (end === -1) continue

		if (offset >= start && offset <= end) {
			const slice = text.slice(start, offset)
			return { start, end, quoteChar, slice }
		}

		CodeRegex.lastIndex = end + 1
	}

	return null
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
 * Finds a function by its name.
 * @param name The function name.
 * @param loose Whether to extract loosely.
 */
export async function findFunction(name: string, loose: boolean = false) {
	const match = name.match(loose ? LooseFunctionNameRegex : FunctionNameRegex)
	if (!match) return null

	const prefix = name.match(FunctionPrefixRegex)?.[0] ?? "$"
	const typed = match[1].toLowerCase()
	const strict = name.trimEnd().endsWith("[")

	const all = await getFunctions()
	const findFn = (fnName: string) => all.find((x) =>
		x.name.toLowerCase() === fnName || (x.aliases ?? []).some((a) => a.toLowerCase() === fnName)
	)

	if (strict) {
		const fnName = `$${typed}`
		const fn = findFn(fnName)
		if (!fn) return null
		return { fn, matchedText: prefix + typed }
	}

	for (let len = typed.length; len > 0; len--) {
		const raw = typed.slice(0, len)
		const fnName = `$${raw}`
		const fn = findFn(fnName)
		if (fn) return { fn, matchedText: prefix + raw }
	}

	return null
}

/**
 * Validates the operator prefix order from the input.
 * @param input The input text.
 * @returns 
 */
export function validateOperatorPrefix(input: string) {
	const rawPrefix = input.match(LooseFunctionPrefixRegex)?.[0] ?? "$"
	const normalizedPrefix = rawPrefix.replace(/@\[[^\]]*\]/g, "@[]")
	const isInvalidOrder = InvalidOperatorRegex.test(normalizedPrefix)

	return { rawPrefix, normalizedPrefix, isInvalidOrder }
}

/**
 * Checks whether the input is escaped.
 * @param input The input text.
 * @param i The index number.
 * @param single Whether the input is escaped using a single backslash.
 * @param minIndex The minimum index.
 * @returns 
 */
export function isEscaped(input: string, i: number, single: boolean = false, minIndex: number = 0) {
	let slashes = 0
	for (let j = i - 1; j >= minIndex && input[j] === "\\"; j--) slashes++
	return single ? (slashes % 2 === 1) : (slashes >= 2 && slashes % 2 === 0)
}

/**
 * Checks whether the input is an opening function bracket.
 * @param input The input text.
 * @param bracketIndex The bracket index.
 * @returns 
 */
export function isOpeningBracket(input: string, bracketIndex: number) {
	if (bracketIndex <= 0) return false

	const prev = input[bracketIndex - 1]
	if (/\s/.test(prev)) return false

	const before = input.slice(0, bracketIndex)
	return new RegExp(FunctionRegex.source + "$").test(before)
}

/**
 * Finds the opening bracket position from the input text.
 * @param input The input text.
 * @returns 
 */
export function findOpeningBracket(input: string) {
	let depth = 0

	for (let i = input.length - 1; i >= 0; i--) {
		const c = input[i]

		if (c === "]" && !isEscaped(input, i)) {
			depth++
			continue
		}

		if (c === "[") {
			if (!isOpeningBracket(input, i)) continue
			if (depth > 0) depth--
			else return i
		}
	}

	return -1
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

		if (c === "[" && isOpeningBracket(input, i)) {
			depth++
			continue
		}

		if (c === "]" && !isEscaped(input, i)) {
			depth--
			if (depth === 0) return i
		}
	}

	return -1
}

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

		if (char === "[" && isOpeningBracket(argString, i)) depth++
		else if (char === "]" && depth > 0 && !escaped) depth--

		if (char === ";" && depth === 0 && !escaped) {
			args.push(current)
			current = ""
		} else current += char
	}

	args.push(current)
	return args
}

/**
 * Returns the depth of function brackets.
 * @param input The input text.
 * @returns 
 */
export function bracketDepth(input: string) {
	let depth = 0

	for (let i = 0; i < input.length; i++) {
		const c = input[i]
		if (c === "[" && isOpeningBracket(input, i)) depth++
		else if (c === "]" && depth > 0 && !isEscaped(input, i)) depth--
	}

	return depth
}

export function deactivate() {
	Logger.info("Deactivated extension.")
}