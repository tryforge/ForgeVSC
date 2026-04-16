"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuidesStorageKey = exports.FunctionsStorageKey = exports.Languages = exports.DocsUrl = exports.OperatorInfo = exports.InvalidOperatorRegex = exports.LooseFunctionPrefixRegex = exports.LooseFunctionNameRegex = exports.FunctionScanRegex = exports.FunctionOpenScanRegex = exports.FunctionAutocompleteRegex = exports.FunctionArgumentRegex = exports.FunctionHeadRegex = exports.FunctionNameRegex = exports.FunctionPrefixRegex = exports.FunctionRegex = exports.LooseOperatorChain = exports.OperatorChain = exports.Logger = void 0;
exports.activate = activate;
exports.toArray = toArray;
exports.clearMetadataCache = clearMetadataCache;
exports.isWorkspaceEnabled = isWorkspaceEnabled;
exports.getForgePackages = getForgePackages;
exports.buildPackage = buildPackage;
exports.getPackageName = getPackageName;
exports.fetchFunctions = fetchFunctions;
exports.getFunctions = getFunctions;
exports.fetchGuides = fetchGuides;
exports.getGuides = getGuides;
exports.getPaths = getPaths;
exports.locateCodeBlock = locateCodeBlock;
exports.generateUsage = generateUsage;
exports.buildSourceURL = buildSourceURL;
exports.findFunction = findFunction;
exports.validateOperatorPrefix = validateOperatorPrefix;
exports.cloneRegex = cloneRegex;
exports.isEscaped = isEscaped;
exports.isInsideComment = isInsideComment;
exports.isOpeningBracket = isOpeningBracket;
exports.findOpeningBracket = findOpeningBracket;
exports.findMatchingBracket = findMatchingBracket;
exports.splitArgs = splitArgs;
exports.bracketDepth = bracketDepth;
exports.deactivate = deactivate;
const _1 = require(".");
const vscode = __importStar(require("vscode"));
let functions = null;
let functionsPromise = null;
let guides = null;
let guidesPromise = null;
let paths = new Map();
let pathsPromise = new Map();
let isEnabled = true;
let Context;
exports.OperatorChain = String.raw `(?:!?#?(?:@\[[^\]]?\])?)?`;
exports.LooseOperatorChain = String.raw `(?:[!#]|(?:@\[[^\]]?\]))*`;
exports.FunctionRegex = new RegExp(String.raw `\$${exports.OperatorChain}[a-zA-Z0-9]+`);
exports.FunctionPrefixRegex = new RegExp(String.raw `^\$(!)?(#)?(?:@\[[^\]]*\])?`);
exports.FunctionNameRegex = new RegExp(String.raw `\$${exports.OperatorChain}([a-zA-Z0-9]+)`);
exports.FunctionHeadRegex = new RegExp(String.raw `(\$${exports.OperatorChain}[a-zA-Z0-9]+)$`);
exports.FunctionArgumentRegex = new RegExp(String.raw `\$${exports.OperatorChain}([a-zA-Z0-9]+)\[([^\]]*)$`);
exports.FunctionAutocompleteRegex = new RegExp(String.raw `\$${exports.OperatorChain}[a-zA-Z0-9]*$`);
exports.FunctionOpenScanRegex = new RegExp(String.raw `\$${exports.OperatorChain}[a-zA-Z0-9]+\[`, "g");
exports.FunctionScanRegex = new RegExp(String.raw `\$${exports.LooseOperatorChain}[a-zA-Z0-9]+(?:\[)?`, "g");
exports.LooseFunctionNameRegex = new RegExp(String.raw `^\$${exports.LooseOperatorChain}([a-zA-Z0-9]+)`);
exports.LooseFunctionPrefixRegex = new RegExp(String.raw `^\$${exports.LooseOperatorChain}`);
exports.InvalidOperatorRegex = /#.*!|@\[\].*!|@\[\].*#/;
exports.OperatorInfo = {
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
};
exports.DocsUrl = "https://docs.botforge.org/";
exports.Languages = ["javascript", "typescript", "javascriptreact", "typescriptreact"];
exports.FunctionsStorageKey = "forgevsc.functionsCache.v1";
exports.GuidesStorageKey = "forgevsc.guidesCache.v1";
/**
 * Activates the extension.
 * @param ctx The extension context.
 */
