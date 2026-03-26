import {
    cloneRegex,
    findFunction,
    findMatchingBracket,
    FunctionPrefixRegex,
    FunctionScanRegex,
    getExtensionConfig,
    isEscaped,
    isOpeningBracket,
    languages,
    locateCodeBlock
} from "."
import vscode from "vscode"

let decoFn: vscode.TextEditorDecorationType | null = null
let decoDollar: vscode.TextEditorDecorationType | null = null
let decoSemi: vscode.TextEditorDecorationType | null = null
let decoOpNeg: vscode.TextEditorDecorationType | null = null
let decoOpSilent: vscode.TextEditorDecorationType | null = null
let decoOpCount: vscode.TextEditorDecorationType | null = null
let decoOpCountDelim: vscode.TextEditorDecorationType | null = null

export const HexRegex = /^#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

/**
 * Checks whether the input is a valid hex color.
 * @param input The input text.
 * @returns
 */
function isValidHex(input: string) {
    return HexRegex.test(input.trim())
}

/**
 * Resolves a color input.
 * @param input The input text.
 * @param fallback The color fallback value.
 * @returns 
 */
function resolveColor(input: unknown, fallback: string) {
    if (typeof input !== "string") return fallback
    const hex = input.trim()
    if (!isValidHex(hex)) return fallback
    return hex.startsWith("#") ? hex : ("#" + hex)
}

let lastDecoKey = ""

/**
 * (Re)creates decoration types only when config colors changed.
 */
function ensureDecorations() {
    const config = getExtensionConfig()
    const colors = config.colors ?? {}

    const fnColor = resolveColor(colors.function?.name, "#ac75ff")
    const dollarColor = resolveColor(colors.function?.dollar, "#fe7ceb")
    const semiColor = resolveColor(colors.function?.semicolon, "#c586c0")

    const negColor = resolveColor(colors.operators?.negation, dollarColor)
    const silentColor = resolveColor(colors.operators?.silent, dollarColor)
    const countColor = resolveColor(colors.operators?.count, dollarColor)
    const countDelimColor = resolveColor(colors.operators?.countDelimiter, countColor)

    const key = [
        fnColor,
        dollarColor,
        semiColor,
        negColor,
        silentColor,
        countColor,
        countDelimColor
    ].join("|")

    if (key === lastDecoKey && decoFn) return
    lastDecoKey = key

    for (const d of [decoFn, decoDollar, decoSemi, decoOpNeg, decoOpSilent, decoOpCount, decoOpCountDelim]) {
        d?.dispose()
    }

    decoFn = vscode.window.createTextEditorDecorationType({ color: fnColor })
    decoDollar = vscode.window.createTextEditorDecorationType({ color: dollarColor })
    decoSemi = vscode.window.createTextEditorDecorationType({ color: semiColor })

    decoOpNeg = vscode.window.createTextEditorDecorationType({ color: negColor })
    decoOpSilent = vscode.window.createTextEditorDecorationType({ color: silentColor })
    decoOpCount = vscode.window.createTextEditorDecorationType({ color: countColor })
    decoOpCountDelim = vscode.window.createTextEditorDecorationType({ color: countDelimColor })
}

