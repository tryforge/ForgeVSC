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
exports.ForgeInlineCompletionItemProvider = exports.FunctionHeadRegex = void 0;
exports.isEscaped = isEscaped;
exports.hasUnclosedBracket = hasUnclosedBracket;
const _1 = require(".");
const vscode = __importStar(require("vscode"));
exports.FunctionHeadRegex = new RegExp(String.raw `(\$${_1.OperatorChain}[a-zA-Z_]+)$`);
/**
 * Checks whether the input is escaped.
 * @param input The input text.
 * @param i The index number.
 * @returns
 */
function isEscaped(input, i) {
    let slashes = 0;
    for (let j = i - 1; j >= 0 && input[j] === "\\"; j--)
        slashes++;
    return slashes % 2 === 1;
}
/**
 * Checks whether a function has an unclosed bracket.
 * @param before The input text.
 * @returns
 */
function hasUnclosedBracket(before) {
    let depth = 0;
    for (let i = 0; i < before.length; i++) {
        const c = before[i];
        if (isEscaped(before, i))
            continue;
        if (c === "[")
            depth++;
        else if (c === "]" && depth > 0)
            depth--;
    }
    return depth > 0;
}
class ForgeInlineCompletionItemProvider {
    async provideInlineCompletionItems(document, position) {
        const code = (0, _1.locateCodeBlock)(document, position);
        const config = (0, _1.getExtensionConfig)();
        if (!code || !config.features.suggestions)
            return null;
        const slice = code.slice.replace(/[ \t\r]+$/g, "");
        const nextChar = document.getText(new vscode.Range(position, position.translate(0, 1)));
        // Suggest brackets (doesn't work)
        const match = slice.match(exports.FunctionHeadRegex);
        if (match && nextChar !== "[") {
            const full = match[1];
            const found = await (0, _1.findFunction)(full, true);
            if (found) {
                if (found.fn.brackets !== undefined) {
                    return [new vscode.InlineCompletionItem("[]", new vscode.Range(position, position))];
                }
            }
        }
        // Suggest closing bracket
        if (slice && hasUnclosedBracket(code.slice) && nextChar !== "]") {
            return [new vscode.InlineCompletionItem("]", new vscode.Range(position, position))];
        }
        return null;
    }
}
exports.ForgeInlineCompletionItemProvider = ForgeInlineCompletionItemProvider;
//# sourceMappingURL=suggestions.js.map