async function activate(ctx) {
    Context = ctx;
    await (0, _1.loadExtensionConfig)();
    isEnabled = isWorkspaceEnabled();
    const name = ctx.extension.packageJSON.displayName ?? "ForgeVSC";
    exports.Logger = vscode.window.createOutputChannel(name, { log: true });
    ctx.subscriptions.push(exports.Logger, 
    // Open Extension Settings
    vscode.commands.registerCommand("forgevsc.openExtensionSettings", async (setting) => {
        await vscode.commands.executeCommand("workbench.action.openSettings", setting?.trim() || "forgevsc.");
    }));
    if (!isEnabled) {
        exports.Logger.info("Extension is disabled for this workspace.");
        const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        status.text = `$(circle-slash) ${name} Disabled`;
        status.tooltip = "Open Extension Settings";
        status.command = {
            command: "forgevsc.openExtensionSettings",
            title: "Open Extension Settings",
            arguments: ["forgevsc.global.enabledWorkspaces"]
        };
        status.show();
        ctx.subscriptions.push(status);
    }
    else {
        initialize(ctx);
    }
    const watcher = vscode.workspace.createFileSystemWatcher("**/{.forgevsc.json,.vscode/.forgevsc.json}");
    ctx.subscriptions.push(watcher, watcher.onDidCreate(reload), watcher.onDidChange(reload), watcher.onDidDelete(reload), vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration("forgevsc"))
            await reload();
    }));
}
/**
 * Initializes the extension.
 * @param ctx The extension context.
 */
function initialize(ctx) {
    exports.Logger.show(true);
    exports.Logger.info("Starting extension...");
    (0, _1.registerCommands)(ctx);
    (0, _1.registerGuidePreview)(ctx);
    (0, _1.registerGuidesView)(ctx);
    (0, _1.registerDecorations)(ctx);
    (0, _1.registerHover)(ctx);
    (0, _1.registerFolding)(ctx);
    (0, _1.registerAutocompletion)(ctx);
    (0, _1.registerSignatureHelp)(ctx);
    (0, _1.registerSuggestions)(ctx);
    const diagnostics = vscode.languages.createDiagnosticCollection("forge");
    ctx.subscriptions.push(diagnostics);
    for (const editor of vscode.window.visibleTextEditors) {
        (0, _1.validateDocument)(editor.document, diagnostics);
    }
    setTimeout(async () => {
        const files = await vscode.workspace.findFiles("**/*.{js,ts,jsx,tsx}", "**/node_modules/**");
        for (const file of files) {
            try {
                const doc = await vscode.workspace.openTextDocument(file);
                (0, _1.validateDocument)(doc, diagnostics);
            }
            catch { }
        }
    }, 0);
    ctx.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event) => {
        (0, _1.validateDocument)(event.document, diagnostics);
        const editor = vscode.window.activeTextEditor;
        if (!editor || (event.document !== editor.document))
            return;
        for (const change of event.contentChanges) {
            if (change.text === "" || change.text.includes(";")) {
                vscode.commands.executeCommand("editor.action.triggerParameterHints");
                break;
            }
        }
    }), vscode.workspace.onDidOpenTextDocument((doc) => (0, _1.validateDocument)(doc, diagnostics)));
    ctx.subscriptions.push(vscode.languages.registerDefinitionProvider(exports.Languages, {
        provideDefinition(document, position) {
            const range = document.getWordRangeAtPosition(position, /\$[a-zA-Z0-9]+/);
            if (!range)
                return;
            const word = document.getText(range);
            return (0, _1.getCustomFunctionLocation)(word);
        }
    }));
    const name = ctx.extension.packageJSON.displayName ?? "ForgeVSC";
    const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    status.text = `$(package) ${name} v` + ctx.extension.packageJSON.version;
    status.command = "forgevsc.openExtensionLog";
    status.tooltip = name + " Extension Details";
    status.show();
    ctx.subscriptions.push(status);
    exports.Logger.info("Extension started successfully!");
}
/**
 * Reloads the extension configuration.
 * @returns
 */
