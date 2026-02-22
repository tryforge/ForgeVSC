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
exports.findOpeningBracket = findOpeningBracket;
const _1 = require(".");
const vscode = __importStar(require("vscode"));
// export const FunctionPrefixRegex = /\$!?#?(?:@\[[^\]\n]?\])?[a-zA-Z_]+$/
/**
 * Finds the opening bracket position from the input text.
 * @param input The input text.
 * @returns
 */
function findOpeningBracket(input) {
    let depth = 0;
    for (let i = input.length - 1; i >= 0; i--) {
        const c = input[i];
        if ((0, _1.isEscaped)(input, i))
            continue;
        if (c === "]")
            depth++;
        else if (c === "[") {
            if (depth > 0)
                depth--;
            else
                return i;
        }
    }
    return -1;
}
class ForgeSignatureHelpProvider {
    async provideSignatureHelp(document, position) {
        const code = (0, _1.locateCodeBlock)(document, position);
        const config = (0, _1.getExtensionConfig)();
        if (!code || !config.features.signatureHelp)
            return null;
        const text = code.slice;
        const openIndex = findOpeningBracket(text);
        if (openIndex === -1)
            return null;
        const beforeBracket = text.slice(0, openIndex);
        const match = beforeBracket.match(new RegExp(_1.FunctionRegex.source + "$"));
        if (!match)
            return null;
        const fnName = (0, _1.extractFunctionName)(match[0]);
        if (!fnName)
            return null;
        const argsTyped = text.slice(openIndex + 1);
        const fn = await (0, _1.findFunction)(fnName);
        if (!fn)
            return null;
        const args = fn.args ?? [];
        if (args.length === 0)
            return null;
        const help = new vscode.SignatureHelp();
        const sig = new vscode.SignatureInformation((0, _1.generateUsage)(fn, true));
        sig.documentation = fn.description;
        sig.parameters = args.map((arg) => {
            const param = new vscode.ParameterInformation(`${arg.rest ? "..." : ""}${arg.name}${arg.required ? "" : "?"}: ${arg.type}`, new vscode.MarkdownString(`${arg.description}${arg.condition ? "\n\n*(Conditional)*" : ""}\n\n---`));
            return param;
        });
        const parts = (0, _1.splitArgs)(argsTyped);
        const typedCount = argsTyped.trim() === "" ? 0 : parts.length;
        const hasRest = args.at(-1)?.rest === true;
        if (!hasRest && typedCount > args.length)
            return null;
        const activeParam = Math.max(typedCount - 1, 0);
        help.signatures = [sig];
        help.activeSignature = 0;
        help.activeParameter = Math.min(activeParam, args.length - 1);
        return help;
    }
}
exports.ForgeSignatureHelpProvider = ForgeSignatureHelpProvider;
//# sourceMappingURL=signature.js.map