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
exports.registerFolding = registerFolding;
const _1 = require(".");
const vscode = __importStar(require("vscode"));
/**
 * Registers the folding for function contents.
 * @param ctx The extension context.
 */
function registerFolding(ctx) {
    ctx.subscriptions.push(vscode.languages.registerFoldingRangeProvider(_1.languages, {
        provideFoldingRanges(document) {
            const config = (0, _1.getExtensionConfig)();
            if (!config.features.folding)
                return null;
            const ranges = [];
            const text = document.getText();
            let match;
            while ((match = _1.FunctionOpenScanRegex.exec(text))) {
                const openIndex = match.index + match[0].length - 1;
                const startPos = document.positionAt(match.index);
                if (!(0, _1.locateCodeBlock)(document, startPos))
                    continue;
                const closeIndex = (0, _1.findMatchingBracket)(text, openIndex);
                if (closeIndex === -1)
                    continue;
                const startLine = document.positionAt(openIndex).line;
                const endLine = document.positionAt(closeIndex).line - 1;
                if (endLine > startLine) {
                    ranges.push(new vscode.FoldingRange(startLine, endLine, vscode.FoldingRangeKind.Region));
                }
            }
            return ranges;
        }
    }));
}
//# sourceMappingURL=folding.js.map