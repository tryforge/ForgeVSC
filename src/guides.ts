/*
* SPDX-License-Identifier: LGPL-3.0-or-later
* Copyright © 2026 BotForge
*/

import MarkdownIt, { MarkdownIt as Markdown } from "markdown-it"
import { DocsUrl, getExtensionConfig, getGuides, isEscaped, Logger, resolveColor } from "."
import * as vscode from "vscode"

import hljs from "highlight.js/lib/core"
import javascript from "highlight.js/lib/languages/javascript"
import typescript from "highlight.js/lib/languages/typescript"
import json from "highlight.js/lib/languages/json"

export const GuideTypes = ["specific", "dedicated"] as const
export const GuideTargetTypes = ["function", "event", "enum", "none"] as const

export type GuideType = typeof GuideTypes[number]
export type GuideTargetType = typeof GuideTargetTypes[number]
export type GuideUser = {
    id: number
    username: string
    discordId: string
    role: string
    Label: string
    avatarUrl: string
}
export type GuideContributor = GuideUser & {
    isOriginalAuthor: boolean
}
export type GuideMetadata = {
    id: number
    referenceId: number
    guideType: GuideType
    packageName: string
    targetType: GuideTargetType
    targetName: string | null
    title: string | null
    category: string | null
    subCategory: string | null
    content: string
    reviewerId: number | null
    submittedAt: string
    approvedAt: string
    approver: GuideUser | null
    contributors: GuideContributor[]
}

export type GuideFindQuery =
    | string
    | {
        text?: string
        id?: number
        referenceId?: number
        guideType?: GuideType
        packageName?: string
        targetType?: GuideTargetType
        targetName?: string | null
        title?: string | null
        category?: string | null
        subCategory?: string | null
        approvedAfter?: string
        approvedBefore?: string
        reviewerId?: number | null
        approverId?: number | null
        approverUsername?: string | null
        contributorId?: number
        contributorUsername?: string
        authorUsername?: string
        sortBy?: "relevance" | "approvedAt" | "title"
        sortDir?: "asc" | "desc"
        limit?: number
        where?: (g: GuideMetadata) => boolean
    }

const FavoriteGuidesKey = "forgevsc.favoriteGuides"

const ForgeLangs = new Set(["forge", "forgescript", "fs"])
const ShellLangs = new Set(["bash", "sh", "zsh", "shell", "console"])
const ShellKeywords = new Set(["if", "then", "else", "elif", "fi", "for", "while", "do", "done", "case", "esac", "function", "in"])

