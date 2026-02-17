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
exports.activate = activate;
exports.getForgePackages = getForgePackages;
exports.fetchFunctions = fetchFunctions;
exports.getFunctions = getFunctions;
exports.isInsideCode = isInsideCode;
exports.generateUsage = generateUsage;
exports.registerAutocompletion = registerAutocompletion;
exports.registerHover = registerHover;
exports.deactivate = deactivate;
const signature_1 = require("./signature");
const diagnostics_1 = require("./diagnostics");
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
let functions = null;
async function activate(ctx) {
    const diagnostics = vscode.languages.createDiagnosticCollection("forge");
    ctx.subscriptions.push(diagnostics);
    (0, diagnostics_1.validateDocument)(vscode.window.activeTextEditor?.document, diagnostics);
    ctx.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e) => (0, diagnostics_1.validateDocument)(e.document, diagnostics)), vscode.workspace.onDidOpenTextDocument((doc) => (0, diagnostics_1.validateDocument)(doc, diagnostics)));
    ctx.subscriptions.push(vscode.languages.registerSignatureHelpProvider("javascript", new signature_1.ForgeSignatureHelpProvider(), "[", ";"));
    await registerAutocompletion(ctx);
    await registerHover(ctx);
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
 * Fetches all functions from metadata.
 * @returns
 */
async function fetchFunctions() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders)
        return [];
    const root = folders[0].uri.fsPath;
    const pkgNames = getForgePackages();
    let extensionFunctions = [];
    for (const pkgName of pkgNames) {
        const pkgPath = path.join(root, "node_modules", pkgName, "package.json");
        if (!fs.existsSync(pkgPath))
            continue;
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
            const localMeta = path.join(root, "node_modules", pkgName, "metadata", "functions.json");
            if (fs.existsSync(localMeta)) {
                const data = JSON.parse(fs.readFileSync(localMeta, "utf8"));
                extensionFunctions.push(...data);
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
                    extensionFunctions.push(...data);
                }
            }
        }
        catch { }
    }
    let main = [];
    if (!pkgNames.includes("@tryforge/forgescript")) {
        const mainUrl = "https://raw.githubusercontent.com/tryforge/ForgeScript/main/metadata/functions.json";
        const mainRes = await fetch(mainUrl).catch(() => undefined);
        main = mainRes?.ok ? await mainRes.json() : [];
    }
    return [...main, ...extensionFunctions];
}
/**
 * Returns all cached functions.
 * @returns
 */
async function getFunctions() {
    if (!functions)
        functions = await fetchFunctions();
    return functions;
}
/**
 * Checks whether the current position is inside the code.
 * @param document The text document.
 * @param position The current position of the cursor.
 * @returns
 */
function isInsideCode(document, position) {
    const text = document.getText();
    const offset = document.offsetAt(position);
    const CodeRegex = /code:\s*(["`])([\s\S]*?)\1/g;
    let match;
    while ((match = CodeRegex.exec(text)) !== null) {
        const quoteChar = match[1];
        const content = match[2];
        const start = match.index + match[0].indexOf(quoteChar) + 1;
        const end = start + content.length;
        if (offset >= start && offset <= end) {
            return true;
        }
    }
    return false;
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
 * Registers the autocompletion for functions.
 * @param ctx The extension context.
 */
async function registerAutocompletion(ctx) {
    const functions = await getFunctions();
    const provider = vscode.languages.registerCompletionItemProvider("javascript", {
        provideCompletionItems(document, position) {
            if (!isInsideCode(document, position))
                return;
            const line = document.lineAt(position).text;
            const before = line.substring(0, position.character);
            // Enum autocompletion
            const argMatch = before.match(/\$([a-zA-Z_]+)\[([^\]]*)$/);
            if (argMatch) {
                const fnName = `$${argMatch[1]}`;
                const argsTyped = argMatch[2];
                const fn = functions.find((x) => x.name === fnName || (x.aliases ?? []).includes(fnName));
                if (!fn || !fn.args)
                    return;
                const args = fn.args;
                const activeIndex = argsTyped.split(";").length - 1;
                const activeArg = args[activeIndex];
                if (!activeArg)
                    return;
                const enumValues = activeArg.enum;
                if (!enumValues)
                    return;
                const currentValueMatch = argsTyped.match(/([^;]*)$/);
                const currentValue = currentValueMatch?.[1] ?? "";
                return enumValues.map((val) => {
                    const item = new vscode.CompletionItem(val, vscode.CompletionItemKind.EnumMember);
                    item.insertText = val;
                    const start = position.translate(0, -currentValue.length);
                    item.range = new vscode.Range(start, position);
                    return item;
                });
            }
            // Function autocompletion
            const match = before.match(/\$[a-zA-Z_]*$/);
            if (!match)
                return;
            return functions.flatMap((fn) => {
                const names = [fn.name, ...(fn.aliases ?? [])];
                return names.map((name) => {
                    const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
                    item.insertText = fn.name;
                    item.detail = generateUsage(fn);
                    item.documentation = new vscode.MarkdownString(`${(fn.deprecated ? "🛑 **Deprecated**\n" : fn.experimental ? "⚠️ **Experimental**\n" : "") + "\n" + fn.description}`);
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
    const functions = await getFunctions();
    const provider = vscode.languages.registerHoverProvider("javascript", {
        provideHover(document, position) {
            if (!isInsideCode(document, position))
                return;
            const range = document.getWordRangeAtPosition(position, /\$[a-zA-Z_]+/);
            if (!range)
                return;
            const word = document.getText(range);
            const fn = functions.find((x) => x.name === word);
            if (!fn)
                return;
            const md = new vscode.MarkdownString();
            md.appendCodeblock(`${generateUsage(fn)}${fn.output ? `: ` + fn.output.join(", ") : ""}\n`);
            md.appendText(`${fn.description}\n`);
            md.appendMarkdown(`---\n`);
            md.appendMarkdown(`##### v${fn.version} | [Documentation](https://docs.botforge.org/function/${fn.name})`);
            md.isTrusted = true;
            return new vscode.Hover(md);
        }
    });
    ctx.subscriptions.push(provider);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map