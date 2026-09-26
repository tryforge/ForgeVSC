import { findMatchingBracket, isEscaped, Languages, locateCodeBlock } from "."
import * as vscode from "vscode"

const CommentContextKey = "forgevsc.inCodeBlock"
const CommentOpenRegex = /^\$c\[/i

type ToggleEdit = {
    range: vscode.Range
    text: string
}

/**
 * Returns the indentation unit based on the editor settings.
 * @param editor The active text editor.
 */
function getIndentUnit(editor: vscode.TextEditor) {
    const { insertSpaces, tabSize } = editor.options
    return insertSpaces ? " ".repeat(Number(tabSize) || 4) : "\t"
}

/**
 * Returns the indent of a line.
 * @param line The line text.
 */
function getIndent(line: string) {
    return line.match(/^[ \t]*/)?.[0] ?? ""
}

/**
 * Removes one indentation unit from the start of a line.
 * @param line The line text.
 * @param indentUnit The indentation unit.
 */
function outdentLine(line: string, indentUnit: string) {
    if (line.startsWith(indentUnit)) return line.slice(indentUnit.length)

    const leading = getIndent(line)
    if (!leading.length) return line

    return line.slice(Math.min(leading.length, indentUnit.length))
}

/**
 * Builds the commented (wrapped) text for the given lines.
 * @param lines The selected lines.
 * @param baseIndent The indentation of the first line.
 * @param indentUnit The indentation unit.
 */
function buildWrap(lines: string[], baseIndent: string, indentUnit: string) {
    if (lines.length === 1)
        return `${baseIndent}$c[${lines[0].slice(baseIndent.length)}]`

    const body = lines.map((line) => (line.trim().length ? indentUnit + line : line))
    return [`${baseIndent}$c[`, ...body, `${baseIndent}]`].join("\n")
}

/**
 * Builds the uncommented (unwrapped) text for the given lines.
 * @param lines The selected lines.
 * @param baseIndent The indentation of the first line.
 * @param indentUnit The indentation unit.
 */
function buildUnwrap(lines: string[], baseIndent: string, indentUnit: string) {
    if (lines.length === 1) {
        const inner = lines[0].trim().replace(CommentOpenRegex, "").slice(0, -1)
        return `${baseIndent}${inner}`
    }

    return lines.slice(1, -1).map((line) => outdentLine(line, indentUnit)).join("\n")
}

/**
 * Checks whether the given lines form exactly one comment.
 * @param document The text document.
 * @param docText The full document text.
 * @param range The range covering the lines.
 * @param lines The selected lines.
 */
function isWrappedBlock(document: vscode.TextDocument, docText: string, range: vscode.Range, lines: string[]) {
    if (lines.length === 1) {
        const trimmed = lines[0].trim()
        if (!CommentOpenRegex.test(trimmed) || !trimmed.endsWith("]")) return false
    } else {
        if (lines[0].trim().toLowerCase() !== "$c[") return false
        if (lines[lines.length - 1].trim() !== "]") return false
    }

    const dollarOffset = document.offsetAt(range.start) + getIndent(lines[0]).length
    if (isEscaped(docText, dollarOffset)) return false

    const openBracketOffset = dollarOffset + 2
    const closeBracketOffset = findMatchingBracket(docText, openBracketOffset)

    const lastLine = lines[lines.length - 1]
    const whitespace = lastLine.length - lastLine.trimEnd().length
    const lastNonWsOffset = document.offsetAt(range.end) - whitespace - 1

    return closeBracketOffset !== -1 && closeBracketOffset === lastNonWsOffset
}

/**
 * Computes the comment toggle edit for a single selection.
 * @param editor The active text editor.
 * @param selection The selection to toggle.
 */
function computeToggle(editor: vscode.TextEditor, selection: vscode.Selection): ToggleEdit | null {
    const document = editor.document
    const docText = document.getText()

    let startLine = selection.isEmpty ? selection.active.line : selection.start.line
    let endLine = selection.isEmpty ? selection.active.line : selection.end.line

    if (!selection.isEmpty && selection.end.character === 0 && endLine > startLine) endLine--

    const range = new vscode.Range(
        new vscode.Position(startLine, 0),
        document.lineAt(endLine).range.end
    )

    const lines: string[] = []
    for (let l = startLine; l <= endLine; l++) lines.push(document.lineAt(l).text)
    if (!lines.some((line) => line.trim().length)) return null

    const indentUnit = getIndentUnit(editor)
    const baseIndent = getIndent(lines[0])

    const text = isWrappedBlock(document, docText, range, lines)
        ? buildUnwrap(lines, baseIndent, indentUnit)
        : buildWrap(lines, baseIndent, indentUnit)

    return { range, text }
}

/**
 * Registers the comment toggle command.
 * @param ctx The extension context.
 */
export function registerCommentToggle(ctx: vscode.ExtensionContext) {
    const updateContext = (editor?: vscode.TextEditor) => {
        const inCodeBlock = !!(
            editor &&
            Languages.includes(editor.document.languageId) &&
            locateCodeBlock(editor.document, editor.selection.active)
        )
        vscode.commands.executeCommand("setContext", CommentContextKey, inCodeBlock)
    }

    updateContext(vscode.window.activeTextEditor)

    ctx.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(updateContext),
        vscode.window.onDidChangeTextEditorSelection((e) => updateContext(e.textEditor)),

        // Toggle Comment
        vscode.commands.registerCommand("forgevsc.toggleComment", async () => {
            const editor = vscode.window.activeTextEditor
            if (!editor || !Languages.includes(editor.document.languageId)) return

            const document = editor.document
            const selections = [...editor.selections].sort((a, b) => b.start.compareTo(a.start))

            await editor.edit((editBuilder) => {
                for (const selection of selections) {
                    if (!locateCodeBlock(document, selection.active)) continue

                    const result = computeToggle(editor, selection)
                    if (result) editBuilder.replace(result.range, result.text)
                }
            })
        })
    )
}