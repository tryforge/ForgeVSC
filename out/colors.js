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
exports.registerColorPicker = registerColorPicker;
const _1 = require(".");
const vscode = __importStar(require("vscode"));
const NamedColors = {
    default: "000000",
    white: "ffffff",
    aqua: "1abc9c",
    green: "57f287",
    blue: "3498db",
    yellow: "fee75c",
    purple: "9b59b6",
    luminousvividpink: "e91e63",
    fuchsia: "eb459e",
    gold: "f1c40f",
    orange: "e67e22",
    red: "ed4245",
    grey: "95a5a6",
    gray: "95a5a6",
    navy: "34495e",
    darkaqua: "11806a",
    darkgreen: "1f8b4c",
    darkblue: "206694",
    darkpurple: "71368a",
    darkvividpink: "ad1457",
    darkgold: "c27c0e",
    darkorange: "a84300",
    darkred: "992d22",
    darkgrey: "979c9f",
    darkgray: "979c9f",
    darkergrey: "7f8c8d",
    darkergray: "7f8c8d",
    lightgrey: "bcc0c0",
    lightgray: "bcc0c0",
    darknavy: "2c3e50",
    blurple: "5865f2",
    greyple: "99aab5",
    darkbutnotblack: "2c2f33",
    notquiteblack: "23272a"
};
/**
 * Converts a normalized hex string into {@link vscode.Color}.
 * @param hex The hex string.
 */
function hexToColor(hex) {
    if (hex.length === 3 || hex.length === 4)
        hex = hex.split("").map((c) => c + c).join("");
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return new vscode.Color(r, g, b, a);
}
/**
 * Parses raw text from a color argument into {@link vscode.Color}.
 * @param value The raw argument text.
 */
function parseColor(value) {
    const lower = value.toLowerCase();
    if (lower === "random")
        return null;
    const named = NamedColors[lower];
    if (named)
        return hexToColor(named);
    if (/^\d+$/.test(value)) {
        const int = Number(value);
        if (!Number.isSafeInteger(int) || int < 0 || int > 0xffffff)
            return null;
        return hexToColor(int.toString(16).padStart(6, "0"));
    }
    if (!_1.HexRegex.test(value))
        return null;
    return hexToColor(value.startsWith("#") ? value.slice(1) : value);
}
/**
 * Formats a {@link vscode.Color} back into text.
 * @param color The picked color.
 * @param original The original argument text.
 */
function formatColor(color, original) {
    const toByte = (n) => Math.round(Math.max(0, Math.min(1, n)) * 255);
    const toHex = (n) => toByte(n).toString(16).padStart(2, "0");
    const lower = original.toLowerCase();
    if (NamedColors[lower] || lower === "random")
        return "#" + toHex(color.red) + toHex(color.green) + toHex(color.blue);
    if (/^\d+$/.test(original))
        return String((toByte(color.red) << 16) | (toByte(color.green) << 8) | toByte(color.blue));
    const hadHash = original.startsWith("#");
    const rawHex = hadHash ? original.slice(1) : original;
    const hadAlpha = rawHex.length === 4 || rawHex.length === 8;
    let hex = toHex(color.red) + toHex(color.green) + toHex(color.blue);
    if (hadAlpha)
        hex += toHex(color.alpha);
    return (hadHash ? "#" : "") + hex;
}
/**
 * Registers the document color provider for Color function arguments.
 * @param ctx The extension context.
 */
function registerColorPicker(ctx) {
    ctx.subscriptions.push(vscode.languages.registerColorProvider(_1.Languages, {
        async provideDocumentColors(document) {
            const config = (0, _1.getExtensionConfig)();
            if (!config.features.hoverInfo)
                return [];
            const text = document.getText();
            const results = [];
            const ScanRegex = (0, _1.cloneRegex)(_1.FunctionScanRegex);
            ScanRegex.lastIndex = 0;
            let match;
            while ((match = ScanRegex.exec(text))) {
                const index = match.index;
                const startPos = document.positionAt(index);
                if (!(0, _1.locateCodeBlock)(document, startPos) || (0, _1.isEscaped)(text, index) || (0, _1.isIgnored)(text, index))
                    continue;
                const full = match[0];
                if (!full.endsWith("["))
                    continue;
                const found = await (0, _1.findFunction)(full.slice(0, -1));
                if (!found?.fn.args)
                    continue;
                const { fn } = found;
                const openIndex = index + full.length - 1;
                const closeIndex = (0, _1.findMatchingBracket)(text, openIndex);
                if (closeIndex === -1)
                    continue;
                const argString = text.slice(openIndex + 1, closeIndex);
                const args = (0, _1.splitArgs)(argString);
                const lastArg = fn.args?.at(-1);
                for (let i = 0; i < args.length; i++) {
                    const meta = fn.args?.[Math.min(i, lastArg?.rest ? fn.args.length - 1 : i)];
                    if (meta?.type !== "Color")
                        continue;
                    const raw = args[i].value;
                    const whitespace = raw.length - raw.trimStart().length;
                    const trimmed = raw.trim();
                    const color = parseColor(trimmed);
                    if (!color)
                        continue;
                    const startOffset = openIndex + 1 + args[i].start + whitespace;
                    const endOffset = startOffset + trimmed.length;
                    results.push(new vscode.ColorInformation(new vscode.Range(document.positionAt(startOffset), document.positionAt(endOffset)), color));
                }
            }
            return results;
        },
        provideColorPresentations(color, ctx) {
            const original = ctx.document.getText(ctx.range);
            return [new vscode.ColorPresentation(formatColor(color, original))];
        }
    }));
}
//# sourceMappingURL=colors.js.map