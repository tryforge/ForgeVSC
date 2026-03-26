"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFolding = registerFolding;
const _1 = require(".");
const vscode_1 = __importDefault(require("vscode"));
/**
 * Registers the folding for function contents.
 * @param ctx The extension context.
 */
function registerFolding(ctx) {
    ctx.subscriptions.push(vscode_1.default.languages.registerFoldingRangeProvider(_1.languages, {
        provideFoldingRanges(document) {
            const config = (0, _1.getExtensionConfig)();
            if (!config.features.folding)
                return null;
            const ranges = [];
            const text = document.getText();
            let match;
            while ((match = _1.FunctionOpenScanRegex.exec(text))) {
                const index = match.index;
                const startPos = document.positionAt(index);
                if (!(0, _1.locateCodeBlock)(document, startPos) || (0, _1.isEscaped)(text, index))
                    continue;
                const openIndex = index + match[0].length - 1;
                const closeIndex = (0, _1.findMatchingBracket)(text, openIndex);
                if (closeIndex === -1)
                    continue;
                const startLine = document.positionAt(openIndex).line;
                const endLine = document.positionAt(closeIndex).line - 1;
                if (endLine > startLine) {
                    ranges.push(new vscode_1.default.FoldingRange(startLine, endLine, vscode_1.default.FoldingRangeKind.Region));
                }
            }
            return ranges;
        }
    }));
}
//# sourceMappingURL=folding.js.map