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
exports.ForgeSignatureHelpProvider = void 0;
const extension_1 = require("./extension");
const vscode = __importStar(require("vscode"));
class ForgeSignatureHelpProvider {
    async provideSignatureHelp(document, position) {
        if (!(0, extension_1.isInsideCode)(document, position))
            return null;
        const text = document.lineAt(position).text.substring(0, position.character);
        const match = text.match(/\$([a-zA-Z_]+)\[([^\]]*)$/);
        if (!match)
            return null;
        const fnName = `$${match[1]}`;
        const argsTyped = match[2];
        const functions = await (0, extension_1.getFunctions)();
        const fn = functions.find((x) => x.name === fnName || (x.aliases ?? []).includes(fnName));
        if (!fn)
            return null;
        const args = fn.args ?? [];
        const help = new vscode.SignatureHelp();
        const sig = new vscode.SignatureInformation((0, extension_1.generateUsage)(fn, true));
        sig.documentation = fn.description;
        sig.parameters = args.map((arg) => {
            const param = new vscode.ParameterInformation(`${arg.rest ? "..." : ""}${arg.name}${arg.required ? "" : "?"}: ${arg.type}`, new vscode.MarkdownString(`${arg.description}${arg.condition ? "\n\n*(Conditional)*" : ""}\n\n---`));
            return param;
        });
        const activeParam = argsTyped.split(";").length - 1;
        help.signatures = [sig];
        help.activeSignature = 0;
        help.activeParameter = Math.min(activeParam, args.length - 1);
        return help;
    }
}
exports.ForgeSignatureHelpProvider = ForgeSignatureHelpProvider;
//# sourceMappingURL=signature.js.map