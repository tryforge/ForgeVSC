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
exports.languages = exports.OperatorInfo = exports.InvalidOperatorRegex = exports.LoosePrefixRegex = exports.LooseFunctionNameRegex = exports.FunctionScanRegex = exports.FunctionAutocompleteRegex = exports.FunctionArgumentRegex = exports.FunctionNameRegex = exports.FunctionRegex = exports.OperatorPrefixRegex = exports.LooseOperatorChain = exports.OperatorChain = void 0;
exports.activate = activate;
exports.getForgePackages = getForgePackages;
exports.overwriteNative = overwriteNative;
exports.fetchFunctions = fetchFunctions;
exports.getFunctions = getFunctions;
exports.locateCodeBlock = locateCodeBlock;
exports.generateUsage = generateUsage;
exports.findFunction = findFunction;
exports.extractFunctionName = extractFunctionName;
exports.validateOperatorPrefix = validateOperatorPrefix;
exports.registerAutocompletion = registerAutocompletion;
exports.registerHover = registerHover;
exports.deactivate = deactivate;
const _1 = require(".");
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
let functionsPromise = null;
let functions = null;
let Logger;
exports.OperatorChain = String.raw `(?:!?#?(?:@\[[^\]]?\])?)?`;
exports.LooseOperatorChain = String.raw `(?:[!#]|(?:@\[[^\]]?\]))*`;
exports.OperatorPrefixRegex = /^\$(!)?(#)?(?:@\[([^\]]*)\])?/;
exports.FunctionRegex = new RegExp(String.raw `\$${exports.OperatorChain}[a-zA-Z_]+`);
exports.FunctionNameRegex = new RegExp(String.raw `\$${exports.OperatorChain}([a-zA-Z_]+)`);
exports.FunctionArgumentRegex = new RegExp(String.raw `\$${exports.OperatorChain}([a-zA-Z_]+)\[([^\]]*)$`);
exports.FunctionAutocompleteRegex = new RegExp(String.raw `\$${exports.OperatorChain}[a-zA-Z_]*$`);
exports.FunctionScanRegex = new RegExp(String.raw `\$${exports.LooseOperatorChain}[a-zA-Z_]+(?:\[)?`, "g");
exports.LooseFunctionNameRegex = new RegExp(String.raw `^\$${exports.LooseOperatorChain}([a-zA-Z_]+)`);
exports.LoosePrefixRegex = new RegExp(String.raw `^\$${exports.LooseOperatorChain}`);
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
exports.languages = ["javascript", "typescript", "javascriptreact", "typescriptreact"];
async function activate(ctx) {
    Logger = vscode.window.createOutputChannel("ForgeVSC", { log: true });
    Logger.show(true);
    Logger.appendLine("Starting extension...");
    (0, _1.registerCommands)(ctx);
    await (0, _1.loadExtensionConfig)();
    (0, _1.registerHighlighting)(ctx);
    const watcher = vscode.workspace.createFileSystemWatcher("**/.forgevsc.json");
    ctx.subscriptions.push(watcher, watcher.onDidCreate(async () => await (0, _1.loadExtensionConfig)()), watcher.onDidChange(async () => await (0, _1.loadExtensionConfig)()), watcher.onDidDelete(async () => await (0, _1.loadExtensionConfig)()));
    const diagnostics = vscode.languages.createDiagnosticCollection("forge");
    ctx.subscriptions.push(diagnostics);
    (0, _1.validateDocument)(vscode.window.activeTextEditor?.document, diagnostics);
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
    ctx.subscriptions.push(vscode.languages.registerSignatureHelpProvider(exports.languages, new _1.ForgeSignatureHelpProvider(), "[", ";", "]"));
    ctx.subscriptions.push(vscode.languages.registerInlineCompletionItemProvider(exports.languages, new _1.ForgeInlineCompletionItemProvider()));
    await registerHover(ctx);
    await registerAutocompletion(ctx);
    Logger.appendLine("Extension started successfully!");
}
/**
 * Returns all forge packages of the workspace.
 * @returns
 */
function getForgePackages() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders)
        return [];
    const pkgPath = path.join(folders[0].uri.fsPath, "package.json");
    if (!fs.existsSync(pkgPath))
        return [];
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const deps = [...Object.keys(pkg.dependencies ?? {})];
    return deps.filter((dep) => dep.startsWith("@tryforge/") || dep.includes("forge"));
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
 * @returns
 */
