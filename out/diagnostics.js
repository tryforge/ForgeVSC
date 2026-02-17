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
exports.validateDocument = validateDocument;
const extension_1 = require("./extension");
const vscode = __importStar(require("vscode"));
async function validateDocument(document, collection) {
    if (!document || document.languageId !== "javascript")
        return;
    const functions = await (0, extension_1.getFunctions)();
    const diagnostics = [];
    const text = document.getText();
    const Regex = /\$[a-zA-Z_]+\[?[^\]\n]*\]?/g;
    let match;
    while ((match = Regex.exec(text))) {
        const full = match[0];
        const nameMatch = full.match(/\$[a-zA-Z_]+/);
        if (!nameMatch)
            continue;
        const fnName = nameMatch[0];
        const hasBrackets = full.includes("[");
        const hasClosing = full.includes("]");
        const fn = functions.find((x) => x.name === fnName || (x.aliases ?? []).includes(fnName));
        if (!fn)
            continue;
        const acceptsArgs = fn.brackets !== undefined && fn.args?.length;
        const requiresArgs = fn.brackets;
        const start = document.positionAt(match.index);
        const end = document.positionAt(match.index + full.length);
        const range = new vscode.Range(start, end);
        // Missing brackets but required
        if (requiresArgs && !hasBrackets) {
            diagnostics.push(new vscode.Diagnostic(range, `Function ${fnName} requires brackets`, vscode.DiagnosticSeverity.Error));
        }
        // Missing closing bracket
        else if (acceptsArgs && hasBrackets && !hasClosing) {
            diagnostics.push(new vscode.Diagnostic(range, `Function ${fnName} is missing brace closure`, vscode.DiagnosticSeverity.Error));
        }
    }
    collection.set(document.uri, diagnostics);
}
//# sourceMappingURL=diagnostics.js.map