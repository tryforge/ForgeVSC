import {
	getExtensionConfig,
	GuideMetadata,
	loadCustomFunctions,
	loadExtensionConfig,
	registerAutocompletion,
	registerCommands,
	registerDecorations,
	registerFolding,
	registerGuidePreview,
	registerGuidesView,
	registerHover,
	registerSignatureHelp,
	registerSuggestions,
	validateDocument
} from "."
import { IArg, INativeFunction } from "@tryforge/forgescript"
import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs"

export type WorkspacePackage = {
	name: string
	value: string
}
export type PackageSource = {
	repo: string
	branch: string
	label?: string
}

export type FunctionMetadata = Omit<INativeFunction<any>, "execute"> & {
	category?: string
	source?: PackageSource
}
export type PathMetadata = {
	functions: string
	events?: string
}

export interface IMetadataCache<T> {
	version: 1
	key: string
	timestamp: number
	metadata: T
}

let functions: FunctionMetadata[] | null = null
let functionsPromise: Promise<FunctionMetadata[]> | null = null

let guides: GuideMetadata[] | null = null
let guidesPromise: Promise<GuideMetadata[]> | null = null

let paths = new Map<string, PathMetadata>()
let pathsPromise = new Map<string, Promise<PathMetadata | null>>()

let ExtensionContext: vscode.ExtensionContext
export let Logger: vscode.LogOutputChannel

export const OperatorChain = String.raw`(?:!?#?(?:@\[[^\]]?\])?)?`
export const LooseOperatorChain = String.raw`(?:[!#]|(?:@\[[^\]]?\]))*`

export const FunctionPrefixRegex = /^\$(!)?(#)?(?:@\[([^\]]*)\])?/
export const FunctionRegex = new RegExp(String.raw`\$${OperatorChain}[a-zA-Z0-9]+`)
export const FunctionNameRegex = new RegExp(String.raw`\$${OperatorChain}([a-zA-Z0-9]+)`)
export const FunctionHeadRegex = new RegExp(String.raw`(\$${OperatorChain}[a-zA-Z0-9]+)$`)
export const FunctionArgumentRegex = new RegExp(String.raw`\$${OperatorChain}([a-zA-Z0-9]+)\[([^\]]*)$`)
export const FunctionAutocompleteRegex = new RegExp(String.raw`\$${OperatorChain}[a-zA-Z0-9]*$`)
export const FunctionOpenScanRegex = new RegExp(String.raw`\$${OperatorChain}[a-zA-Z0-9]+\[`, "g")
export const FunctionScanRegex = new RegExp(String.raw`\$${LooseOperatorChain}[a-zA-Z0-9]+(?:\[)?`, "g")
export const LooseFunctionNameRegex = new RegExp(String.raw`^\$${LooseOperatorChain}([a-zA-Z0-9]+)`)
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

export const DocsUrl = "https://docs.botforge.org/"
export const languages = ["javascript", "typescript", "javascriptreact", "typescriptreact"]

export const FunctionsStorageKey = "forgevsc.functionsCache.v1"
export const GuidesStorageKey = "forgevsc.guidesCache.v1"

/**
 * Activates the extension.
 * @param ctx The extension context.
 */
export async function activate(ctx: vscode.ExtensionContext) {
	ExtensionContext = ctx

	Logger = vscode.window.createOutputChannel("ForgeVSC", { log: true })
	Logger.show(true)
	Logger.info("Starting extension...")

	await loadExtensionConfig()

	registerCommands(ctx)
	registerGuidePreview(ctx)
	registerGuidesView(ctx)

	registerDecorations(ctx)
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

	const name = ctx.extension.packageJSON.displayName ?? "ForgeVSC"
	const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
	status.text = name + " v" + ctx.extension.packageJSON.version
	status.command = "forgevsc.openExtensionPage"
	status.tooltip = name + " Extension Details"
	status.show()

	ctx.subscriptions.push(status)

	Logger.info("Extension started successfully!")
}

/**
 * Builds a cache key.
 * @param installed The names of the installed packages.
 * @param additional The names of the additional packages.
 * @param customPath The custom functions folder path.
 * @returns 
 */
function buildCacheKey(installed: WorkspacePackage[], additional: string[] = [], customPath?: string) {
	return JSON.stringify({
		custom: customPath ?? "",
		installed: [...installed].map((x) => x.name).sort(),
		additional: [...additional].map((x) => x.trim()).filter(Boolean).sort()
	})
}

/**
 * Reads the metadata from cache.
 * @param storageKey The storage key.
 * @param key The cache key.
 * @returns 
 */
async function readMetadataCache<T>(storageKey: string, key: string) {
	const data = ExtensionContext.globalState.get<IMetadataCache<T>>(storageKey)
	if (!data || data.version !== 1 || data.key !== key) return null
	return data.metadata
}

/**
 * Writes the metadata to cache.
 * @param storageKey The storage key.
 * @param key The cache key.
 * @param data The metadata to store.
 */
async function writeMetadataCache<T>(storageKey: string, key: string, data: T) {
	const payload: IMetadataCache<T> = {
		key,
		version: 1,
		timestamp: Date.now(),
		metadata: data
	}

	await ExtensionContext.globalState.update(storageKey, payload)
}

/**
 * Clears the metadata from cache.
 * @param storageKey The storage key.
 */
export async function clearMetadataCache(storageKey: string) {
	await ExtensionContext.globalState.update(storageKey, undefined)
}

/**
 * Returns all forge packages of the workspace.
 * @returns 
 */
export function getForgePackages(): WorkspacePackage[] {
	const folders = vscode.workspace.workspaceFolders
	if (!folders) return []

	const pkgPath = path.join(folders[0].uri.fsPath, "package.json")
	if (!fs.existsSync(pkgPath)) return []

	const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))
	const deps = Object.entries<string>(pkg.dependencies ?? {})

	return deps
		.filter(([name]) => name.startsWith("@tryforge/") || name.toLowerCase().includes("forge"))
		.map(([name, value]) => ({ name, value }))
}

