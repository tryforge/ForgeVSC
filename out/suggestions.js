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
exports.registerSuggestions = registerSuggestions;
const _1 = require(".");
const vscode = __importStar(require("vscode"));
/**
 * Registers the suggestions for function brackets.
 * @param ctx The extension context.
 */
function registerSuggestions(ctx) {
    ctx.subscriptions.push(vscode.languages.registerInlineCompletionItemProvider(_1.languages, new ForgeInlineCompletionItemProvider()));
}
class ForgeInlineCompletionItemProvider {
    async provideInlineCompletionItems(document, position) {
        const code = (0, _1.locateCodeBlock)(document, position);
        const config = (0, _1.getExtensionConfig)();
        if (!code || !config.features.suggestions)
            return null;
        const slice = code.slice.replace(/[ \t\r]+$/g, "");
        const nextChar = document.getText(new vscode.Range(position, position.translate(0, 1)));
        // Suggest brackets
        if (nextChar !== "[") {
            const match = slice.match(_1.FunctionHeadRegex);
            if (match) {
                const startIndex = slice.lastIndexOf("$");
                if (startIndex !== -1 && (0, _1.isEscaped)(slice, startIndex))
                    return null;
                const found = await (0, _1.findFunction)(match[1]);
                if (found?.fn.brackets !== undefined) {
                    return [new vscode.InlineCompletionItem("[]", new vscode.Range(position, position))];
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
                        return [new vscode.InlineCompletionItem("]", new vscode.Range(position, position))];
                    }
                }
            }
        }
        return null;
    }
}
//# sourceMappingURL=suggestions.js.map