async function fetchFunctions() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders)
        return [];
    const root = folders[0].uri.fsPath;
    const pkgNames = getForgePackages();
    let def = "@tryforge/forgescript";
    let extensionFunctions = [];
    let failedFetch = [];
    let fetchMain = false;
    const appendPackage = (data, pkgName) => data.map((x) => ({ ...x, package: pkgName }));
    for (const pkgName of pkgNames) {
        const pkgPath = path.join(root, "node_modules", pkgName, "package.json");
        if (!fs.existsSync(pkgPath)) {
            if (pkgName !== def)
                failedFetch.push(pkgName);
            continue;
        }
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
            const localMeta = path.join(root, "node_modules", pkgName, "metadata", "functions.json");
            if (fs.existsSync(localMeta)) {
                const data = JSON.parse(fs.readFileSync(localMeta, "utf8"));
                const meta = appendPackage(data, pkgName);
                extensionFunctions.push(...meta);
                continue;
            }
            if ("repository" in pkg && pkg.repository?.url) {
                const repoUrl = pkg.repository.url
                    .replace("git+", "")
                    .replace(".git", "")
                    .replace("github.com", "raw.githubusercontent.com");
                const metaUrl = `${repoUrl}/main/metadata/functions.json`;
                const res = await fetch(metaUrl).catch(() => undefined);
                if (res?.ok) {
                    const data = await res.json();
                    const meta = appendPackage(data, pkgName);
                    extensionFunctions.push(...meta);
                }
            }
            else {
                if (pkgName !== def)
                    failedFetch.push(pkgName);
                else
                    fetchMain = true;
            }
        }
        catch { }
    }
    let main = [];
    if (!pkgNames.includes(def) || !fs.existsSync(path.join(root, "node_modules")) || fetchMain) {
        const mainUrl = "https://raw.githubusercontent.com/tryforge/ForgeScript/main/metadata/functions.json";
        const mainRes = await fetch(mainUrl).catch(() => undefined);
        if (mainRes?.ok) {
            const data = await mainRes.json();
            const meta = appendPackage(data, def);
            main = meta;
        }
        else {
            failedFetch.unshift(def);
            main = [];
        }
    }
    const customPath = (0, _1.getExtensionConfig)().customFunctionsPath;
    const customFunctions = await (0, _1.loadCustomFunctions)(customPath);
    const metadata = [...main, ...extensionFunctions];
    const failed = failedFetch.length;
    const fetched = pkgNames.length - failed;
    Logger.appendLine(`Fetched metadata from ${metadata.length} functions across ${fetched} package${fetched === 1 ? "" : "s"}.`);
    if (customPath)
        Logger.appendLine(`Fetched metadata from ${customFunctions.length} custom functions.`);
    if (failed) {
        const text = `Fetching metadata failed for following ${failed} package${failed === 1 ? "" : "s"}: ` + failedFetch.join(", ");
        Logger.appendLine(text);
        vscode.window.showErrorMessage(text);
    }
    return overwriteNative(metadata, customFunctions);
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
            const res = await fetchFunctions();
            functions = res;
            return res;
        })().finally(() => {
            functionsPromise = null;
        });
    }
    return functionsPromise;
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
    const CodeRegex = /code:\s*(["`'])([\s\S]*?)\1/g;
    let match;
    while ((match = CodeRegex.exec(text)) !== null) {
        const quoteChar = match[1];
        const content = match[2];
        const start = match.index + match[0].indexOf(quoteChar) + 1;
        const end = start + content.length;
        if (offset >= start && offset <= end) {
            const slice = text.slice(start, offset);
            return { start, end, quoteChar, slice };
        }
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
 * Finds a function by its name.
 * @param name The function name.
 */
async function findFunction(name) {
    name = name.toLowerCase();
    return (await getFunctions()).find((x) => x.name.toLowerCase() === name || (x.aliases ?? []).map((a) => a.toLowerCase()).includes(name));
}
/**
 * Extracts the function name from input.
 * @param input The input text.
 * @param loose Whether to extract loosely.
 * @returns
 */
function extractFunctionName(input, loose = false) {
    const match = input.match(loose ? exports.LooseFunctionNameRegex : exports.FunctionNameRegex);
    if (!match)
        return null;
    return `$${match[1]}`;
}
/**
 * Validates the operator prefix order from the input.
 * @param input The input text.
 * @returns
 */
function validateOperatorPrefix(input) {
    const rawPrefix = input.match(exports.LoosePrefixRegex)?.[0] ?? "$";
    const normalizedPrefix = rawPrefix.replace(/@\[[^\]]*\]/g, "@[]");
    const isInvalidOrder = exports.InvalidOperatorRegex.test(normalizedPrefix);
    return { rawPrefix, normalizedPrefix, isInvalidOrder };
}
/**
 * Registers the autocompletion for functions.
 * @param ctx The extension context.
 */
async function registerAutocompletion(ctx) {
    const functions = await getFunctions();
    const provider = vscode.languages.registerCompletionItemProvider(exports.languages, {
        async provideCompletionItems(document, position) {
            const config = (0, _1.getExtensionConfig)();
            if (!locateCodeBlock(document, position) || !config.features.autocompletion)
                return;
            const line = document.lineAt(position).text;
            const before = line.substring(0, position.character);
            // Enum autocompletion
            const argMatch = before.match(exports.FunctionArgumentRegex);
            if (argMatch) {
                const fnName = `$${argMatch[1]}`;
                const argsTyped = argMatch[2];
                const fn = await findFunction(fnName);
                if (fn?.args) {
                    const args = fn.args;
                    const activeIndex = argsTyped.split(";").length - 1;
                    const activeArg = args[activeIndex];
                    const enumValues = activeArg?.enum || (activeArg.type === "Boolean" ? ["true", "false"] : undefined);
                    if (enumValues) {
                        const currentValueMatch = argsTyped.match(/([^;]*)$/);
                        const currentValue = currentValueMatch?.[1] ?? "";
                        return enumValues.map((val) => {
                            const item = new vscode.CompletionItem(val, vscode.CompletionItemKind.EnumMember);
                            const start = position.translate(0, -currentValue.length);
                            item.insertText = val;
                            item.range = new vscode.Range(start, position);
                            return item;
                        });
                    }
                }
            }
            // Function autocompletion
            const match = before.match(exports.FunctionAutocompleteRegex);
            if (!match || validateOperatorPrefix(match[0]).isInvalidOrder)
                return;
            return functions.flatMap((fn) => {
                const names = [fn.name, ...(fn.aliases ?? [])];
                return names.map((name) => {
                    const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
                    item.insertText = name;
                    item.detail = generateUsage(fn);
                    item.documentation = new vscode.MarkdownString(`${(fn.deprecated ? "🛑 **Deprecated**\n" : fn.experimental ? "⚠️ **Experimental**\n" : "") + "\n" + fn.description}\n\n*@since* — \`${fn.package ?? ""}@${fn.version}\``);
                    item.kind = vscode.CompletionItemKind.Function;
                    if (fn.deprecated)
                        item.tags = [vscode.CompletionItemTag.Deprecated];
                    const startPos = position.translate(0, -match[0].length);
                    item.range = new vscode.Range(startPos, position);
                    return item;
                });
            });
        }
    }, "$", ";", "[");
    ctx.subscriptions.push(provider);
}
/**
 * Registers the hover card for functions.
 * @param ctx The extension context.
 */
async function registerHover(ctx) {
    const provider = vscode.languages.registerHoverProvider(exports.languages, {
        async provideHover(document, position) {
            const config = (0, _1.getExtensionConfig)();
            if (!locateCodeBlock(document, position) || !config.features.hoverInfo)
                return;
            // Operator hover
            const operatorRange = document.getWordRangeAtPosition(position, /@\[[^\]]?\]|[!#]/);
            if (operatorRange && operatorRange.contains(position)) {
                const opStr = document.getText(operatorRange);
                const op = (opStr.startsWith("@") ? "@" : opStr);
                const doc = exports.OperatorInfo[op];
                if (!doc)
                    return;
                const md = new vscode.MarkdownString();
                md.appendMarkdown(`**${doc.name} (\`${opStr}\`)**\n\n${doc.description}`);
                return new vscode.Hover(md, operatorRange);
            }
            const line = document.lineAt(position.line).text;
            // const Regex = /\$!?#?(?:@\[[^\]]?\])?[a-zA-Z_]+/g
            const Regex = /\$!?#?(?:@\[[^\]]?\])?[a-zA-Z_]+(\[)?/g;
            let match;
            // Function hover
            while ((match = Regex.exec(line))) {
                const hasOpening = match[1] === "[";
                const start = match.index;
                let end = start + match[0].length;
                if (hasOpening)
                    end--;
                if (position.character >= start && position.character <= end) {
                    const fnName = extractFunctionName(match[0]);
                    if (!fnName)
                        return;
                    const fn = await findFunction(fnName);
                    if (!fn)
                        return;
                    const acceptsArgs = fn.brackets !== undefined;
                    const md = new vscode.MarkdownString();
                    md.appendCodeblock(`${hasOpening && acceptsArgs ? generateUsage(fn) : fn.name}${fn.output ? `: ` + fn.output.join(", ") : ""}\n`);
                    md.appendText(`${fn.description}\n`);
                    if (fn.version) {
                        md.appendMarkdown(`---\n`);
                        md.appendMarkdown(`##### v${fn.version} | [Documentation](https://docs.botforge.org/function/${fn.name})`);
                    }
                    md.isTrusted = true;
                    const range = new vscode.Range(position.line, start, position.line, end);
                    return new vscode.Hover(md, range);
                }
            }
        }
    });
    ctx.subscriptions.push(provider);
}
function deactivate() {
    Logger.appendLine("Deactivated extension.");
}
//# sourceMappingURL=extension.js.map