const OperatorToken = /!|#|@\[([^\]]?)\]/g
const FunctionToken = /\$((?:[!#]|@\[[^\]]?\])*)([a-zA-Z0-9]+)(\[)?|;|\]/g
const ShellToken = /(#.*$)|("(?:[^"\\]|\\.)*"|'[^']*')|(\$\{?[\w@#?*!-]+\}?)|(\s+)|(&&|\|\||[|;&<>]+)|([^\s|;&<>"'$]+)/gm

const IconPaths: Record<string, { icon: string, label: () => string }> = {
    function: {
        icon: "symbol-function",
        label: () => vscode.l10n.t("Function")
    },
    event: {
        icon: "symbol-event",
        label: () => vscode.l10n.t("Event")
    },
    enum: {
        icon: "symbol-enum",
        label: () => vscode.l10n.t("Enum")
    }
}

let ExtensionContext: vscode.ExtensionContext
let WebviewPanel: vscode.WebviewPanel | undefined

type GuideNodeKind = "favorites" | "package" | "category" | "subCategory" | "guide"
type GuideNode = {
    kind: GuideNodeKind
    key: string
    label: string
    packageName?: string
    category?: string
    subCategory?: string
    guide?: GuideMetadata
    isFavorite?: boolean
}

hljs.registerLanguage("javascript", javascript)
hljs.registerLanguage("typescript", typescript)
hljs.registerLanguage("json", json)
hljs.registerAliases(["js", "jsx", "mjs", "cjs"], { languageName: "javascript" })
hljs.registerAliases(["ts", "tsx"], { languageName: "typescript" })
hljs.registerAliases(["jsonc"], { languageName: "json" })

/**
 * Converts a value to title case.
 * @param value The value to format.
 * @returns 
 */
export function toTitleCase(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

function clean(value?: string | null) {
    return value?.trim() || ""
}

function normalize(value?: string | null) {
    return clean(value).toLowerCase()
}

function fallbackCategory(value?: string | null, fallback?: string) {
    return clean(value) || (fallback && fallback !== "none" ? fallback + "s" : null) || "General"
}

function displayGuideTitle(guide: GuideMetadata) {
    return clean(guide.title) || clean(guide.targetName) || `Guide #${guide.id}`
}

function compareText(a: string, b: string) {
    return a.localeCompare(b, undefined, { sensitivity: "base" })
}

function sortGuides(a: GuideMetadata, b: GuideMetadata) {
    return compareText(displayGuideTitle(a), displayGuideTitle(b))
}

function groupKey(...parts: (string | undefined)[]) {
    return parts.join("::")
}

function formatDate(value?: string) {
    if (!value) return null

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value

    return date.toLocaleString(undefined, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    })
}

function formatDay(value?: string) {
    if (!value) return null

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value

    const day = date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })

    return `${day}, ${time}`
}

function formatRelative(value?: string) {
    if (!value) return null

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null

    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
    const days = Math.round((date.getTime() - Date.now()) / 86_400_000)

    if (Math.abs(days) < 30) return rtf.format(days, "day")
    if (Math.abs(days) < 365) return rtf.format(Math.round(days / 30), "month")
    return rtf.format(Math.round(days / 365), "year")
}

function resolveAvatarURL(url: string) {
    try {
        return new URL(url, DocsUrl).toString()
    } catch {
        return ""
    }
}

function userTooltip(user: GuideUser) {
    const extras = [user.role && toTitleCase(user.role), user.Label].filter(Boolean)
    return esc(user.username + (extras.length ? ` (${extras.join(", ")})` : ""))
}

function renderAvatar(user: GuideUser, size: "small" | "large" = "small") {
    const cls = `avatar avatar-${size}`
    const src = user.avatarUrl ? resolveAvatarURL(user.avatarUrl) : ""

    return src
        ? `<img class="${cls}" src="${esc(src)}" alt="" loading="lazy" draggable="false">`
        : `<span class="${cls} avatar-fallback">${esc(user.username.charAt(0).toUpperCase())}</span>`
}

function renderUser(user: GuideUser) {
    return `<span class="user" title="${userTooltip(user)}">${renderAvatar(user)}<span class="user-name">${esc(user.username)}</span></span>`
}

function renderStack(users: GuideUser[]) {
    return `<span class="stack">
        ${users.map((x) =>
        `<span class="stack-item" title="${userTooltip(x)}">${renderAvatar(x)}</span>`
    ).join("")}
    </span>`
}

function renderBadge(guide: GuideMetadata) {
    const type = IconPaths[guide.targetType]
    if (!type) return ""

    return `<span class="badge badge-type badge-${guide.targetType}">
        <span class="codicon codicon-${type.icon}"></span>
        ${esc(type.label())}
    </span>`
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const span = (cls: string, text: string) => `<span class="${cls}">${esc(text)}</span>`

function highlightOperators(prefix: string) {
    let out = ""

    for (const match of prefix.matchAll(OperatorToken)) {
        if (match[0] === "!") out += span("fn-op-neg", "!")
        else if (match[0] === "#") out += span("fn-op-silent", "#")
        else if (match[1]) {
            out += span("fn-op-count", "@[") + span("fn-op-count-delim", match[1]) + span("fn-op-count", "]")
        } else out += span("fn-op-count", match[0])
    }

    return out
}

function highlightForge(code: string) {
    let out = ""
    let last = 0
    let depth = 0

    const br = (c: string, d: number) => `<span class="br br-${d % 3}">${c}</span>`

    for (const match of code.matchAll(FunctionToken)) {
        const i = match.index!
        out += esc(code.slice(last, i))
        last = i + match[0].length

        if (match[0] === ";") {
            out += (depth && !isEscaped(code, i) ? `<span class="fn-semi">;</span>` : ";")
        } else if (match[0] === "]") {
            if (depth === 0 || isEscaped(code, i)) out += "]"
            else out += br("]", --depth)
        } else if (isEscaped(code, i)) {
            out += esc(match[0])
        } else {
            out += `<span class="fn-dollar">$</span>`
                + (match[1] ? highlightOperators(match[1]) : "")
                + `<span class="fn-name">${esc(match[2])}</span>`
            if (match[3]) out += br("[", depth++)
        }
    }

    return out + esc(code.slice(last))
}

function highlightShell(code: string) {
    return code.split("\n").map((line) => {
        let out = ""
        let expectCmd = true

        const prompt = line.match(/^(\s*[$>]\s)/)
        if (prompt) {
            out += `<span class="sh-prompt">${esc(prompt[1])}</span>`
            line = line.slice(prompt[1].length)
        }

        for (const match of line.matchAll(ShellToken)) {
            const [text, comment, str, variable, space, op, word] = match

            if (comment) out += `<span class="sh-comment">${esc(text)}</span>`
            else if (str) out += `<span class="sh-string">${esc(text)}</span>`
            else if (variable) out += `<span class="sh-var">${esc(text)}</span>`
            else if (space) out += text
            else if (op) {
                out += `<span class="sh-op">${esc(text)}</span>`
                expectCmd = true
            } else if (word) {
                if (ShellKeywords.has(word)) out += `<span class="sh-keyword">${esc(word)}</span>`
                else if (expectCmd) {
                    out += `<span class="sh-cmd">${esc(word)}</span>`
                    expectCmd = false
                } else if (word.startsWith("-")) out += `<span class="sh-flag">${esc(word)}</span>`
                else out += `<span class="sh-string">${esc(word)}</span>`
                if (ShellKeywords.has(word) && word !== "in") expectCmd = true
            }
        }
        return out
    }).join("\n")
}

function highlightCode(code: string, language: string) {
    const lang = language.trim().toLowerCase().split(/\s+/)[0]
    if (ForgeLangs.has(lang)) return highlightForge(code)
    if (ShellLangs.has(lang)) return highlightShell(code)
    if (hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
    return ""
}

function slug(text: string) {
    return text.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-")
}

function alertTitles() {
    return {
        note: vscode.l10n.t("Note"),
        tip: vscode.l10n.t("Tip"),
        important: vscode.l10n.t("Important"),
        warning: vscode.l10n.t("Warning"),
        caution: vscode.l10n.t("Caution")
    }
}

function alertsPlugin(md: Markdown) {
    md.core.ruler.after("block", "forge_alerts", (state) => {
        const tokens = state.tokens
        const titles = alertTitles()

        for (let i = 0; i < tokens.length; i++) {
            const open = tokens[i]
            const inline = tokens[i + 2]
            if (open.type !== "blockquote_open" || tokens[i + 1]?.type !== "paragraph_open" || inline?.type !== "inline") continue

            const m = inline.content.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\n|$)/i)
            if (!m) continue
            const kind = m[1].toLowerCase() as keyof typeof titles

            let depth = 0, close = -1
            for (let j = i; j < tokens.length; j++) {
                if (tokens[j].type === "blockquote_open") depth++
                else if (tokens[j].type === "blockquote_close" && --depth === 0) { close = j; break }
            }
            if (close === -1) continue

            open.tag = "div"
            open.attrSet("class", `alert alert-${kind}`)
            tokens[close].tag = "div"
            inline.content = inline.content.slice(m[0].length)

            const title = new state.Token("html_block", "", 0)
            title.content = `<p class="alert-title">${esc(titles[kind])}</p>\n`
            tokens.splice(i + 1, 0, title)
        }
    })

    md.core.ruler.after("inline", "forge_heading_ids", (state) => {
        const seen = new Map<string, number>()
        state.tokens.forEach((t, i) => {
            if (t.type !== "heading_open") return
            const base = slug(state.tokens[i + 1].content)
            const n = seen.get(base) ?? 0
            seen.set(base, n + 1)
            t.attrSet("id", n ? `${base}-${n}` : base)
        })
    })
}

function codiconPlugin(md: Markdown) {
    md.inline.ruler.before("escape", "codicon", (state, silent) => {
        if (state.src.charCodeAt(state.pos) !== 0x24 || state.src.charCodeAt(state.pos + 1) !== 0x28) return false
        const match = /^\$\(([a-z0-9-]+)(~spin)?\)/i.exec(state.src.slice(state.pos))
        if (!match) return false
        if (!silent) {
            const t = state.push("codicon", "", 0)
            t.content = match[1]
            t.meta = { spin: !!match[2] }
        }
        state.pos += match[0].length
        return true
    })

    md.renderer.rules.codicon = (tokens, i) =>
        `<span class="codicon codicon-${esc(tokens[i].content)}${tokens[i].meta?.spin ? " codicon-modifier-spin" : ""}"></span>`
}

const md = new MarkdownIt({
    html: true,
    linkify: true,
    highlight: (code, lang) => highlightCode(code, lang)
}).use(alertsPlugin).use(codiconPlugin)

function renderHeader(guide: GuideMetadata) {
    const words = guide.content.split(/\s+/).filter(Boolean).length
    const minutes = Math.max(1, Math.ceil(words / 200))
    const author = guide.contributors.find((x) => x.isOriginalAuthor) ?? guide.contributors[0]
    const others = guide.contributors.filter((x) => x !== author)
    const favorite = isFavoriteGuide(guide.id)

    return `<header>
        <div class="badges">
            <span class="badge${favorite ? " badge-favorite" : ""}">
                <span class="codicon codicon-${favorite ? "star-full" : "package"}"></span>
                ${esc(guide.packageName)}
            </span>
            ${renderBadge(guide)}
        </div>
        <h1>${esc(displayGuideTitle(guide))}</h1>

        <div class="byline">
            ${author ? `<div class="author">
                ${renderAvatar(author, "large")}
                <div>
                    <div class="name" title="${userTooltip(author)}">${esc(author.username)}</div>
                    <div class="sub">${vscode.l10n.t("Author")} · ${vscode.l10n.t("{0} min read", minutes)}</div>
                </div>
            </div>` : ""}

            ${others.length ? `<div class="contributors">
                ${renderStack(others)}
                <div>
                    <div class="sub">${others.length === 1 ? vscode.l10n.t("1 Contributor") : vscode.l10n.t("{0} Contributors", others.length)}</div>
                </div>
            </div>` : ""}

            <a class="docs-link" href="${esc(buildGuideURL(guide))}">
                <span class="codicon codicon-link-external"></span> ${vscode.l10n.t("Open in Docs")}
            </a>
        </div>

        <div class="approval">
            <span class="codicon codicon-verified-filled approval-icon"></span>
            <div class="approval-body">
                <div class="approval-title">
                    <span>${guide.approver ? vscode.l10n.t("Approved by") : vscode.l10n.t("Approved")}</span>
                    ${guide.approver ? renderUser(guide.approver) : ""}
                </div>
                <div class="sub" title="${esc(formatDate(guide.approvedAt) ?? "")}">
                    ${esc(formatRelative(guide.approvedAt) ?? "")} · ${esc(formatDay(guide.approvedAt) ?? "")}
                </div>
            </div>
        </div>
    </header>`
}

function getHtml(guide: GuideMetadata, webview: vscode.Webview, media: vscode.Uri) {
    const nonce = Math.random().toString(36).slice(2)
    const colors = getExtensionConfig().colors
    const body = md.render(guide.content || vscode.l10n.t("*No guide content available.*"))

    const css = (file: string) => webview.asWebviewUri(vscode.Uri.joinPath(media, file))

    return `<!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <meta
                    http-equiv="Content-Security-Policy"
	                content="default-src 'none'; img-src https: data:; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'nonce-${nonce}';"
                />
                <link rel="stylesheet" href="${css("codicon.css")}">
                <link rel="stylesheet" href="${css("preview.css")}">
                <style nonce="${nonce}">
	                :root {
		                --fn-name: ${resolveColor(colors.function?.name, "#AC75FF")};
		                --fn-dollar: ${resolveColor(colors.function?.dollar, "#FE7CEB")};
		                --fn-semi: ${resolveColor(colors.function?.semicolon, "#C586C0")};
		                --fn-op-neg: ${resolveColor(colors.operators?.negation, "#4FA3FF")};
                        --fn-op-silent: ${resolveColor(colors.operators?.silent, "#FF9F43")};
                        --fn-op-count: ${resolveColor(colors.operators?.count, "#33D17A")};
                        --fn-op-count-delim: ${resolveColor(colors.operators?.countDelimiter, "#76E3A0")};
	                }
                </style>
            </head>
        <body>
	        ${renderHeader(guide)}
	        <main>${body}</main>
        </body>
    </html>`
}

function getFavoriteGuideIds() {
    return new Set<number>(ExtensionContext.globalState.get<number[]>(FavoriteGuidesKey, []))
}

async function setFavoriteGuideIds(ids: Iterable<number>) {
    const values = [...new Set(ids)].sort((a, b) => a - b)
    await ExtensionContext.globalState.update(FavoriteGuidesKey, values)
}

/**
 * Checks whether a guide is favorited,
 * @param id The guide id.
 * @returns 
 */
export function isFavoriteGuide(id: number) {
    return getFavoriteGuideIds().has(id)
}

/**
 * Adds a guide to favorites.
 * @param id The guide id.
 */
export async function addFavoriteGuide(id: number) {
    const ids = getFavoriteGuideIds()
    ids.add(id)
    await setFavoriteGuideIds(ids)
}

/**
 * Removes a guide from favorites.
 * @param id The guide id.
 */
export async function removeFavoriteGuide(id: number) {
    const ids = getFavoriteGuideIds()
    ids.delete(id)
    await setFavoriteGuideIds(ids)
}

function slugify(value: string | null) {
    if (!value) return
    return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "").replace(/-+/g, "-")
}

/**
 * Builds the URL for a guide.
 * @param guide The guide metadata.
 * @returns 
 */
export function buildGuideURL(guide: GuideMetadata) {
    const paths = (guide.title ? "guide" : guide.targetType) + "/" + (slugify(guide.title) || guide.targetName!)
    return DocsUrl + paths + (guide.targetType === "none" ? `-${guide.id}` : "") + `?p=${guide.packageName}`
}

function matchesGuide(guide: GuideMetadata, query: Exclude<GuideFindQuery, string>) {
    if (query.id != null && guide.id !== query.id) return false
    if (query.referenceId != null && guide.referenceId !== query.referenceId) return false
    if (query.guideType && guide.guideType !== query.guideType) return false
    if (query.packageName && !normalize(guide.packageName).includes(normalize(query.packageName))) return false
    if (query.targetType && guide.targetType !== query.targetType) return false
    if (query.targetName != null && normalize(guide.targetName) !== normalize(query.targetName)) return false
    if (query.title != null && normalize(guide.title) !== normalize(query.title)) return false
    if (query.category != null && !normalize(guide.category).includes(normalize(query.category))) return false
    if (query.subCategory != null && !normalize(guide.subCategory).includes(normalize(query.subCategory))) return false

    if (query.approvedAfter) {
        const approvedAfter = new Date(query.approvedAfter).getTime()
        const approvedAt = new Date(guide.approvedAt).getTime()
        if (!Number.isNaN(approvedAfter) && !Number.isNaN(approvedAt) && approvedAt < approvedAfter) return false
    }

    if (query.approvedBefore) {
        const approvedBefore = new Date(query.approvedBefore).getTime()
        const approvedAt = new Date(guide.approvedAt).getTime()
        if (!Number.isNaN(approvedBefore) && !Number.isNaN(approvedAt) && approvedAt > approvedBefore) return false
    }

    if (query.reviewerId != null && guide.reviewerId !== query.reviewerId) return false
    if (query.approverId != null && guide.approver?.id !== query.approverId) return false

    if (query.approverUsername && !normalize(guide.approver?.username).includes(normalize(query.approverUsername)))
        return false

    if (query.contributorId != null) {
        const hasContributor = (guide.contributors ?? []).some((x) => x.id === query.contributorId)
        if (!hasContributor) return false
    }

    if (query.contributorUsername) {
        const wanted = normalize(query.contributorUsername)
        const hasContributor = (guide.contributors ?? []).some((x) => normalize(x.username).includes(wanted))
        if (!hasContributor) return false
    }

    if (query.authorUsername) {
        const wanted = normalize(query.authorUsername)
        const hasAuthor = (guide.contributors ?? []).some(
            (c) => c.isOriginalAuthor && normalize(c.username).includes(wanted)
        )
        if (!hasAuthor) return false
    }

    if (query.text) {
        const haystack = [
            guide.packageName,
            guide.targetType,
            guide.targetName ?? "",
            guide.title ?? "",
            guide.category ?? "",
            guide.subCategory ?? "",
            guide.content ?? "",
            guide.approver?.username ?? "",
            ...(guide.contributors ?? []).map((x) => x.username)
        ].join("\n").toLowerCase()

        if (!haystack.includes(query.text.toLowerCase())) return false
    }

    if (query.where && !query.where(guide)) return false
    return true
}

function sortFoundGuides(guides: GuideMetadata[], query?: Exclude<GuideFindQuery, string>) {
    const sorted = [...guides]

    const dir = query?.sortDir === "asc" ? 1 : -1
    const sortBy = query?.sortBy ?? "relevance"

    sorted.sort((a, b) => {
        if (sortBy === "approvedAt") {
            const aTime = new Date(a.approvedAt).getTime() || 0
            const bTime = new Date(b.approvedAt).getTime() || 0
            return (aTime - bTime) * dir
        }

        if (sortBy === "title") {
            return compareText(displayGuideTitle(a), displayGuideTitle(b)) * dir
        }

        return compareText(displayGuideTitle(a), displayGuideTitle(b))
    })

    return sorted
}

/**
 * Finds a guide by query.
 * @param query The search query.
 * @returns 
 */
export async function findGuide(query: GuideFindQuery) {
    const all = await getGuides()

    if (typeof query === "string") {
        const wanted = normalize(query)

        return all.find((guide) =>
            normalize(guide.targetName) === wanted ||
            normalize(guide.title) === wanted ||
            normalize(displayGuideTitle(guide)) === wanted
        ) ?? null
    }

    const matches = all.filter((guide) => matchesGuide(guide, query))
    const sorted = sortFoundGuides(matches, query)

    return sorted[0] ?? null
}

function parseGuideQuery(input: string) {
    const filters: Record<string, string> = {}
    const textParts: string[] = []

    let activeKey: string | undefined
    let activeValue: string | undefined

    const tokens = input.trim().split(/\s+/)
    for (const token of tokens) {
        const match = token.match(/^(\w+):(.*)$/)

        if (match) {
            const [, key, value] = match
            const lowerKey = key.toLowerCase()

            filters[lowerKey] = value

            if (!value) {
                activeKey = lowerKey
                activeValue = value
            }
        } else {
            textParts.push(token)
        }
    }

    return {
        text: textParts.join(" "),
        filters,
        activeKey,
        activeValue
    }
}

function collectValues(guides: GuideMetadata[]) {
    return {
        category: [...new Set(guides.map((g) => g.category).filter(Boolean))],
        subcategory: [...new Set(guides.map((g) => g.subCategory).filter(Boolean))],
        author: [
            ...new Set(guides.flatMap((g) => g.contributors.filter((c) => c.isOriginalAuthor).map((c) => c.username)))
        ],
        contributor: [
            ...new Set(guides.flatMap((g) => g.contributors.filter((c) => !c.isOriginalAuthor).map((c) => c.username)))
        ],
        approver: [...new Set(guides.map((g) => g.approver?.username).filter(Boolean))],
        package: [...new Set(guides.map((g) => g.packageName))],
        type: GuideTargetTypes
    }
}

async function searchGuides() {
    const guides = await getGuides()
    if (!guides.length) {
        vscode.window.showInformationMessage(vscode.l10n.t("No guides available."))
        return
    }

    const qp = vscode.window.createQuickPick<any>()
    qp.placeholder = vscode.l10n.t("Search guides... (e.g. author:Nicky package:ForgeScript)")

    const values = collectValues(guides)
    type Keys = keyof typeof values

    const update = (input: string) => {
        const { text, filters, activeKey, activeValue } = parseGuideQuery(input)
        const keys = Object.keys(values) as Keys[]

        const query: any = {}
        if (text) query.text = text
        if (filters.category) query.category = filters.category
        if (filters.subcategory) query.subCategory = filters.subcategory
        if (filters.package) query.packageName = filters.package
        if (filters.type) query.targetType = filters.type
        if (filters.author) query.authorUsername = filters.author
        if (filters.contributor) query.contributorUsername = filters.contributor
        if (filters.approver) query.approverUsername = filters.approver

        const filteredGuides = guides.filter((g) => matchesGuide(g, query)).sort(sortGuides)
        const guideItems = filteredGuides.map((guide) => ({
            label: displayGuideTitle(guide),
            description: guide.packageName,
            detail: guide.targetType !== "none"
                ? toTitleCase(guide.targetType)
                : [guide.category, guide.subCategory].filter(Boolean).join(" • "),
            iconPath: new vscode.ThemeIcon("book"),
            alwaysShow: true,
            guide
        }))

        const usedKeys = Object.keys(filters)
        const keyItems = keys
            .filter((key) => !usedKeys.includes(key))
            .map((key) => ({
                label: key + ":",
                description: vscode.l10n.t("Filter"),
                action: "key",
                alwaysShow: true,
                iconPath: new vscode.ThemeIcon("filter")
            }))

        let suggestionItems: any[] = []

        if (!!activeKey && activeKey && values[activeKey as Keys]) {
            const suggestions = values[activeKey as Keys]

            suggestionItems = suggestions
                .filter((v) => (!activeValue || v!.toLowerCase().includes(activeValue.toLowerCase())))
                .map((value) => ({
                    label: value!,
                    description: `${activeKey}`,
                    action: "set-filter",
                    key: activeKey,
                    alwaysShow: true,
                    value
                }))
        }

        qp.items = [
            ...(activeKey ? [] : keyItems),
            ...suggestionItems,
            ...guideItems
        ]
    }

    update("")
    qp.onDidChangeValue(update)
    qp.onDidAccept(async () => {
        const item = qp.selectedItems[0]
        if (!item) return

        if (item.action === "key") {
            qp.value = qp.value + item.label
            return
        }

        if (item.action === "set-filter") {
            const parts = qp.value.split(/\s+/).filter(Boolean)
            const newParts = parts.map((p) => (p.startsWith(item.key + ":") ? `${item.key}:${item.value}` : p))

            if (!newParts.some((part) => part.startsWith(item.key + ":"))) {
                newParts.push(`${item.key}:${item.value}`)
            }

            qp.value = newParts.join(" ") + " "
            return
        }

        await vscode.commands.executeCommand("forgevsc.openGuide", item.guide)
        qp.hide()
    })

    qp.show()
}

class ForgeGuidesProvider implements vscode.TreeDataProvider<GuideNode> {
    private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<GuideNode | undefined | void>()
    readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event

    refresh() {
        this.onDidChangeTreeDataEmitter.fire()
    }

    async getTreeItem(element: GuideNode) {
        if (element.kind === "guide" && element.guide) {
            const guide = element.guide
            const label = displayGuideTitle(guide)

            const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None)
            item.id = `guide:${element.key}`
            item.contextValue = isFavoriteGuide(guide.id) ? "guide.favorite" : "guide"
            item.iconPath = new vscode.ThemeIcon("book")
            if (element.isFavorite) item.description = guide.packageName
            item.command = {
                command: "forgevsc.openGuide",
                title: "",
                arguments: [guide]
            }

            return item
        }

        if (element.kind === "favorites") {
            const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded)
            item.id = "guides:favorites"
            item.contextValue = "favorites"
            item.tooltip = vscode.l10n.t("Favorited Guides")
            item.iconPath = new vscode.ThemeIcon("star-full")
            return item
        }

        const item = new vscode.TreeItem(
            element.label,
            vscode.TreeItemCollapsibleState.Collapsed
        )

        let iconPath
        if (element.kind === "package") iconPath = "package"
        else if (element.kind === "category" && element.category)
            iconPath = IconPaths[element.category.slice(0, -1)]?.icon || "folder"
        else iconPath = "folder"

        item.id = `${element.kind}:${element.key}`
        item.contextValue = element.kind
        item.tooltip = element.label
        item.iconPath = new vscode.ThemeIcon(iconPath)

        return item
    }

    async getChildren(element?: GuideNode) {
        const guides = await getGuides()

        if (!element) {
            const packages = [...new Set(guides.map((x) => clean(x.packageName)).filter(Boolean))]
                .sort(compareText)
                .map<GuideNode>((pkg) => ({
                    kind: "package",
                    key: pkg,
                    label: pkg,
                    packageName: pkg
                }))

            if (!guides.length) return []

            const favoritesNode: GuideNode = {
                kind: "favorites",
                key: "favorites",
                label: vscode.l10n.t("Favorites")
            }

            return [favoritesNode, ...packages]
        }

        if (element.kind === "favorites") {
            const favoriteIds = getFavoriteGuideIds()

            return guides
                .filter((x) => favoriteIds.has(x.id))
                .sort(sortGuides)
                .map<GuideNode>((guide) => ({
                    kind: "guide",
                    key: `favorite:${guide.id}`,
                    label: displayGuideTitle(guide),
                    isFavorite: true,
                    guide
                }))
        }

        if (element.kind === "package") {
            const packageGuides = guides.filter((x) => clean(x.packageName) === element.packageName)
            const categories = [...new Set(packageGuides.map((x) => fallbackCategory(x.category, x.targetType)))]
                .sort(compareText)
                .map<GuideNode>((category) => ({
                    kind: "category",
                    key: groupKey(element.packageName, category),
                    label: category,
                    packageName: element.packageName,
                    category
                }))

            return categories
        }

        if (element.kind === "category") {
            const categoryGuides = guides
                .filter((x) => clean(x.packageName) === element.packageName)
                .filter((x) => fallbackCategory(x.category, x.targetType) === element.category)

            const subCategories = [...new Set(categoryGuides.map((x) => clean(x.subCategory)).filter(Boolean))]
                .sort(compareText)
                .map<GuideNode>((subCategory) => ({
                    kind: "subCategory",
                    key: groupKey(element.packageName, element.category, subCategory),
                    label: subCategory,
                    packageName: element.packageName,
                    category: element.category,
                    subCategory
                }))

            const directGuides = categoryGuides
                .filter((x) => !clean(x.subCategory))
                .sort(sortGuides)
                .map<GuideNode>((guide) => ({
                    kind: "guide",
                    key: String(guide.id),
                    label: displayGuideTitle(guide),
                    packageName: element.packageName,
                    category: element.category,
                    guide
                }))

            return [...subCategories, ...directGuides]
        }

        if (element.kind === "subCategory") {
            return guides
                .filter((x) => clean(x.packageName) === element.packageName)
                .filter((x) => fallbackCategory(x.category, x.targetType) === element.category)
                .filter((x) => clean(x.subCategory) === element.subCategory)
                .sort(sortGuides)
                .map<GuideNode>((guide) => ({
                    kind: "guide",
                    key: String(guide.id),
                    label: displayGuideTitle(guide),
                    packageName: element.packageName,
                    category: element.category,
                    subCategory: element.subCategory,
                    guide
                }))
        }

        return []
    }
}