async function applyDecorations(editor: vscode.TextEditor) {
    ensureDecorations()
    if (!decoFn || !decoDollar || !decoSemi || !decoOpNeg || !decoOpSilent || !decoOpCount || !decoOpCountDelim) {
        return
    }

    const doc = editor.document
    const text = doc.getText()

    const fnRanges: vscode.Range[] = []
    const dollarRanges: vscode.Range[] = []
    const semiRanges: vscode.Range[] = []
    const opNegRanges: vscode.Range[] = []
    const opSilentRanges: vscode.Range[] = []
    const opCountRanges: vscode.Range[] = []
    const opCountDelimRanges: vscode.Range[] = []

    const ScanRegex = cloneRegex(FunctionScanRegex)
    ScanRegex.lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = ScanRegex.exec(text))) {
        const matchIndex = match.index
        const startPos = doc.positionAt(matchIndex)
        if (!locateCodeBlock(doc, startPos) || isEscaped(text, matchIndex)) continue

        const full = match[0]
        let found = await findFunction(full)
        if (!found && full.endsWith("[")) found = await findFunction(full.slice(0, -1))
        if (!found) continue

        const { matchedText, fn } = found

        const prefixMatch = matchedText.match(FunctionPrefixRegex)?.[0] ?? "$"
        const nameLength = Math.max(matchedText.length - prefixMatch.length, 0)
        if (nameLength <= 0) continue

        const nameStart = matchIndex + prefixMatch.length
        fnRanges.push(new vscode.Range(doc.positionAt(nameStart), doc.positionAt(nameStart + nameLength)))
        dollarRanges.push(new vscode.Range(doc.positionAt(matchIndex), doc.positionAt(matchIndex + 1)))

        const prefix = prefixMatch
        for (let i = 0; i < prefix.length; i++) {
            const c = prefix[i]
            const abs = matchIndex + i

            if (c === "!") {
                opNegRanges.push(new vscode.Range(doc.positionAt(abs), doc.positionAt(abs + 1)))
            } else if (c === "#") {
                opSilentRanges.push(new vscode.Range(doc.positionAt(abs), doc.positionAt(abs + 1)))
            } else if (c === "@") {
                const j = prefix.indexOf("@[", i)
                const k = j !== -1 ? prefix.indexOf("]", j) : -1
                if (j !== -1 && k !== -1) {
                    const absStart = matchIndex + j
                    const absEnd = matchIndex + k + 1
                    const hasDelim = k === j + 3

                    if (hasDelim) {
                        const delimAbs = absStart + 2
                        opCountRanges.push(new vscode.Range(doc.positionAt(absStart), doc.positionAt(absStart + 2)))
                        opCountRanges.push(new vscode.Range(doc.positionAt(absEnd - 1), doc.positionAt(absEnd)))
                        opCountDelimRanges.push(new vscode.Range(doc.positionAt(delimAbs), doc.positionAt(delimAbs + 1)))
                    } else {
                        opCountRanges.push(new vscode.Range(doc.positionAt(absStart), doc.positionAt(absEnd)))
                    }
                }
                break
            }
        }

        const acceptsArgs = fn.brackets !== undefined
        if (!acceptsArgs || !full.endsWith("[")) continue

        const openIndex = matchIndex + full.length - 1
        const closeIndex = findMatchingBracket(text, openIndex)
        if (closeIndex === -1) continue

        let depth = 0
        for (let i = openIndex + 1; i < closeIndex; i++) {
            const escaped = isEscaped(text, i)
            const ch = text[i]

            if (ch === "[" && isOpeningBracket(text, i)) depth++
            else if (ch === "]" && depth > 0 && !escaped) depth--
            else if (ch === ";" && depth === 0 && !escaped) {
                semiRanges.push(new vscode.Range(doc.positionAt(i), doc.positionAt(i + 1)))
            }
        }
    }

    editor.setDecorations(decoFn, fnRanges)
    editor.setDecorations(decoDollar, dollarRanges)
    editor.setDecorations(decoSemi, semiRanges)
    editor.setDecorations(decoOpNeg, opNegRanges)
    editor.setDecorations(decoOpSilent, opSilentRanges)
    editor.setDecorations(decoOpCount, opCountRanges)
    editor.setDecorations(decoOpCountDelim, opCountDelimRanges)
}

/**
 * Registers the decorations for syntax highlighting.
 * @param ctx The extension context.
 */
export function registerDecorations(ctx: vscode.ExtensionContext) {
    ensureDecorations()

    const updateActive = () => {
        const editor = vscode.window.activeTextEditor
        if (!editor || !languages.includes(editor.document.languageId)) return
        void applyDecorations(editor)
    }

    ctx.subscriptions.push(
        {
            dispose: () => {
                for (const d of [decoFn, decoDollar, decoSemi, decoOpNeg, decoOpSilent, decoOpCount, decoOpCountDelim]) {
                    d?.dispose()
                }
            }
        },
        vscode.window.onDidChangeActiveTextEditor(() => updateActive()),
        vscode.workspace.onDidChangeTextDocument((e) => {
            const editor = vscode.window.activeTextEditor
            if (!editor || e.document !== editor.document) return
            updateActive()
        })
    )

    updateActive()
}