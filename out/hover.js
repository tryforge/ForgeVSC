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
exports.registerHover = registerHover;
const _1 = require(".");
const vscode = __importStar(require("vscode"));
/**
 * Registers the hover info for functions and operators.
 * @param ctx The extension context.
 */
function registerHover(ctx) {
    ctx.subscriptions.push(vscode.languages.registerHoverProvider(_1.Languages, {
        async provideHover(document, position) {
            const config = (0, _1.getExtensionConfig)();
            if (!(0, _1.locateCodeBlock)(document, position) || !config.features.hoverInfo)
                return;
            // Operator hover
            const operatorRange = document.getWordRangeAtPosition(position, /@\[[^\]]?\]|[!#]/);
            if (operatorRange && operatorRange.contains(position)) {
                const line = document.lineAt(position.line).text;
                const opStr = document.getText(operatorRange);
                const opStart = operatorRange.start.character;
                const opEnd = operatorRange.end.character;
                const dollar = line.lastIndexOf("$", opStart);
                if (dollar === -1 || (0, _1.isEscaped)(line, dollar))
                    return;
                const between = line.slice(dollar, opStart);
                const prefixOnly = between.slice(1);
                if (prefixOnly.length && !new RegExp(`^${_1.OperatorChain}$`).test(prefixOnly))
                    return;
                const after = line.slice(opEnd);
                const afterOk = new RegExp(String.raw `^(?:${_1.OperatorChain})[a-zA-Z0-9]`).test(after);
                if (!afterOk)
                    return;
                const op = (opStr.startsWith("@") ? "@" : opStr);
                const doc = _1.OperatorInfo[op];
                if (!doc)
                    return;
                const md = new vscode.MarkdownString();
                md.appendMarkdown(`**${doc.name} (\`${opStr}\`)**\n\n${doc.description}`);
                return new vscode.Hover(md, operatorRange);
            }
            const line = document.lineAt(position.line).text;
            // const Regex = /\$!?#?(?:@\[[^\]]?\])?[a-zA-Z0-9]+/g
            const Regex = /\$!?#?(?:@\[[^\]]?\])?[a-zA-Z0-9]+(\[)?/g;
            let match;
            // Function hover
            while ((match = Regex.exec(line))) {
                const start = match.index;
                if ((0, _1.isEscaped)(line, start))
                    continue;
                const hasOpening = match[1] === "[";
                let end = start + match[0].length;
                if (hasOpening)
                    end--;
                if (position.character >= start && position.character <= end) {
                    const lookup = hasOpening ? match[0].slice(0, -1) : match[0];
                    const found = await (0, _1.findFunction)(lookup);
                    if (!found)
                        continue;
                    const { fn, matchedText } = found;
                    const actualEnd = start + matchedText.length;
                    if (position.character < start || position.character > actualEnd)
                        continue;
                    const { brackets, name, output, description, version, source } = fn;
                    const acceptsArgs = brackets !== undefined;
                    const bracketIndex = start + matchedText.length;
                    const hasBracket = acceptsArgs && line[bracketIndex] === "[";
                    const md = new vscode.MarkdownString();
                    md.appendCodeblock(`${(brackets || hasBracket) ? (0, _1.generateUsage)(fn) : name}${output ? `: ` + output.join(", ") : ""}\n`);
                    md.appendText(`${description}\n`);
                    if (version) {
                        const links = [];
                        const sourceUrl = await (0, _1.buildSourceURL)(fn);
                        if (sourceUrl)
                            links.push(`[Source](${sourceUrl})`);
                        const guide = await (0, _1.findGuide)({ targetType: "function", targetName: name });
                        const pkgName = guide?.packageName || (0, _1.getPackageName)(source);
                        if (pkgName)
                            links.push(`[Documentation](https://docs.botforge.org/function/${name}?p=${pkgName})`);
                        if (guide) {
                            const cmd = vscode.Uri.parse(`command:forgevsc.previewGuide?${encodeURIComponent(JSON.stringify([guide.id]))}`);
                            links.push(`[Guide](${cmd})`);
                        }
                        md.appendMarkdown(`---\n`);
                        md.appendMarkdown(`##### ${pkgName ? `${pkgName} ` : ""}v${version}` + (links.length ? " | " + links.join(" | ") : ""));
                    }
                    md.isTrusted = true;
                    const hoverEnd = Math.min(end, start + matchedText.length);
                    const range = new vscode.Range(position.line, start, position.line, hoverEnd);
                    return new vscode.Hover(md, range);
                }
            }
        }
    }));
}
//# sourceMappingURL=hover.js.map