"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSignatureHelp = registerSignatureHelp;
const _1 = require(".");
const vscode_1 = __importDefault(require("vscode"));
// export const FunctionPrefixRegex = /\$!?#?(?:@\[[^\]\n]?\])?[a-zA-Z0-9]+$/
/**
 * Registers the signature help for arguments.
 * @param ctx The extension context.
 */
function registerSignatureHelp(ctx) {
    ctx.subscriptions.push(vscode_1.default.languages.registerSignatureHelpProvider(_1.languages, new ForgeSignatureHelpProvider(), "[", ";", "]"));
}
class ForgeSignatureHelpProvider {
    async provideSignatureHelp(document, position) {
        const code = (0, _1.locateCodeBlock)(document, position);
        const config = (0, _1.getExtensionConfig)();
        if (!code || !config.features.signatureHelp)
            return null;
        const text = code.slice;
        const openIndex = (0, _1.findOpeningBracket)(text);
        if (openIndex === -1)
            return null;
        const beforeBracket = text.slice(0, openIndex);
        const match = beforeBracket.match(new RegExp(_1.FunctionRegex.source + "$"));
        if (!match)
            return null;
        const startIndex = beforeBracket.lastIndexOf("$");
        if ((0, _1.isEscaped)(beforeBracket, startIndex))
            return null;
        const typedToken = match[0];
        const found = await (0, _1.findFunction)(typedToken);
        if (!found)
            return null;
        const { fn, matchedText } = found;
        if (matchedText.length !== typedToken.length)
            return null;
        const argsTyped = text.slice(openIndex + 1);
        const args = fn.args ?? [];
        if (args.length === 0)
            return null;
        const help = new vscode_1.default.SignatureHelp();
        const sig = new vscode_1.default.SignatureInformation((0, _1.generateUsage)(fn, true));
        sig.documentation = fn.description;
        sig.parameters = args.map((arg) => {
            const param = new vscode_1.default.ParameterInformation(`${arg.rest ? "..." : ""}${arg.name}${arg.required ? "" : "?"}: ${arg.type}`, new vscode_1.default.MarkdownString(`${arg.description}${arg.condition ? "\n\n*(Conditional)*" : ""}\n\n---`));
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
//# sourceMappingURL=signature.js.map