function showGuidePreview(guide: GuideMetadata, extensionUri: vscode.Uri) {
    const media = vscode.Uri.joinPath(extensionUri, "styles")
    const title = displayGuideTitle(guide)

    if (!WebviewPanel) {
        WebviewPanel = vscode.window.createWebviewPanel("forge.guidePreview", title, vscode.ViewColumn.Active, {
            enableFindWidget: true,
            localResourceRoots: [media]
        })
        WebviewPanel.onDidDispose(() => (WebviewPanel = undefined))
    } else {
        WebviewPanel.title = title
        WebviewPanel.reveal(undefined, true)
    }

    WebviewPanel.webview.html = getHtml(guide, WebviewPanel.webview, media)
}

/**
 * Registers the preview for guides.
 * @param ctx The extension context.
 */
export function registerGuidePreview(ctx: vscode.ExtensionContext) {
    ctx.subscriptions.push(
        // Preview Guide
        vscode.commands.registerCommand("forgevsc.previewGuide", async (input: GuideMetadata | number | string) => {
            let guide: GuideMetadata | null = null

            if (typeof input === "object" && input) {
                guide = input
            } else if (typeof input === "number") {
                guide = await findGuide({ id: input })
            } else if (typeof input === "string") {
                const trimmed = input.trim()
                const id = Number(trimmed)

                guide = !Number.isNaN(id)
                    ? await findGuide({ id })
                    : await findGuide(trimmed)
            }

            if (!guide) {
                vscode.window.showErrorMessage(vscode.l10n.t("No guide found for this function."))
                return
            }

            showGuidePreview(guide, ctx.extensionUri)
        }),

        // Open Guide
        vscode.commands.registerCommand("forgevsc.openGuide", async (guide: GuideMetadata) => {
            await vscode.commands.executeCommand("forgevsc.previewGuide", guide)
        })
    )
}

