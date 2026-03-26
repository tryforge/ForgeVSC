"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHover = registerHover;
const _1 = require(".");
const vscode_1 = __importDefault(require("vscode"));
/**
 * Registers the hover info for functions and operators.
 * @param ctx The extension context.
 */
function registerHover(ctx) {
    ctx.subscriptions.push(vscode_1.default.languages.registerHoverProvider(_1.languages, {
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
                const md = new vscode_1.default.MarkdownString();
                md.appendMarkdown(`**${doc.name} (\`${opStr}\`)**\n\n${doc.description}`);
                return new vscode_1.default.Hover(md, operatorRange);
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
                    const md = new vscode_1.default.MarkdownString();
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
                            const cmd = vscode_1.default.Uri.parse(`command:forgevsc.previewGuide?${encodeURIComponent(JSON.stringify([guide.id]))}`);
                            links.push(`[Guide](${cmd})`);
                        }
                        md.appendMarkdown(`---\n`);
                        md.appendMarkdown(`##### ${pkgName ? `${pkgName} ` : ""}v${version}` + (links.length ? " | " + links.join(" | ") : ""));
                    }
                    md.isTrusted = true;
                    const hoverEnd = Math.min(end, start + matchedText.length);
                    const range = new vscode_1.default.Range(position.line, start, position.line, hoverEnd);
                    return new vscode_1.default.Hover(md, range);
                }
            }
        }
    }));
}
//# sourceMappingURL=hover.js.map