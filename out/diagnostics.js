"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDocument = validateDocument;
const _1 = require(".");
const vscode_1 = __importDefault(require("vscode"));
/**
 * Validates a document for diagnostics.
 * @param document The document to validate.
 * @param collection The diagnostic collection.
 * @returns
 */
async function validateDocument(document, collection) {
    const config = (0, _1.getExtensionConfig)();
    if (!document || !_1.languages.includes(document.languageId) || !config.features.diagnostics)
        return;
    const diagnostics = [];
    const text = document.getText();
    // const Regex = /^\$!?#?(?:@\[[^\]]*\])?/
    const ScanRegex = (0, _1.cloneRegex)(_1.FunctionScanRegex);
    ScanRegex.lastIndex = 0;
    let match;
    while ((match = ScanRegex.exec(text))) {
        const index = match.index;
        const start = document.positionAt(index);
        if (!(0, _1.locateCodeBlock)(document, start) || (0, _1.isEscaped)(text, index))
            continue;
        const full = match[0];
        const hasOpening = full.endsWith("[");
        const base = hasOpening ? full.slice(0, -1) : full;
        const found = await (0, _1.findFunction)(base, true);
        if (!found)
            continue;
        const { fn, matchedText } = found;
        const { isInvalidOrder, rawPrefix } = (0, _1.validateOperatorPrefix)(base);
        // Invalid operator order
        if (isInvalidOrder) {
            const offset = rawPrefix.length;
            const opStart = document.positionAt(index + 1);
            const opEnd = document.positionAt(index + offset);
            diagnostics.push(new vscode_1.default.Diagnostic(new vscode_1.default.Range(opStart, opEnd), `Function \`${fn.name}\` has invalid operator order`, vscode_1.default.DiagnosticSeverity.Error));
            continue;
        }
        // Duplicated operators
        const strictPrefix = base.match(_1.FunctionPrefixRegex)?.[0] ?? "$";
        if (rawPrefix.length > strictPrefix.length) {
            const extraStart = document.positionAt(index + strictPrefix.length);
            const extraEnd = document.positionAt(index + rawPrefix.length);
            diagnostics.push(new vscode_1.default.Diagnostic(new vscode_1.default.Range(extraStart, extraEnd), `Function \`${fn.name}\` has duplicated operators supplied`, vscode_1.default.DiagnosticSeverity.Error));
            continue;
        }
        const isAttached = matchedText.length === base.length && matchedText.toLowerCase() === base.toLowerCase();
        const hasOpeningAttached = hasOpening && isAttached;
        const args = fn.args ?? [];
        const acceptsArgs = fn.brackets !== undefined && args.length > 0;
        const requiresArgs = fn.brackets;
        const end = document.positionAt(index + matchedText.length);
        const range = new vscode_1.default.Range(start, end);
        // Missing required brackets
        if (requiresArgs && !hasOpeningAttached) {
            diagnostics.push(new vscode_1.default.Diagnostic(range, `Function \`${fn.name}\` requires brackets`, vscode_1.default.DiagnosticSeverity.Error));
            continue;
        }
        if (!isAttached || args.length === 0)
            continue;
        if (acceptsArgs && hasOpening) {
            const openIndex = index + full.length - 1;
            const closeIndex = (0, _1.findMatchingBracket)(text, openIndex);
            // Missing closing bracket
            if (closeIndex === -1) {
                diagnostics.push(new vscode_1.default.Diagnostic(range, `Function \`${fn.name}\` is missing brace closure`, vscode_1.default.DiagnosticSeverity.Error));
                continue;
            }
            const argString = text.slice(openIndex + 1, closeIndex);
            const providedArgs = (0, _1.splitArgs)(argString);
            // Too few arguments
            for (let i = 0; i < args.length; i++) {
                const expected = args[i];
                const provided = providedArgs[i];
                if (expected.required && provided === undefined) {
                    const argStart = document.positionAt(openIndex + 1);
                    const argEnd = document.positionAt(closeIndex);
                    diagnostics.push(new vscode_1.default.Diagnostic(new vscode_1.default.Range(argStart, argEnd), `Function \`${fn.name}\` is missing argument \`${expected.name}\``, vscode_1.default.DiagnosticSeverity.Error));
                }
            }
            // Too many arguments
            if (providedArgs.length > args.length && !args.at(-1)?.rest) {
                const end = document.positionAt(closeIndex + 1);
                diagnostics.push(new vscode_1.default.Diagnostic(new vscode_1.default.Range(start, end), `Function \`${fn.name}\` expects ${args.length} argument${args.length === 1 ? "" : "s"} at most, received ${providedArgs.length}`, vscode_1.default.DiagnosticSeverity.Error));
            }
        }
    }
    collection.set(document.uri, diagnostics);
}
//# sourceMappingURL=diagnostics.js.map