async function reload() {
    await (0, _1.loadExtensionConfig)();
    const newState = isWorkspaceEnabled();
    if (newState === isEnabled)
        return;
    const showInformationMessage = async (message) => {
        const action = await vscode.window.showInformationMessage(message, "Reload", "Open Settings");
        if (action === "Reload")
            await vscode.commands.executeCommand("workbench.action.reloadWindow");
        else if (action === "Open Settings") {
            await vscode.commands.executeCommand("forgevsc.openExtensionSettings", "forgevsc.global.enabledWorkspaces");
        }
    };
    isEnabled = newState;
    if (!isEnabled) {
        exports.Logger.info("Extension disabled after configuration change.");
        await showInformationMessage("Extension is disabled for this workspace. Reload recommended.");
        return;
    }
    exports.Logger.info("Extension enabled after configuration change.");
    await showInformationMessage("Extension has been enabled. Reload to fully activate.");
}
/**
 * Converts the given value to an array.
 * @param value The value to convert.
 * @returns
 */
function toArray(value) {
    if (!value)
        return [];
    return Array.isArray(value) ? value : [value];
}
/**
 * Builds a cache key.
 * @param installed The names of the installed packages.
 * @param additional The names of the additional packages.
 * @param customPaths The custom functions folder paths.
 * @returns
 */
function buildCacheKey(installed, additional = [], customPaths) {
    return JSON.stringify({
        custom: toArray(customPaths),
        installed: [...installed].map((x) => x.name).sort(),
        additional: [...additional].map((x) => x.trim()).filter(Boolean).sort()
    });
}
/**
 * Reads the metadata from cache.
 * @param storageKey The storage key.
 * @param key The cache key.
 * @returns
 */
async function readMetadataCache(storageKey, key) {
    const data = Context.globalState.get(storageKey);
    if (!data || data.version !== 1 || data.key !== key)
        return null;
    return data.metadata;
}
/**
 * Writes the metadata to cache.
 * @param storageKey The storage key.
 * @param key The cache key.
 * @param data The metadata to store.
 */
async function writeMetadataCache(storageKey, key, data) {
    const payload = {
        key,
        version: 1,
        timestamp: Date.now(),
        metadata: data
    };
    await Context.globalState.update(storageKey, payload);
}
/**
 * Clears the metadata from cache.
 * @param storageKey The storage key.
 */
async function clearMetadataCache(storageKey) {
    await Context.globalState.update(storageKey, undefined);
}
/**
 * Checks whether the current workspace is enabled.
 * @returns
 */
function isWorkspaceEnabled() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length)
        return true;
    const config = (0, _1.getExtensionConfig)();
    const enabled = config.enabledWorkspaces ?? [];
    if (!enabled.length)
        return true;
    return folders.some((folder) => enabled.includes(folder.name));
}
/**
 * Returns all forge packages of the workspace.
 * @returns
 */
async function getForgePackages() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders)
        return [];
    const pkgUri = vscode.Uri.joinPath(folders[0].uri, "package.json");
    let data;
    try {
        data = await vscode.workspace.fs.readFile(pkgUri);
    }
    catch {
        return [];
    }
    const pkg = JSON.parse(new TextDecoder().decode(data));
    const deps = Object.entries(pkg.dependencies ?? {});
    return deps
        .filter(([name]) => name.startsWith("@tryforge/") || name.toLowerCase().includes("forge"))
        .map(([name, value]) => ({ name, value }));
}
/**
 * Builds a package source.
 * @param repo The full repo name.
 * @param branch The repo branch.
 * @param label The label used.
 * @returns
 */
