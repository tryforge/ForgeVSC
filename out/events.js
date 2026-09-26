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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEventTypes = validateEventTypes;
exports.registerEventHover = registerEventHover;
const _1 = require(".");
const vscode = __importStar(require("vscode"));
const typescript_1 = __importDefault(require("typescript"));
function collectEventTypeLiterals(sf) {
    const literals = [];
    function visit(node) {
        if (typescript_1.default.isObjectLiteralExpression(node)) {
            const hasCode = node.properties.some((p) => typescript_1.default.isPropertyAssignment(p) &&
                (typescript_1.default.isIdentifier(p.name) || typescript_1.default.isStringLiteral(p.name)) &&
                p.name.text === "code");
            if (hasCode) {
                for (const prop of node.properties) {
                    if (!typescript_1.default.isPropertyAssignment(prop))
                        continue;
                    if (!typescript_1.default.isIdentifier(prop.name) && !typescript_1.default.isStringLiteral(prop.name))
                        continue;
                    if (prop.name.text !== "type")
                        continue;
                    if (!typescript_1.default.isStringLiteral(prop.initializer))
                        continue;
                    literals.push(prop.initializer);
                }
            }
        }
        typescript_1.default.forEachChild(node, visit);
    }
    visit(sf);
    return literals;
}
/**
 * Validates all event types for a document.
 * @param document The text document.
 * @param diagnostics The diagnostics array to push into.
 */
async function validateEventTypes(document, diagnostics) {
    const text = document.getText();
    const kind = document.fileName.endsWith(".tsx")
        ? typescript_1.default.ScriptKind.TSX
        : document.fileName.endsWith(".ts")
            ? typescript_1.default.ScriptKind.TS
            : document.fileName.endsWith(".jsx")
                ? typescript_1.default.ScriptKind.JSX
                : typescript_1.default.ScriptKind.JS;
    const sf = typescript_1.default.createSourceFile(document.fileName, text, typescript_1.default.ScriptTarget.Latest, true, kind);
    const literals = collectEventTypeLiterals(sf);
    for (const literal of literals) {
        const events = await (0, _1.findEvents)(literal.text);
        if (!events.length || !events.every((x) => x.deprecated))
            continue;
        const start = document.positionAt(literal.getStart(sf) + 1);
        const end = document.positionAt(literal.getEnd() - 1);
        const range = new vscode.Range(start, end);
        const hint = new vscode.Diagnostic(range, vscode.l10n.t("This event is deprecated and its use is discouraged. It may be removed in upcoming releases. Use a supported alternative if available."), vscode.DiagnosticSeverity.Hint);
        const warning = new vscode.Diagnostic(range, vscode.l10n.t("Event `{0}` is deprecated. Use an available alternative instead", literal.text), vscode.DiagnosticSeverity.Warning);
        warning.tags = [vscode.DiagnosticTag.Deprecated];
        diagnostics.push(hint, warning);
    }
}
/**
 * Registers the hover info for event types.
 * @param ctx The extension context.
 */
function registerEventHover(ctx) {
    ctx.subscriptions.push(vscode.languages.registerHoverProvider(_1.Languages, {
        async provideHover(document, position) {
            const config = (0, _1.getExtensionConfig)();
            if (!config.features.hoverInfo)
                return;
            const text = document.getText();
            const offset = document.offsetAt(position);
            if ((0, _1.isIgnored)(text, offset))
                return;
            const kind = document.fileName.endsWith(".tsx")
                ? typescript_1.default.ScriptKind.TSX
                : document.fileName.endsWith(".ts")
                    ? typescript_1.default.ScriptKind.TS
                    : document.fileName.endsWith(".jsx")
                        ? typescript_1.default.ScriptKind.JSX
                        : typescript_1.default.ScriptKind.JS;
            const sf = typescript_1.default.createSourceFile(document.fileName, text, typescript_1.default.ScriptTarget.Latest, true, kind);
            const literals = collectEventTypeLiterals(sf);
            const literal = literals.find((x) => offset >= x.getStart(sf) + 1 && offset <= x.getEnd() - 1);
            if (!literal)
                return;
            const events = await (0, _1.findEvents)(literal.text);
            if (!events.length)
                return;
            const range = new vscode.Range(document.positionAt(literal.getStart(sf) + 1), document.positionAt(literal.getEnd() - 1));
            const contents = await Promise.all(events.map(async (event) => {
                const { name, description, version, source, intents } = event;
                const md = new vscode.MarkdownString();
                md.appendCodeblock(name);
                md.appendText(`${description}\n`);
                if (intents?.length)
                    md.appendMarkdown(`**Intents:** \`${intents.join("`, `")}\`\n\n`);
                if (version) {
                    const links = [];
                    const sourceUrl = await (0, _1.buildEventURL)(event);
                    if (sourceUrl)
                        links.push(`[$(github) ${vscode.l10n.t("Source")}](${sourceUrl})`);
                    const guide = await (0, _1.findGuide)({ targetType: "event", targetName: name });
                    const pkgName = guide?.packageName || (0, _1.getPackageName)(source);
                    if (pkgName)
                        links.push(`[$(extensions) ${vscode.l10n.t("Documentation")}](https://docs.botforge.org/event/${name}?p=${pkgName})`);
                    if (guide) {
                        const cmd = vscode.Uri.parse(`command:forgevsc.previewGuide?${encodeURIComponent(JSON.stringify([guide.id]))}`);
                        links.push(`[$(book) ${vscode.l10n.t("Guide")}](${cmd})`);
                    }
                    md.appendMarkdown(`---\n`);
                    md.appendMarkdown(`##### $(package) ${pkgName ? `${pkgName} ` : ""}v${version}` + (links.length ? ` | ${links.join(" | ")}` : ""));
                }
                md.isTrusted = true;
                md.supportThemeIcons = true;
                return md;
            }));
            return new vscode.Hover(contents, range);
        }
    }));
}
//# sourceMappingURL=events.js.map