/**
 * Builds a package source.
 * @param repo The full repo name.
 * @param branch The repo branch.
 * @param label The label used.
 * @returns 
 */
export function buildPackage(repo: string, branch?: string, label?: string): PackageSource {
	return { label, repo, branch: branch || "main" }
}

/**
 * Formats a repository name.
 * @param name The name to format.
 * @returns 
 */
function formatRepoName(name: string) {
	const raw = name.toLowerCase().replace(/^@tryforge\//, "")
	if (!raw.includes("forge")) return null

	const stripped = raw.replace(/^forge[._-]?/, "")
	const upperMap: Record<string, string> = {
		db: "DB",
		api: "API",
		vsc: "VSC",
		topgg: "TopGG"
	}

	const parts = stripped.split(/[._-]+/).filter(Boolean)
	const formatted = parts.map((part) => {
		const lower = part.toLowerCase()
		if (upperMap[lower]) return upperMap[lower]
		return lower.charAt(0).toUpperCase() + lower.slice(1)
	}).join("")

	return "Forge" + formatted
}

/**
 * Returns the formatted name of a package.
 * @param source The package source.
 * @returns 
 */
export function getPackageName(source?: PackageSource) {
	if (!source) return null

	const name = source.repo.split("/")[1]
	if (!name) return null

	return formatRepoName(name) ?? name
}

/**
 * Returns the identifier of a package.
 * @param source The package source.
 * @returns 
 */
function getPackageId(source: PackageSource) {
	if (source.label?.startsWith("@")) {
		return (source.label.split("/")[1] ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")
	}
	return (source.repo.split("/")[1] ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

/**
 * Gets a repository source.
 * @param pkgName The package name.
 * @returns 
 */
function getRepo(pkgName: string) {
	if (!pkgName.startsWith("@tryforge/")) return null

	const raw = pkgName.split("/")[1]
	if (!raw) return null

	const name = formatRepoName(pkgName)
	if (!name) return null

	return buildPackage(`tryforge/${name}`, "main", pkgName)
}

/**
 * Normalizes a GitHub repo input.
 * @param input The input text.
 * @returns 
 */
function normalizeRepo(input: string) {
	const value = input.trim()
	if (!value) return null

	const githubShort = value.match(/^github:([^/\s]+)\/([^#/\s]+)(?:#([^/\s]+))?$/i)
	if (githubShort) return buildPackage(`${githubShort[1]}/${githubShort[2]}`, githubShort[3])

	const short = value.match(/^([^/\s]+)\/([^#/\s]+)(?:#([^/\s]+))?$/)
	if (short) return buildPackage(`${short[1]}/${short[2]}`, short[3])

	try {
		const clean = value
			.replace(/^git\+/, "")
			.replace(/^github:/i, "https://github.com/")
			.replace(/^git:\/\//i, "https://")
			.replace(/^ssh:\/\/git@github\.com\//i, "https://github.com/")
			.replace(/^git@github\.com:/i, "https://github.com/")
			.replace(/\.git$/, "")

		const url = new URL(clean)
		if (!/^(www\.)?github\.com$/i.test(url.hostname)) return null

		const parts = url.pathname.split("/").filter(Boolean)
		if (parts.length < 2) return null

		const owner = parts[0]
		const repo = parts[1]
		let branch = undefined

		if ((parts[2] === "tree" || parts[2] === "blob") && parts[3]) branch = parts[3]

		return buildPackage(`${owner}/${repo}`, branch)
	} catch {
		return null
	}
}

/**
 * Resolves an installed package input.
 * @param root The root directory.
 * @param pkg The workspace package.
 * @returns 
 */
function resolveInstalledPackage(root: string, pkg: WorkspacePackage) {
	const { name, value } = pkg

	const direct = normalizeRepo(value)
	if (direct) return buildPackage(direct.repo, direct.branch, name)

	const pkgPath = path.join(root, "node_modules", name, "package.json")
	if (fs.existsSync(pkgPath)) {
		try {
			const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))
			const repo = pkg.repository
			const ref = typeof repo === "string" ? normalizeRepo(repo) : normalizeRepo(repo.url)
			if (ref) return buildPackage(ref.repo, ref.branch, name)
		} catch { }
	}

	const fallback = getRepo(name)
	if (!fallback) return null

	return buildPackage(fallback.repo, fallback.branch, name)
}

/**
 * Resolves an additional package input.
 * @param input The input text.
 * @returns 
 */
function resolveAdditionalPackage(input: string) {
	const ref = normalizeRepo(input)
	if (!ref) return null

	return buildPackage(ref.repo, ref.branch, input)
}

/**
 * Fetches the functions metadata from a repo.
 * @param source The package source.
 * @returns 
 */
async function fetchMetadata(source: PackageSource) {
	const url = `https://raw.githubusercontent.com/${source.repo}/${source.branch}/metadata/functions.json`
	const res = await fetch(url).catch(() => undefined)
	if (!res?.ok) return null

	const data = await res.json() as FunctionMetadata[]
	return data.map((x) => ({ ...x, source }))
}

/**
 * Overwrites matching native functions with custom functions.
 * @param native The native function metadata.
 * @param custom The custom function metadata.
 * @returns 
 */
function overwriteNative(native: FunctionMetadata[], custom: FunctionMetadata[]) {
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

	const { additionalPackages, customFunctionsPath } = getExtensionConfig()
	const root = folders[0].uri.fsPath

	const rawInstalled = getForgePackages()
	const rawAdditional = additionalPackages ?? []
	let failedFetch = []

	const def = buildPackage("tryforge/ForgeScript", "main", "@tryforge/forgescript")
	const getId = (source: PackageSource) => getPackageId(source)

	const installed = rawInstalled.map((pkg) => {
		const source = resolveInstalledPackage(root, pkg)
		if (!source && pkg.name !== def.label) failedFetch.push(pkg.name)
		return source
	}).filter((x): x is PackageSource => !!x)

	const additional = rawAdditional.map((input) => {
		const source = resolveAdditionalPackage(input)
		if (!source && input !== def.label) failedFetch.push(input)
		return source
	}).filter((x): x is PackageSource => !!x)

	const uniqueAdditional = [...new Map(additional.map((source) => [getId(source), source])).values()]
	const overridden = new Set(uniqueAdditional.map(getId))
	const uniqueInstalled = installed.filter((source) => !overridden.has(getId(source)))

	const cacheKey = buildCacheKey(rawInstalled, rawAdditional, customFunctionsPath)
	if (!force) {
		const cached = await readMetadataCache<FunctionMetadata[]>(FunctionsStorageKey, cacheKey)
		if (cached) {
			Logger.info(`Loaded cached metadata from ${cached.length} functions.`)
			return cached
		}
	}

	let main: FunctionMetadata[] = []
	let extensionFunctions: FunctionMetadata[] = []
	let fetchMain = false

	for (const pkgSource of uniqueInstalled) {
		const pkgName = pkgSource.label!
		const pkgPath = path.join(root, "node_modules", pkgName, "package.json")
		if (!fs.existsSync(pkgPath)) {
			const data = await fetchMetadata(pkgSource)
			if (data) extensionFunctions.push(...data)
			else {
				if (pkgName !== def.label) failedFetch.push(pkgName)
				else fetchMain = true
			}
			continue
		}

		const localMeta = path.join(root, "node_modules", pkgName, "metadata", "functions.json")
		if (fs.existsSync(localMeta)) {
			try {
				const data = JSON.parse(fs.readFileSync(localMeta, "utf8")) as FunctionMetadata[]
				extensionFunctions.push(...data.map((x) => ({ ...x, source: pkgSource })))
				continue
			} catch {
				if (pkgName !== def.label) failedFetch.push(pkgName)
				else fetchMain = true
				continue
			}
		}

		const data = await fetchMetadata(pkgSource)
		if (data) extensionFunctions.push(...data)
		else {
			if (pkgName !== def.label) failedFetch.push(pkgName)
			else fetchMain = true
		}
	}

	for (const source of uniqueAdditional) {
		const data = await fetchMetadata(source)
		if (data) extensionFunctions.push(...data)
		else {
			if (getId(source) !== getId(def)) failedFetch.push(source.label)
			else fetchMain = true
		}
	}

	const hasDefaultInstalled = uniqueInstalled.some((x) => getId(x) === getId(def))
	const hasDefaultAdditional = uniqueAdditional.some((x) => getId(x) === getId(def))

	if ((!hasDefaultInstalled && !hasDefaultAdditional) || fetchMain) {
		const data = await fetchMetadata(def)
		if (data) main = data
		else failedFetch.unshift(def.label)
	}

	const packages = uniqueInstalled.length + uniqueAdditional.length + (main.length ? 1 : 0)
	const customFunctions = await loadCustomFunctions(customFunctionsPath) as FunctionMetadata[]
	const metadata = [...main, ...extensionFunctions]

	failedFetch = [...new Set(failedFetch)]
	const failed = failedFetch.length
	const fetched = Math.max(packages - failed, 0)

	Logger.info(`Fetched metadata from ${metadata.length} functions across ${fetched} package${fetched === 1 ? "" : "s"}.`)
	if (customFunctionsPath) Logger.info(`Fetched metadata from ${customFunctions.length} custom function${customFunctions.length === 1 ? "" : "s"}.`)
	if (failed) {
		const text = `Fetching metadata failed for following ${failed} package${failed === 1 ? "" : "s"}: ` + failedFetch.join(", ")
		Logger.error(text)
		vscode.window.showErrorMessage(text)
	}
	const merged = overwriteNative(metadata, customFunctions)

	await writeMetadataCache(FunctionsStorageKey, cacheKey, merged)
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
 * Fetches all guides from metadata.
 * @param force Whether to force fetching.
 */
export async function fetchGuides(force: boolean = false) {
	const key = "default"

	if (!force) {
		const cached = await readMetadataCache<GuideMetadata[]>(GuidesStorageKey, key)
		if (cached) {
			Logger.info(`Loaded cached metadata from ${cached.length} guides.`)
			return cached
		}
	}

	const url = "https://raw.githubusercontent.com/tryforge/ForgeVSC/refs/heads/metadata/guides.json"
	const res = await fetch(url).catch((err) => {
		const text = "Fetching guides failed: " + err
		Logger.error(text)
		vscode.window.showErrorMessage(text)
		return undefined
	})
	if (!res) return []

	if (!res.ok) {
		const text = `Fetching guides failed: ${res.status} ${res.statusText}`
		Logger.error(text)
		vscode.window.showErrorMessage(text)
		return []
	}

	const data = await res.json() as GuideMetadata[]
	Logger.info(`Fetched metadata from ${data.length} guides.`)

	await writeMetadataCache<GuideMetadata[]>(GuidesStorageKey, key, data)
	return data
}

/**
 * Returns all cached guides.
 * @param force Whether to force fetching.
 */
export async function getGuides(force: boolean = false) {
	if (guides && !force) return guides

	if (!guidesPromise) {
		guidesPromise = (async () => {
			const res = await fetchGuides(force)
			guides = res
			return res
		})().finally(() => {
			guidesPromise = null
		})
	}

	return guidesPromise
}

/**
 * Returns all runtime cached paths.
 * @param source The package source.
 * @returns 
 */
export async function getPaths(source: PackageSource) {
	const { repo, branch } = source
	const key = `${repo}#${branch}`

	const cached = paths.get(key)
	if (cached) return cached

	const pending = pathsPromise.get(key)
	if (pending) return pending

	const promise = (async () => {
		const url = `https://raw.githubusercontent.com/${repo}/${branch}/metadata/paths.json`
		const res = await fetch(url).catch(() => undefined)
		if (!res?.ok) return null

		const data = await res.json() as PathMetadata
		paths.set(key, data)
		return data
	})()
	pathsPromise.set(key, promise)

	try {
		return await promise
	} finally {
		pathsPromise.delete(key)
	}
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
 * Builds the source URL for functions.
 * @param fn The function metadata.
 * @returns 
 */
export async function buildSourceURL(fn: FunctionMetadata) {
	const { source, category } = fn
	if (!source) return null

	const { repo, branch } = source
	let path = "src/native"

	const paths = await getPaths(source)
	if (paths) path = paths.functions

	return `https://github.com/${repo}/blob/${branch}/${path}${category ? `/${category}` : ""}/${fn.name.replace("$", "")}.ts`
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
 * Clones an existing regex.
 * @returns 
 */
export function cloneRegex(regex: RegExp) {
	return new RegExp(regex.source, regex.flags)
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

/**
 * Deactivates the extension.
 * @param ctx The extension context.
 */
export function deactivate() {
	Logger.info("Deactivated extension.")
}