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
exports.ForgeCodeActionProvider = void 0;
const vscode = __importStar(require("vscode"));
class ForgeCodeActionProvider {
    static providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];
    provideCodeActions(document, range, ctx) {
        const fixes = [];
        for (const diag of ctx.diagnostics) {
            if (diag.code === "forge.missingBraceClosure") {
                const fix = new vscode.CodeAction("Insert closing bracket", vscode.CodeActionKind.QuickFix);
                fix.diagnostics = [diag];
                fix.isPreferred = true;
                const edit = new vscode.WorkspaceEdit();
                edit.insert(document.uri, diag.range.end, "]");
                fix.edit = edit;
                fixes.push(fix);
            }
            if (diag.code === "forge.missingBrackets") {
                const fix = new vscode.CodeAction("Insert required brackets", vscode.CodeActionKind.QuickFix);
                fix.diagnostics = [diag];
                fix.isPreferred = true;
                const edit = new vscode.WorkspaceEdit();
                edit.insert(document.uri, diag.range.end, "[]");
                fix.edit = edit;
                fixes.push(fix);
            }
        }
        return fixes;
    }
}
exports.ForgeCodeActionProvider = ForgeCodeActionProvider;
//# sourceMappingURL=codeActions.js.map