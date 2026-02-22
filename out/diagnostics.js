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
exports.splitArgs = splitArgs;
exports.findMatchingBracket = findMatchingBracket;
exports.validateDocument = validateDocument;
const _1 = require(".");
const vscode = __importStar(require("vscode"));
/**
 * Splits an argument string into an array of arguments.
 * @param argString The argument string.
 * @returns
 */
function splitArgs(argString) {
    if (argString === undefined)
        return [];
    const args = [];
    let current = "";
    let depth = 0;
    for (let i = 0; i < argString.length; i++) {
        const escaped = (0, _1.isEscaped)(argString, i);
        const char = argString[i];
        if (char === "[" && !escaped)
            depth++;
        else if (char === "]" && !escaped)
            depth--;
        if (char === ";" && depth === 0 && !escaped) {
            args.push(current);
            current = "";
        }
        else
            current += char;
    }
    args.push(current);
    return args;
}
/**
 * Finds the matching bracket position from the start index.
 * @param input The input text.
 * @param openIndex The index of the opening bracket.
 * @returns
 */
function findMatchingBracket(input, openIndex) {
    let depth = 1;
    for (let i = openIndex + 1; i < input.length; i++) {
        const c = input[i];
        if ((0, _1.isEscaped)(input, i))
            continue;
        if (c === "[")
            depth++;
        else if (c === "]") {
            depth--;
            if (depth === 0)
                return i;
        }
    }
    return -1;
}
async function validateDocument(document, collection) {
    const config = (0, _1.getExtensionConfig)();
    if (!document || !_1.languages.includes(document.languageId) || !config.features.diagnostics)
        return;
    const diagnostics = [];
    const text = document.getText();
    // const Regex = /^\$!?#?(?:@\[[^\]]*\])?/
    let match;
    while ((match = _1.FunctionScanRegex.exec(text))) {
        const start = document.positionAt(match.index);
        if (!(0, _1.locateCodeBlock)(document, start))
            continue;
        const full = match[0];
        const fnName = (0, _1.extractFunctionName)(full, true);
        if (!fnName)
            continue;
        const fn = await (0, _1.findFunction)(fnName);
        if (!fn)
            continue;
        // Invalid operator order
        const { isInvalidOrder, rawPrefix } = (0, _1.validateOperatorPrefix)(full);
        if (isInvalidOrder) {
            const offset = rawPrefix.length;
            const opStart = document.positionAt(match.index + 1);
            const opEnd = document.positionAt(match.index + offset);
            diagnostics.push(new vscode.Diagnostic(new vscode.Range(opStart, opEnd), `Function \`${fn.name}\` has invalid operator order`, vscode.DiagnosticSeverity.Error));
            continue;
        }
        const args = fn.args ?? [];
        const acceptsArgs = fn.brackets !== undefined && args.length > 0;
        const requiresArgs = fn.brackets;
        const hasOpening = full.endsWith("[");
        const openIndex = hasOpening ? (match.index + full.length - 1) : -1;
        const end = document.positionAt(match.index + full.length);
        const range = new vscode.Range(start, end);
        // Missing required brackets
        if (requiresArgs && !hasOpening) {
            diagnostics.push(new vscode.Diagnostic(range, `Function \`${fn.name}\` requires brackets`, vscode.DiagnosticSeverity.Error));
            continue;
        }
        if (args.length === 0)
            continue;
        if (acceptsArgs && hasOpening) {
            const closeIndex = findMatchingBracket(text, openIndex);
            // Missing closing bracket
            if (closeIndex === -1) {
                diagnostics.push(new vscode.Diagnostic(range, `Function \`${fn.name}\` is missing brace closure`, vscode.DiagnosticSeverity.Error));
                continue;
            }
            const argString = text.slice(openIndex + 1, closeIndex);
            const providedArgs = splitArgs(argString);
            // Too few arguments
            for (let i = 0; i < args.length; i++) {
                const expected = args[i];
                const provided = providedArgs[i];
                if (expected.required && provided === undefined) {
                    const argStart = document.positionAt(openIndex + 1);
                    const argEnd = document.positionAt(closeIndex);
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(argStart, argEnd), `Function \`${fn.name}\` is missing argument \`${expected.name}\``, vscode.DiagnosticSeverity.Error));
                }
            }
            // Too many arguments
            if (providedArgs.length > args.length && !args.at(-1)?.rest) {
                const end = document.positionAt(closeIndex + 1);
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(start, end), `Function \`${fn.name}\` expects ${args.length} argument${args.length === 1 ? "" : "s"} at most, received ${providedArgs.length}`, vscode.DiagnosticSeverity.Error));
            }
        }
    }
    collection.set(document.uri, diagnostics);
}
//# sourceMappingURL=diagnostics.js.map