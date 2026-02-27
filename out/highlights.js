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
exports.ForgeSemanticTokensProvider = void 0;
exports.registerHighlighting = registerHighlighting;
const _1 = require(".");
const vscode = __importStar(require("vscode"));
const legend = new vscode.SemanticTokensLegend(["function"], []);
function registerHighlighting(ctx) {
    ctx.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider(_1.languages, new ForgeSemanticTokensProvider(), legend));
}
class ForgeSemanticTokensProvider {
    async provideDocumentSemanticTokens(document) {
        const builder = new vscode.SemanticTokensBuilder(legend);
        const text = document.getText();
        _1.FunctionScanRegex.lastIndex = 0;
        let match;
        while ((match = _1.FunctionScanRegex.exec(text))) {
            const start = document.positionAt(match.index);
            if (!(0, _1.locateCodeBlock)(document, start))
                continue;
            const full = match[0];
            let found = await (0, _1.findFunction)(full);
            if (!found && full.endsWith("["))
                found = await (0, _1.findFunction)(full.slice(0, -1));
            if (!found)
                continue;
            const { matchedText } = found;
            const nameMatch = full.match(/[a-zA-Z_]+/);
            if (!nameMatch || nameMatch.index === undefined)
                continue;
            const prefixMatch = matchedText.match(_1.FunctionPrefixRegex)?.[0] ?? "$";
            const nameLength = Math.max(matchedText.length - prefixMatch.length, 0);
            const nameStart = document.positionAt(match.index + prefixMatch.length);
            builder.push(nameStart.line, nameStart.character, nameLength, 0, 0);
        }
        return builder.build();
    }
}
exports.ForgeSemanticTokensProvider = ForgeSemanticTokensProvider;
//# sourceMappingURL=highlights.js.map