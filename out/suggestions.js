"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSuggestions = registerSuggestions;
const _1 = require(".");
const vscode_1 = __importDefault(require("vscode"));
/**
 * Registers the suggestions for function brackets.
 * @param ctx The extension context.
 */
function registerSuggestions(ctx) {
    ctx.subscriptions.push(vscode_1.default.languages.registerInlineCompletionItemProvider(_1.languages, new ForgeInlineCompletionItemProvider()));
}
class ForgeInlineCompletionItemProvider {
    async provideInlineCompletionItems(document, position) {
        const code = (0, _1.locateCodeBlock)(document, position);
        const config = (0, _1.getExtensionConfig)();
        if (!code || !config.features.suggestions)
            return null;
        const slice = code.slice.replace(/[ \t\r]+$/g, "");
        const nextChar = document.getText(new vscode_1.default.Range(position, position.translate(0, 1)));
        // Suggest brackets
        if (nextChar !== "[") {
            const match = slice.match(_1.FunctionHeadRegex);
            if (match) {
                const startIndex = slice.lastIndexOf("$");
                if (startIndex !== -1 && (0, _1.isEscaped)(slice, startIndex))
                    return null;
                const found = await (0, _1.findFunction)(match[1]);
                if (found?.fn.brackets !== undefined) {
                    return [new vscode_1.default.InlineCompletionItem("[]", new vscode_1.default.Range(position, position))];
                }
            }
        }
        // Suggest closing bracket
        if (nextChar !== "]") {
            const openIndex = (0, _1.findOpeningBracket)(code.slice);
            if (openIndex !== -1) {
                const head = code.slice.slice(0, openIndex);
                const index = head.lastIndexOf("$");
                if (index !== -1 && (0, _1.isEscaped)(head, index))
                    return null;
                if (_1.FunctionHeadRegex.test(head)) {
                    const block = document.getText().slice(code.start, code.end);
                    const close = (0, _1.findMatchingBracket)(block, openIndex);
                    const missingClosing = (0, _1.bracketDepth)(block) > 0;
                    if (close === -1 || missingClosing) {
                        return [new vscode_1.default.InlineCompletionItem("]", new vscode_1.default.Range(position, position))];
                    }
                }
            }
        }
        return null;
    }
}
//# sourceMappingURL=suggestions.js.map