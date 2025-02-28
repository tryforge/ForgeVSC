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
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
function activate(context) {
    let provider = vscode.languages.registerCompletionItemProvider({ scheme: "file", language: "javascript" }, {
        async provideCompletionItems(document, position) {
            console.log("🚀 Forge Autocomplete Extension Activated!");
            const linePrefix = document.lineAt(position).text.substring(0, position.character);
            if (!linePrefix.endsWith("$"))
                return undefined;
            console.log("🔄 Fetching functions...");
            const functions = await fetchForgeFunctions();
            if (!functions || functions.length === 0)
                return undefined;
            console.log(`✅ Found ${functions.length} functions`);
            return functions.map(func => {
                const item = new vscode.CompletionItem(func.name, vscode.CompletionItemKind.Function);
                item.insertText = func.brackets ? `${func.name}[]` : func.name;
                item.detail = `v${func.version} - ${func.category}`;
                item.documentation = new vscode.MarkdownString(`**${func.name}**\n\n${func.description}\n\n**Args:**\n${formatArgs(func.args)}`);
                return item;
            });
        },
    }, "$");
    context.subscriptions.push(provider);
}
async function fetchForgeFunctions() {
    try {
        const config = vscode.workspace.getConfiguration("Autocomplete");
        const functionsURL = config.get("functionsURL");
        console.log("📡 Fetching functions from:", functionsURL);
        if (!functionsURL) {
            vscode.window.showErrorMessage("Functions metadata URL is not configured.");
            return [];
        }
        const response = await fetch(functionsURL, {
            headers: { "Accept": "application/vnd.github.v3.raw" }
        });
        console.log("🔄 Response status:", response.status);
        if (!response.ok) {
            vscode.window.showErrorMessage(`Failed to fetch metadata: ${response.statusText}`);
            return [];
        }
        const data = await response.json();
        console.log("✅ Fetched data:", data);
        return (Array.isArray(data) ? data : []).map(func => ({
            name: func.name,
            version: func.version,
            description: func.description,
            brackets: func.brackets,
            category: func.category,
            args: func.args || [],
        }));
    }
    catch (error) {
        vscode.window.showErrorMessage("Error fetching functions: " + error);
        return [];
    }
}
function formatArgs(args) {
    if (!args || args.length === 0)
        return "_No arguments_";
    return args.map(arg => `- **${arg.name}** (${arg.type}) - ${arg.description}`).join("\n");
}
function deactivate() { }
//# sourceMappingURL=extension.js.map