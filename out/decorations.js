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
exports.HexRegex = void 0;
exports.registerDecorations = registerDecorations;
const _1 = require(".");
const vscode = __importStar(require("vscode"));
let decoFn = null;
let decoDollar = null;
let decoSemi = null;
let decoOpNeg = null;
let decoOpSilent = null;
let decoOpCount = null;
let decoOpCountDelim = null;
exports.HexRegex = /^#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
/**
 * Checks whether the input is a valid hex color.
 * @param input The input text.
 * @returns
 */
function isValidHex(input) {
    return exports.HexRegex.test(input.trim());
}
/**
 * Resolves a color input.
 * @param input The input text.
 * @param fallback The color fallback value.
 * @returns
 */
function resolveColor(input, fallback) {
    if (typeof input !== "string")
        return fallback;
    const hex = input.trim();
    if (!isValidHex(hex))
        return fallback;
    return hex.startsWith("#") ? hex : ("#" + hex);
}
let lastDecoKey = "";
/**
 * (Re)creates decoration types only when config colors changed.
 */
function ensureDecorations() {
    const config = (0, _1.getExtensionConfig)();
    const colors = config.colors ?? {};
    const fnColor = resolveColor(colors.function?.name, "#ac75ff");
    const dollarColor = resolveColor(colors.function?.dollar, "#fe7ceb");
    const semiColor = resolveColor(colors.function?.semicolon, "#c586c0");
    const negColor = resolveColor(colors.operators?.negation, dollarColor);
    const silentColor = resolveColor(colors.operators?.silent, dollarColor);
    const countColor = resolveColor(colors.operators?.count, dollarColor);
    const countDelimColor = resolveColor(colors.operators?.countDelimiter, countColor);
    const key = [
        fnColor,
        dollarColor,
        semiColor,
        negColor,
        silentColor,
        countColor,
        countDelimColor
    ].join("|");
    if (key === lastDecoKey && decoFn)
        return;
    lastDecoKey = key;
    for (const d of [decoFn, decoDollar, decoSemi, decoOpNeg, decoOpSilent, decoOpCount, decoOpCountDelim]) {
        d?.dispose();
    }
    decoFn = vscode.window.createTextEditorDecorationType({ color: fnColor });
    decoDollar = vscode.window.createTextEditorDecorationType({ color: dollarColor });
    decoSemi = vscode.window.createTextEditorDecorationType({ color: semiColor });
    decoOpNeg = vscode.window.createTextEditorDecorationType({ color: negColor });
    decoOpSilent = vscode.window.createTextEditorDecorationType({ color: silentColor });
    decoOpCount = vscode.window.createTextEditorDecorationType({ color: countColor });
    decoOpCountDelim = vscode.window.createTextEditorDecorationType({ color: countDelimColor });
}
async function applyDecorations(editor) {
    ensureDecorations();
    if (!decoFn || !decoDollar || !decoSemi || !decoOpNeg || !decoOpSilent || !decoOpCount || !decoOpCountDelim) {
        return;
    }
    const doc = editor.document;
    const text = doc.getText();
    const fnRanges = [];
    const dollarRanges = [];
    const semiRanges = [];
    const opNegRanges = [];
    const opSilentRanges = [];
    const opCountRanges = [];
    const opCountDelimRanges = [];
    const ScanRegex = (0, _1.cloneRegex)(_1.FunctionScanRegex);
    ScanRegex.lastIndex = 0;
    let match;
    while ((match = ScanRegex.exec(text))) {
        const matchIndex = match.index;
        const startPos = doc.positionAt(matchIndex);
        if (!(0, _1.locateCodeBlock)(doc, startPos) || (0, _1.isEscaped)(text, matchIndex))
            continue;
        const full = match[0];
        let found = await (0, _1.findFunction)(full);
        if (!found && full.endsWith("["))
            found = await (0, _1.findFunction)(full.slice(0, -1));
        if (!found)
            continue;
        const { matchedText, fn } = found;
        const prefixMatch = matchedText.match(_1.FunctionPrefixRegex)?.[0] ?? "$";
        const nameLength = Math.max(matchedText.length - prefixMatch.length, 0);
        if (nameLength <= 0)
            continue;
        const nameStart = matchIndex + prefixMatch.length;
        fnRanges.push(new vscode.Range(doc.positionAt(nameStart), doc.positionAt(nameStart + nameLength)));
        dollarRanges.push(new vscode.Range(doc.positionAt(matchIndex), doc.positionAt(matchIndex + 1)));
        const prefix = prefixMatch;
        for (let i = 0; i < prefix.length; i++) {
            const c = prefix[i];
            const abs = matchIndex + i;
            if (c === "!") {
                opNegRanges.push(new vscode.Range(doc.positionAt(abs), doc.positionAt(abs + 1)));
            }
            else if (c === "#") {
                opSilentRanges.push(new vscode.Range(doc.positionAt(abs), doc.positionAt(abs + 1)));
            }
            else if (c === "@") {
                const j = prefix.indexOf("@[", i);
                const k = j !== -1 ? prefix.indexOf("]", j) : -1;
                if (j !== -1 && k !== -1) {
                    const absStart = matchIndex + j;
                    const absEnd = matchIndex + k + 1;
                    const hasDelim = k === j + 3;
                    if (hasDelim) {
                        const delimAbs = absStart + 2;
                        opCountRanges.push(new vscode.Range(doc.positionAt(absStart), doc.positionAt(absStart + 2)));
                        opCountRanges.push(new vscode.Range(doc.positionAt(absEnd - 1), doc.positionAt(absEnd)));
                        opCountDelimRanges.push(new vscode.Range(doc.positionAt(delimAbs), doc.positionAt(delimAbs + 1)));
                    }
                    else {
                        opCountRanges.push(new vscode.Range(doc.positionAt(absStart), doc.positionAt(absEnd)));
                    }
                }
                break;
            }
        }
        const acceptsArgs = fn.brackets !== undefined;
        if (!acceptsArgs || !full.endsWith("["))
            continue;
        const openIndex = matchIndex + full.length - 1;
        const closeIndex = (0, _1.findMatchingBracket)(text, openIndex);
        if (closeIndex === -1)
            continue;
        let depth = 0;
        for (let i = openIndex + 1; i < closeIndex; i++) {
            const escaped = (0, _1.isEscaped)(text, i);
            const ch = text[i];
            if (ch === "[" && (0, _1.isOpeningBracket)(text, i))
                depth++;
            else if (ch === "]" && depth > 0 && !escaped)
                depth--;
            else if (ch === ";" && depth === 0 && !escaped) {
                semiRanges.push(new vscode.Range(doc.positionAt(i), doc.positionAt(i + 1)));
            }
        }
    }
    editor.setDecorations(decoFn, fnRanges);
    editor.setDecorations(decoDollar, dollarRanges);
    editor.setDecorations(decoSemi, semiRanges);
    editor.setDecorations(decoOpNeg, opNegRanges);
    editor.setDecorations(decoOpSilent, opSilentRanges);
    editor.setDecorations(decoOpCount, opCountRanges);
    editor.setDecorations(decoOpCountDelim, opCountDelimRanges);
}
/**
 * Registers the decorations for syntax highlighting.
 * @param ctx The extension context.
 */
function registerDecorations(ctx) {
    ensureDecorations();
    const updateAll = () => {
        for (const editor of vscode.window.visibleTextEditors) {
            if (!_1.Languages.includes(editor.document.languageId))
                continue;
            applyDecorations(editor);
        }
    };
    ctx.subscriptions.push({
        dispose: () => {
            for (const d of [decoFn, decoDollar, decoSemi, decoOpNeg, decoOpSilent, decoOpCount, decoOpCountDelim]) {
                d?.dispose();
            }
        }
    }, vscode.window.onDidChangeVisibleTextEditors(() => updateAll()), vscode.workspace.onDidChangeTextDocument((e) => {
        for (const editor of vscode.window.visibleTextEditors) {
            if (editor.document !== e.document)
                continue;
            applyDecorations(editor);
        }
    }));
    updateAll();
}
//# sourceMappingURL=decorations.js.map