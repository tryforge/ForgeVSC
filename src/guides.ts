import { DocsUrl, getGuides, Logger } from "."
import * as vscode from "vscode"

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
    reviewerId: number
    submittedAt: string
    approvedAt: string
    approver: GuideUser
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
        reviewerId?: number
        approverId?: number
        approverUsername?: string
        contributorId?: number
        contributorUsername?: string
        authorUsername?: string
        sortBy?: "relevance" | "approvedAt" | "title"
        sortDir?: "asc" | "desc"
        limit?: number
        where?: (g: GuideMetadata) => boolean
    }

const GuideScheme = "forge-guide"
const FavoriteGuidesKey = "forgevsc.favoriteGuides"

const IconPaths: Record<string, string> = {
    functions: "symbol-function",
    events: "symbol-event",
    enums: "symbol-enum"
}

let ExtensionContext: vscode.ExtensionContext

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

function markdownForGuide(guide: GuideMetadata) {
    const lines: string[] = []

    lines.push(`# ${displayGuideTitle(guide)}`)
    lines.push("")

    lines.push(`> **Approved:** \`${formatDate(guide.approvedAt)}\` by \`${guide.approver.username}\`\\`)
    const contributors = guide.contributors.map((x) => `\`${x.username}\``)
    lines.push(`> **Contributor${contributors.length === 1 ? "" : "s"}:** ${contributors.join(", ")}`)

    lines.push("")
    lines.push("---")
    lines.push("")
    lines.push(guide.content || "*No guide content available.*")

    return lines.join("\n")
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
        approver: [...new Set(guides.map((g) => g.approver.username))],
        package: [...new Set(guides.map((g) => g.packageName))],
        type: GuideTargetTypes
    }
}

async function searchGuides() {
    const guides = await getGuides()
    if (!guides.length) {
        vscode.window.showInformationMessage("No guides available.")
        return
    }

    const qp = vscode.window.createQuickPick<any>()
    qp.placeholder = "Search guides... (e.g. author:Nicky package:ForgeScript)"

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
            guide,
            alwaysShow: true
        }))

        const usedKeys = Object.keys(filters)
        const keyItems = keys
            .filter((key) => !usedKeys.includes(key))
            .map((key) => ({
                label: key + ":",
                description: "Filter",
                action: "key",
                alwaysShow: true
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
                    value,
                    alwaysShow: true
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
            item.tooltip = "Favorited Guides"
            item.iconPath = new vscode.ThemeIcon("star-full")
            return item
        }

        const item = new vscode.TreeItem(
            element.label,
            vscode.TreeItemCollapsibleState.Collapsed
        )

        let iconPath
        if (element.kind === "package") iconPath = "package"
        else if (element.kind === "category" && element.category) iconPath = IconPaths[element.category] || "folder"
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
                label: "Favorites"
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

/**
 * Registers the preview for guides.
 * @param ctx The extension context.
 */
export function registerGuidePreview(ctx: vscode.ExtensionContext) {
    ctx.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(GuideScheme, {
            async provideTextDocumentContent(uri) {
                const raw = decodeURIComponent(uri.path.replace(/^\//, "").replace(/\.md$/i, ""))

                let guide: GuideMetadata | null = null
                const id = Number(raw)

                if (!Number.isNaN(id)) guide = await findGuide({ id })
                if (!guide) guide = await findGuide(raw)

                if (!guide) {
                    return "# 404: Guide Not Found\n\nNo metadata was found for this guide."
                }

                return markdownForGuide(guide)
            }
        }),

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
                vscode.window.showErrorMessage("No guide found for this function.")
                return
            }

            const uri = vscode.Uri.parse(`${GuideScheme}:/${encodeURIComponent(String(guide.id))}.md`)
            await vscode.commands.executeCommand("markdown.showPreview", uri)
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
                vscode.window.showErrorMessage("Could not open guide search.")
            }
        }),

        // Reload Guide Metadata
        vscode.commands.registerCommand("forgevsc.reloadGuideMetadata", async () => {
            const guides = await getGuides(true)
            provider.refresh()
            if (guides.length) vscode.window.showInformationMessage("Successfully fetched guide metadata!")
        })
    )
}