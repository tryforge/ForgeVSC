"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAutocompletion = registerAutocompletion;
const _1 = require(".");
const vscode_1 = __importDefault(require("vscode"));
/**
 * Registers the autocompletion for functions and enums.
 * @param ctx The extension context.
 */
function registerAutocompletion(ctx) {
    ctx.subscriptions.push(vscode_1.default.languages.registerCompletionItemProvider(_1.languages, {
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
                            const item = new vscode_1.default.CompletionItem(name, vscode_1.default.CompletionItemKind.Function);
                            item.insertText = name;
                            item.detail = (0, _1.generateUsage)(fn);
                            item.documentation = new vscode_1.default.MarkdownString(`${(fn.deprecated ? "🛑 **Deprecated**\n" : fn.experimental ? "⚠️ **Experimental**\n" : "") + "\n" + fn.description}${fn.version ? `\n\n*@since* — \`${(0, _1.getPackageName)(fn.source) ?? ""} v${fn.version}\`` : ""}`);
                            item.kind = vscode_1.default.CompletionItemKind.Function;
                            if (fn.deprecated)
                                item.tags = [vscode_1.default.CompletionItemTag.Deprecated];
                            const startPos = position.translate(0, -match[0].length);
                            item.range = new vscode_1.default.Range(startPos, position);
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
                                const item = new vscode_1.default.CompletionItem(val, vscode_1.default.CompletionItemKind.EnumMember);
                                const start = position.translate(0, -currentValue.length);
                                item.insertText = val;
                                item.range = new vscode_1.default.Range(start, position);
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