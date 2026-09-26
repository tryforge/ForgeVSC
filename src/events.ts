import { buildEventURL, findEvents, findGuide, getExtensionConfig, getPackageName, isIgnored, Languages } from "."
import * as vscode from "vscode"
import ts from "typescript"

function collectEventTypeLiterals(sf: ts.SourceFile) {
    const literals: ts.StringLiteral[] = []

    function visit(node: ts.Node) {
        if (ts.isObjectLiteralExpression(node)) {
            const hasCode = node.properties.some((p) =>
                ts.isPropertyAssignment(p) &&
                (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
                p.name.text === "code"
            )

            if (hasCode) {
                for (const prop of node.properties) {
                    if (!ts.isPropertyAssignment(prop)) continue
                    if (!ts.isIdentifier(prop.name) && !ts.isStringLiteral(prop.name)) continue
                    if (prop.name.text !== "type") continue
                    if (!ts.isStringLiteral(prop.initializer)) continue

                    literals.push(prop.initializer)
                }
            }
        }

        ts.forEachChild(node, visit)
    }

    visit(sf)
    return literals
}

/**
 * Validates all event types for a document.
 * @param document The text document.
 * @param diagnostics The diagnostics array to push into.
 */
export async function validateEventTypes(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
    const text = document.getText()
    const kind = document.fileName.endsWith(".tsx")
        ? ts.ScriptKind.TSX
        : document.fileName.endsWith(".ts")
            ? ts.ScriptKind.TS
            : document.fileName.endsWith(".jsx")
                ? ts.ScriptKind.JSX
                : ts.ScriptKind.JS

    const sf = ts.createSourceFile(document.fileName, text, ts.ScriptTarget.Latest, true, kind)
    const literals = collectEventTypeLiterals(sf)

    for (const literal of literals) {
        const events = await findEvents(literal.text)
        if (!events.length || !events.every((x) => x.deprecated)) continue

        const start = document.positionAt(literal.getStart(sf) + 1)
        const end = document.positionAt(literal.getEnd() - 1)
        const range = new vscode.Range(start, end)

        const hint = new vscode.Diagnostic(
            range,
            vscode.l10n.t("This event is deprecated and its use is discouraged. It may be removed in upcoming releases. Use a supported alternative if available."),
            vscode.DiagnosticSeverity.Hint
        )
        const warning = new vscode.Diagnostic(
            range,
            vscode.l10n.t("Event `{0}` is deprecated. Use an available alternative instead", literal.text),
            vscode.DiagnosticSeverity.Warning
        )
        warning.tags = [vscode.DiagnosticTag.Deprecated]
        diagnostics.push(hint, warning)
    }
}

/**
 * Registers the hover info for event types.
 * @param ctx The extension context.
 */
export function registerEventHover(ctx: vscode.ExtensionContext) {
    ctx.subscriptions.push(
        vscode.languages.registerHoverProvider(Languages, {
            async provideHover(document, position) {
                const config = getExtensionConfig()
                if (!config.features.hoverInfo) return

                const text = document.getText()
                const offset = document.offsetAt(position)
                if (isIgnored(text, offset)) return

                const kind = document.fileName.endsWith(".tsx")
                    ? ts.ScriptKind.TSX
                    : document.fileName.endsWith(".ts")
                        ? ts.ScriptKind.TS
                        : document.fileName.endsWith(".jsx")
                            ? ts.ScriptKind.JSX
                            : ts.ScriptKind.JS

                const sf = ts.createSourceFile(document.fileName, text, ts.ScriptTarget.Latest, true, kind)
                const literals = collectEventTypeLiterals(sf)
                const literal = literals.find((x) => offset >= x.getStart(sf) + 1 && offset <= x.getEnd() - 1)
                if (!literal) return

                const events = await findEvents(literal.text)
                if (!events.length) return

                const range = new vscode.Range(
                    document.positionAt(literal.getStart(sf) + 1),
                    document.positionAt(literal.getEnd() - 1)
                )

                const contents = await Promise.all(
                    events.map(async (event) => {
                        const { name, description, version, source, intents } = event
                        const md = new vscode.MarkdownString()

                        md.appendCodeblock(name)
                        md.appendText(`${description}\n`)
                        if (intents?.length) md.appendMarkdown(`**Intents:** \`${intents.join("`, `")}\`\n\n`)
                        if (version) {
                            const links: string[] = []
                            const sourceUrl = await buildEventURL(event)
                            if (sourceUrl) links.push(`[$(github) ${vscode.l10n.t("Source")}](${sourceUrl})`)
                            const guide = await findGuide({ targetType: "event", targetName: name })
                            const pkgName = guide?.packageName || getPackageName(source)
                            if (pkgName) links.push(`[$(extensions) ${vscode.l10n.t("Documentation")}](https://docs.botforge.org/event/${name}?p=${pkgName})`)
                            if (guide) {
                                const cmd = vscode.Uri.parse(
                                    `command:forgevsc.previewGuide?${encodeURIComponent(JSON.stringify([guide.id]))}`
                                )
                                links.push(`[$(book) ${vscode.l10n.t("Guide")}](${cmd})`)
                            }
                            md.appendMarkdown(`---\n`)
                            md.appendMarkdown(
                                `##### $(package) ${pkgName ? `${pkgName} ` : ""}v${version}` + (links.length ? ` | ${links.join(" | ")}` : "")
                            )
                        }
                        md.isTrusted = true
                        md.supportThemeIcons = true
                        return md
                    })
                )

                return new vscode.Hover(contents, range)
            }
        })
    )
}