function buildPackage(repo, branch, label) {
    return { label, repo, branch: branch || "main" };
}
/**
 * Formats a repository name.
 * @param name The name to format.
 * @returns
 */
function formatRepoName(name) {
    const raw = name.toLowerCase().replace(/^@tryforge\//, "");
    if (!raw.includes("forge"))
        return null;
    const stripped = raw.replace(/^forge[._-]?/, "");
    const upperMap = {
        db: "DB",
        api: "API",
        vsc: "VSC",
        topgg: "TopGG"
    };
    const parts = stripped.split(/[._-]+/).filter(Boolean);
    const formatted = parts.map((part) => {
        const lower = part.toLowerCase();
        if (upperMap[lower])
            return upperMap[lower];
        return lower.charAt(0).toUpperCase() + lower.slice(1);
    }).join("");
    return "Forge" + formatted;
}
/**
 * Returns the formatted name of a package.
 * @param source The package source.
 * @returns
 */
function getPackageName(source) {
    if (!source)
        return null;
    const name = source.repo.split("/")[1];
    if (!name)
        return null;
    return formatRepoName(name) ?? name;
}
/**
 * Returns the identifier of a package.
 * @param source The package source.
 * @returns
 */
function getPackageId(source) {
    const text = source.label?.startsWith("@") ? source.label : source.repo;
    return (text.split("/")[1] ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
/**
 * Gets a repository source.
 * @param pkgName The package name.
 * @returns
 */
function getRepo(pkgName) {
    if (!pkgName.startsWith("@tryforge/"))
        return null;
    const raw = pkgName.split("/")[1];
    if (!raw)
        return null;
    const name = formatRepoName(pkgName);
    if (!name)
        return null;
    return buildPackage(`tryforge/${name}`, "main", pkgName);
}
/**
 * Normalizes a GitHub repo input.
 * @param input The input text.
 * @returns
 */
function normalizeRepo(input) {
    const value = input.trim();
    if (!value)
        return null;
    const githubShort = value.match(/^github:([^/\s]+)\/([^#/\s]+)(?:#([^/\s]+))?$/i);
    if (githubShort)
        return buildPackage(`${githubShort[1]}/${githubShort[2]}`, githubShort[3]);
    const short = value.match(/^([^/\s]+)\/([^#/\s]+)(?:#([^/\s]+))?$/);
    if (short)
        return buildPackage(`${short[1]}/${short[2]}`, short[3]);
    try {
        const clean = value
            .replace(/^git\+/, "")
            .replace(/^github:/i, "https://github.com/")
            .replace(/^git:\/\//i, "https://")
            .replace(/^ssh:\/\/git@github\.com\//i, "https://github.com/")
            .replace(/^git@github\.com:/i, "https://github.com/")
            .replace(/\.git$/, "");
        const url = new URL(clean);
        if (!/^(www\.)?github\.com$/i.test(url.hostname))
            return null;
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts.length < 2)
            return null;
        const owner = parts[0];
        const repo = parts[1];
        let branch = undefined;
        if ((parts[2] === "tree" || parts[2] === "blob") && parts[3])
            branch = parts[3];
        return buildPackage(`${owner}/${repo}`, branch);
    }
    catch {
        return null;
    }
}
/**
 * Resolves an installed package input.
 * @param root The root directory.
 * @param pkg The workspace package.
 * @returns
 */
async function resolveInstalledPackage(root, pkg) {
    const { name, value } = pkg;
    const direct = normalizeRepo(value);
    if (direct)
        return buildPackage(direct.repo, direct.branch, name);
    const pkgUri = vscode.Uri.joinPath(root, "node_modules", name, "package.json");
    try {
        const data = await vscode.workspace.fs.readFile(pkgUri);
        const pkg = JSON.parse(new TextDecoder().decode(data));
        const repo = pkg.repository;
        const ref = typeof repo === "string" ? normalizeRepo(repo) : normalizeRepo(repo?.url);
        if (ref)
            return buildPackage(ref.repo, ref.branch, name);
    }
    catch { }
    const fallback = getRepo(name);
    if (!fallback)
        return null;
    return buildPackage(fallback.repo, fallback.branch, name);
}
/**
 * Resolves an additional package input.
 * @param input The input text.
 * @returns
 */
function resolveAdditionalPackage(input) {
    const ref = normalizeRepo(input);
    if (!ref)
        return null;
    return buildPackage(ref.repo, ref.branch, input);
}
/**
 * Fetches the functions metadata from a repo.
 * @param source The package source.
 * @returns
 */
async function fetchMetadata(source) {
    const url = `https://raw.githubusercontent.com/${source.repo}/${source.branch}/metadata/functions.json`;
    const res = await fetch(url).catch(() => undefined);
    if (!res?.ok)
        return null;
    const data = await res.json();
    return data.map((x) => ({ ...x, source }));
}
/**
 * Overwrites matching native functions with custom functions.
 * @param native The native function metadata.
 * @param custom The custom function metadata.
 * @returns
 */
function overwriteNative(native, custom) {
    const map = new Map();
    const overwrite = (data) => {
        for (const fn of data)
            map.set(fn.name.toLowerCase(), fn);
    };
    overwrite(native);
    overwrite(custom);
    return [...map.values()];
}
/**
 * Fetches all functions from metadata.
 * @param force Whether to force fetching.
 * @returns
 */
async function fetchFunctions(force = false) {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders)
        return [];
    const { additionalPackages, customFunctionPaths } = (0, _1.getExtensionConfig)();
    const root = folders[0].uri;
    const rawInstalled = await getForgePackages();
    const rawAdditional = additionalPackages?.filter(Boolean) ?? [];
    let failedFetch = [];
    const def = buildPackage("tryforge/ForgeScript", "main", "@tryforge/forgescript");
    const getId = (source) => getPackageId(source);
    const installed = (await Promise.all(rawInstalled.map(async (pkg) => {
        const source = await resolveInstalledPackage(root, pkg);
        if (!source && pkg.name !== def.label)
            failedFetch.push(pkg.name);
        return source;
    }))).filter((x) => !!x);
    const additional = rawAdditional.map((input) => {
        const source = resolveAdditionalPackage(input);
        if (!source && input !== def.label)
            failedFetch.push(input);
        return source;
    }).filter((x) => !!x);
    const uniqueAdditional = [...new Map(additional.map((source) => [getId(source), source])).values()];
    const overridden = new Set(uniqueAdditional.map(getId));
    const uniqueInstalled = installed.filter((source) => !overridden.has(getId(source)));
    const cacheKey = buildCacheKey(rawInstalled, rawAdditional, customFunctionPaths);
    if (!force) {
        const cached = await readMetadataCache(exports.FunctionsStorageKey, cacheKey);
        if (cached) {
            exports.Logger.info(`Loaded cached metadata from ${cached.length} functions.`);
            return cached;
        }
    }
    let extensionFunctions = [];
    let fetched = new Set();
    let fetchMain = false;
    for (const pkgSource of uniqueInstalled) {
        const pkgName = pkgSource.label;
        let handled = false;
        try {
            const localMetaUri = vscode.Uri.joinPath(root, "node_modules", pkgName, "metadata", "functions.json");
            const data = await vscode.workspace.fs.readFile(localMetaUri);
            const json = JSON.parse(new TextDecoder().decode(data));
            extensionFunctions.push(...json.map((x) => ({ ...x, source: pkgSource })));
            fetched.add(pkgName);
            handled = true;
        }
        catch { }
        if (!handled) {
            const data = await fetchMetadata(pkgSource);
            if (data) {
                extensionFunctions.push(...data);
                fetched.add(pkgName);
            }
            else {
                if (pkgName !== def.label)
                    failedFetch.push(pkgName);
                else
                    fetchMain = true;
            }
        }
    }
    for (const source of uniqueAdditional) {
        const data = await fetchMetadata(source);
        if (data) {
            extensionFunctions.push(...data);
            fetched.add(source.label);
        }
        else {
            if (getId(source) !== getId(def))
                failedFetch.push(source.label);
            else
                fetchMain = true;
        }
    }
    const hasDefaultInstalled = uniqueInstalled.some((x) => getId(x) === getId(def));
    const hasDefaultAdditional = uniqueAdditional.some((x) => getId(x) === getId(def));
    let main = [];
    if ((!hasDefaultInstalled && !hasDefaultAdditional) || fetchMain) {
        const data = await fetchMetadata(def);
        if (data) {
            main = data;
            fetched.add(def.label);
        }
        else
            failedFetch.unshift(def.label);
    }
    const customFunctions = await (0, _1.loadCustomFunctions)(customFunctionPaths);
    const metadata = [...main, ...extensionFunctions];
    failedFetch = [...new Set(failedFetch)];
    const failed = failedFetch.length;
    const count = fetched.size;
    exports.Logger.info(`Fetched metadata from ${metadata.length} functions across ${count} package${count === 1 ? "" : "s"}.`);
    if (customFunctionPaths.length)
        exports.Logger.info(`Fetched metadata from ${customFunctions.length} custom function${customFunctions.length === 1 ? "" : "s"}.`);
    if (failed) {
        const text = `Fetching metadata failed for following ${failed} package${failed === 1 ? "" : "s"}: ` + failedFetch.join(", ");
        exports.Logger.error(text);
        vscode.window.showErrorMessage(text);
    }
    const merged = overwriteNative(metadata, customFunctions);
    await writeMetadataCache(exports.FunctionsStorageKey, cacheKey, merged);
    return merged;
}
/**
 * Returns all cached functions.
 * @param force Whether to force fetching.
 * @returns
 */
async function getFunctions(force = false) {
    if (functions && !force)
        return functions;
    if (!functionsPromise) {
        functionsPromise = (async () => {
            const res = await fetchFunctions(force);
            functions = res;
            return res;
        })().finally(() => {
            functionsPromise = null;
        });
    }
    return functionsPromise;
}
/**
 * Fetches all guides from metadata.
 * @param force Whether to force fetching.
 */
async function fetchGuides(force = false) {
    const key = "default";
    if (!force) {
        const cached = await readMetadataCache(exports.GuidesStorageKey, key);
        if (cached) {
            exports.Logger.info(`Loaded cached metadata from ${cached.length} guides.`);
            return cached;
        }
    }
    const url = "https://raw.githubusercontent.com/tryforge/ForgeVSC/refs/heads/metadata/guides.json";
    const res = await fetch(url).catch((err) => {
        const text = "Fetching guides failed: " + err;
        exports.Logger.error(text);
        vscode.window.showErrorMessage(text);
        return undefined;
    });
    if (!res)
        return [];
    if (!res.ok) {
        const text = `Fetching guides failed: ${res.status} ${res.statusText}`;
        exports.Logger.error(text);
        vscode.window.showErrorMessage(text);
        return [];
    }
    const data = await res.json();
    exports.Logger.info(`Fetched metadata from ${data.length} guides.`);
    await writeMetadataCache(exports.GuidesStorageKey, key, data);
    return data;
}
/**
 * Returns all cached guides.
 * @param force Whether to force fetching.
 */
async function getGuides(force = false) {
    if (guides && !force)
        return guides;
    if (!guidesPromise) {
        guidesPromise = (async () => {
            const res = await fetchGuides(force);
            guides = res;
            return res;
        })().finally(() => {
            guidesPromise = null;
        });
    }
    return guidesPromise;
}
/**
 * Returns all runtime cached paths.
 * @param source The package source.
 * @returns
 */
async function getPaths(source) {
    const { repo, branch } = source;
    const key = `${repo}#${branch}`;
    const cached = paths.get(key);
    if (cached)
        return cached;
    const pending = pathsPromise.get(key);
    if (pending)
        return pending;
    const promise = (async () => {
        const url = `https://raw.githubusercontent.com/${repo}/${branch}/metadata/paths.json`;
        const res = await fetch(url).catch(() => undefined);
        if (!res?.ok)
            return null;
        const data = await res.json();
        paths.set(key, data);
        return data;
    })();
    pathsPromise.set(key, promise);
    try {
        return await promise;
    }
    finally {
        pathsPromise.delete(key);
    }
}
/**
 * Locates the code block and returns relevant data.
 * @param document The text document.
 * @param position The current position of the cursor.
 * @returns
 */
function locateCodeBlock(document, position) {
    const text = document.getText();
    const offset = document.offsetAt(position);
    const CodeRegex = /code:\s*(["`'])/g;
    let match;
    while ((match = CodeRegex.exec(text)) !== null) {
        const quoteChar = match[1];
        const start = CodeRegex.lastIndex;
        if (isInsideComment(text, match.index)) {
            CodeRegex.lastIndex = start;
            continue;
        }
        let end = -1;
        for (let i = start; i < text.length; i++) {
            if (text[i] !== quoteChar || isEscaped(text, i, true))
                continue;
            end = i;
            break;
        }
        if (end === -1)
            continue;
        if (offset >= start && offset <= end) {
            const slice = text.slice(start, offset);
            return { start, end, quoteChar, slice };
        }
        CodeRegex.lastIndex = end + 1;
    }
    return null;
}
/**
 * Generates the usage string for a function.
 * @param fn The function metadata.
 * @param withTypes Whether to include types for arguments.
 * @returns
 */
function generateUsage(fn, withTypes = false) {
    const args = fn.args;
    const usage = args?.length
        ? `[${args.map((arg) => `${arg.rest ? "..." : ""}${arg.name}${arg.required ? "" : "?"}${withTypes ? `: ${arg.type}` : ""}`).join(";")}]`
        : "";
    return fn.name + usage;
}
/**
 * Builds the source URL for functions.
 * @param fn The function metadata.
 * @returns
 */
async function buildSourceURL(fn) {
    const { source, category } = fn;
    if (!source)
        return null;
    const { repo, branch } = source;
    let path = "src/native";
    const paths = await getPaths(source);
    if (paths)
        path = paths.functions;
    return `https://github.com/${repo}/blob/${branch}/${path}${category ? `/${category}` : ""}/${fn.name.replace("$", "")}.ts`;
}
/**
 * Finds a function by its name.
 * @param name The function name.
 * @param loose Whether to extract loosely.
 */
async function findFunction(name, loose = false) {
    const match = name.match(loose ? exports.LooseFunctionNameRegex : exports.FunctionNameRegex);
    if (!match)
        return null;
    const prefix = name.match(exports.FunctionPrefixRegex)?.[0] ?? "$";
    const typed = match[1].toLowerCase();
    const strict = name.trimEnd().endsWith("[");
    const all = await getFunctions();
    const findFn = (fnName) => all.find((x) => x.name.toLowerCase() === fnName || (x.aliases ?? []).some((a) => a.toLowerCase() === fnName));
    if (strict) {
        const fnName = `$${typed}`;
        const fn = findFn(fnName);
        if (!fn)
            return null;
        return { fn, matchedText: prefix + typed };
    }
    for (let len = typed.length; len > 0; len--) {
        const raw = typed.slice(0, len);
        const fnName = `$${raw}`;
        const fn = findFn(fnName);
        if (fn)
            return { fn, matchedText: prefix + raw };
    }
    return null;
}
/**
 * Validates the operator prefix order from the input.
 * @param input The input text.
 * @returns
 */
function validateOperatorPrefix(input) {
    const rawPrefix = input.match(exports.LooseFunctionPrefixRegex)?.[0] ?? "$";
    const normalizedPrefix = rawPrefix.replace(/@\[[^\]]*\]/g, "@[]");
    const isInvalidOrder = exports.InvalidOperatorRegex.test(normalizedPrefix);
    return { rawPrefix, normalizedPrefix, isInvalidOrder };
}
/**
 * Clones an existing regex.
 * @returns
 */
function cloneRegex(regex) {
    return new RegExp(regex.source, regex.flags);
}
/**
 * Checks whether the input is escaped.
 * @param input The input text.
 * @param i The index number.
 * @param single Whether the input is escaped using a single backslash.
 * @param minIndex The minimum index.
 * @returns
 */
function isEscaped(input, i, single = false, minIndex = 0) {
    let slashes = 0;
    for (let j = i - 1; j >= minIndex && input[j] === "\\"; j--)
        slashes++;
    return single ? (slashes % 2 === 1) : (slashes >= 2 && slashes % 2 === 0);
}
/**
 * Checks whether the input is inside a comment.
 * @param input The input text.
 * @param index The index number.
 * @returns
 */
function isInsideComment(input, index) {
    // Line comments (//)
    const lineStart = input.lastIndexOf("\n", index) + 1;
    const line = input.slice(lineStart, index);
    const lineComment = line.indexOf("//");
    if (lineComment !== -1)
        return true;
    // Block comments (/* */)
    const before = input.slice(0, index);
    const open = before.lastIndexOf("/*");
    const close = before.lastIndexOf("*/");
    return open !== -1 && open > close;
}
/**
 * Checks whether the input is an opening function bracket.
 * @param input The input text.
 * @param bracketIndex The bracket index.
 * @returns
 */
function isOpeningBracket(input, bracketIndex) {
    if (bracketIndex <= 0)
        return false;
    const prev = input[bracketIndex - 1];
    if (/\s/.test(prev))
        return false;
    const before = input.slice(0, bracketIndex);
    return new RegExp(exports.FunctionRegex.source + "$").test(before);
}
/**
 * Finds the opening bracket position from the input text.
 * @param input The input text.
 * @returns
 */
function findOpeningBracket(input) {
    let depth = 0;
    for (let i = input.length - 1; i >= 0; i--) {
        const c = input[i];
        if (c === "]" && !isEscaped(input, i)) {
            depth++;
            continue;
        }
        if (c === "[") {
            if (!isOpeningBracket(input, i))
                continue;
            if (depth > 0)
                depth--;
            else
                return i;
        }
    }
    return -1;
}
/**
 * Finds the matching bracket position from the start index.
 * @param input The input text.
 * @param openIndex The index of the opening bracket.
 * @returns
 */
function findMatchingBracket(input, openIndex) {
    let depth = 1;
    for (let i = openIndex + 1; i < input.length; i++) {
        const c = input[i];
        if (c === "[" && isOpeningBracket(input, i)) {
            depth++;
            continue;
        }
        if (c === "]" && !isEscaped(input, i)) {
            depth--;
            if (depth === 0)
                return i;
        }
    }
    return -1;
}
/**
 * Splits an argument string into an array of arguments.
 * @param argString The argument string.
 * @returns
 */
function splitArgs(argString) {
    if (argString === undefined)
        return [];
    const args = [];
    let current = "";
    let depth = 0;
    for (let i = 0; i < argString.length; i++) {
        const escaped = isEscaped(argString, i);
        const char = argString[i];
        if (char === "[" && isOpeningBracket(argString, i))
            depth++;
        else if (char === "]" && depth > 0 && !escaped)
            depth--;
        if (char === ";" && depth === 0 && !escaped) {
            args.push(current);
            current = "";
        }
        else
            current += char;
    }
    args.push(current);
    return args;
}
/**
 * Returns the depth of function brackets.
 * @param input The input text.
 * @returns
 */
function bracketDepth(input) {
    let depth = 0;
    for (let i = 0; i < input.length; i++) {
        const c = input[i];
        if (c === "[" && isOpeningBracket(input, i))
            depth++;
        else if (c === "]" && depth > 0 && !isEscaped(input, i))
            depth--;
    }
    return depth;
}
/**
 * Deactivates the extension.
 * @param ctx The extension context.
 */
function deactivate() {
    exports.Logger.info("Deactivated extension.");
}
//# sourceMappingURL=extension.js.map