/**
 * Registers the sidebar tree view for guides.
 * @param ctx The extension context.
 */
export function registerGuidesView(ctx: vscode.ExtensionContext) {
    ExtensionContext = ctx

    ctx.globalState.setKeysForSync([FavoriteGuidesKey])

    const provider = new ForgeGuidesProvider()
    const tree = vscode.window.createTreeView("forge.guidesView", {
        treeDataProvider: provider,
        showCollapseAll: true
    })

    ctx.subscriptions.push(
        tree,
        // Favorite Guide
        vscode.commands.registerCommand("forgevsc.favoriteGuide", async (node: GuideNode) => {
            if (!node.guide) return
            await addFavoriteGuide(node.guide.id)
            provider.refresh()
        }),

        // Unfavorite Guide
        vscode.commands.registerCommand("forgevsc.unfavoriteGuide", async (node: GuideNode) => {
            if (!node.guide) return
            await removeFavoriteGuide(node.guide.id)
            provider.refresh()
        }),

        // Open Guide Externally
        vscode.commands.registerCommand("forgevsc.openGuideExternal", async (node: GuideNode) => {
            if (!node?.guide) return
            await vscode.env.openExternal(vscode.Uri.parse(buildGuideURL(node.guide)))
        }),

        // Search Guides
        vscode.commands.registerCommand("forgevsc.searchGuides", async () => {
            try {
                await searchGuides()
            } catch (err) {
                Logger?.error(`Guide search failed: ${String(err)}`)
                vscode.window.showErrorMessage(vscode.l10n.t("Could not open guide search."))
            }
        }),

        // Reload Guide Metadata
        vscode.commands.registerCommand("forgevsc.reloadGuideMetadata", async () => {
            const guides = await getGuides(true)
            provider.refresh()
            if (guides.length) vscode.window.showInformationMessage(vscode.l10n.t("Successfully fetched guide metadata!"))
        })
    )
}