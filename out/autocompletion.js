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
exports.registerAutocompletion = registerAutocompletion;
const _1 = require(".");
const vscode = __importStar(require("vscode"));
/**
 * Registers the autocompletion for functions and enums.
 * @param ctx The extension context.
 */
function registerAutocompletion(ctx) {
    ctx.subscriptions.push(vscode.languages.registerCompletionItemProvider(_1.languages, {
        async provideCompletionItems(document, position) {
            const config = (0, _1.getExtensionConfig)();
            if (!(0, _1.locateCodeBlock)(document, position) || !config.features.autocompletion)
                return;
            const line = document.lineAt(position).text;
            const before = line.substring(0, position.character);
            // Function autocompletion
            const match = before.match(_1.FunctionAutocompleteRegex);
            if (match) {
                const startIndex = position.character - match[0].length;
                if ((0, _1.isEscaped)(before, startIndex))
                    return;
                if (!(0, _1.validateOperatorPrefix)(match[0]).isInvalidOrder) {
                    const functions = await (0, _1.getFunctions)();
                    const items = functions.flatMap((fn) => {
                        const names = [fn.name, ...(fn.aliases ?? [])];
                        return names.map((name) => {
                            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
                            item.insertText = name;
                            item.detail = (0, _1.generateUsage)(fn);
                            item.documentation = new vscode.MarkdownString(`${(fn.deprecated ? "🛑 **Deprecated**\n" : fn.experimental ? "⚠️ **Experimental**\n" : "") + "\n" + fn.description}${fn.version ? `\n\n*@since* — \`${(0, _1.getPackageName)(fn.source) ?? ""} v${fn.version}\`` : ""}`);
                            item.kind = vscode.CompletionItemKind.Function;
                            if (fn.deprecated)
                                item.tags = [vscode.CompletionItemTag.Deprecated];
                            const startPos = position.translate(0, -match[0].length);
                            item.range = new vscode.Range(startPos, position);
                            return item;
                        });
                    });
                    if (items.length)
                        return items;
                }
            }
            // Enum autocompletion
            const open = (0, _1.findOpeningBracket)(before);
            if (open !== -1) {
                const head = before.slice(0, open);
                const argsTyped = before.slice(open + 1);
                const argMatch = head.match(_1.FunctionHeadRegex);
                if (argMatch) {
                    const fnName = argMatch[1];
                    const startIndex = head.lastIndexOf("$");
                    if (startIndex !== -1 && (0, _1.isEscaped)(head, startIndex))
                        return;
                    const found = await (0, _1.findFunction)(fnName);
                    const fn = found?.fn;
                    if (fn?.args) {
                        const args = fn.args;
                        const lastIndex = args.length - 1;
                        const parts = (0, _1.splitArgs)(argsTyped);
                        let activeIndex = parts.length - 1;
                        if (args[lastIndex]?.rest)
                            activeIndex = Math.min(activeIndex, lastIndex);
                        const activeArg = args[activeIndex];
                        const enumValues = activeArg?.enum || (activeArg.type === "Boolean" ? ["true", "false"] : undefined);
                        if (enumValues) {
                            const currentValue = parts[activeIndex] ?? "";
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
            }
            return;
        }
    }, "$", ";", "["));
}
//# sourceMappingURL=autocompletion.js.map