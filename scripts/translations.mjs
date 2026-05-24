import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs"
import { basename, dirname, join, resolve } from "path"
import { fileURLToPath } from "url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const dir = join(root, "translations")
const l10nFile = join(dir, "bundle.l10n.json")
const nlsFile = join(root, "package.nls.json")

function readJson(filePath) {
    return JSON.parse(readFileSync(filePath, "utf8"))
}

function writeJson(filePath, data) {
    writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8")
}

function findLanguageFiles() {
    return readdirSync(dir)
        .filter((f) => /^bundle\.l10n\.[a-z]{2,}(?:-[A-Z]{2,})?\.json$/.test(f))
        .map((f) => join(dir, f))
}

function findNlsFiles() {
    return readdirSync(root)
        .filter((f) => /^package\.nls\.[a-z]{2,}(?:-[A-Z]{2,})?\.json$/.test(f))
        .map((f) => join(root, f))
}

function localeFromPath(filePath) {
    return basename(filePath)
        .replace(/^bundle\.l10n\./, "")
        .replace(/^package\.nls\./, "")
        .replace(/\.json$/, "")
}

/**
 * Syncs a single language file against the source bundle. Returns a summary object describing what changed.
 */
function syncFile(sourceKeys, sourceBundle, langFilePath) {
    const locale = localeFromPath(langFilePath)
    const existing = existsSync(langFilePath) ? readJson(langFilePath) : {}
    const existingKeys = new Set(Object.keys(existing))

    const added = []
    const removed = []
    const synced = {}

    for (const key of sourceKeys) {
        if (existingKeys.has(key)) {
            synced[key] = existing[key]
        } else {
            synced[key] = sourceBundle[key]
            added.push(key)
        }
    }

    for (const key of existingKeys) {
        if (!sourceKeys.includes(key)) {
            removed.push(key)
        }
    }

    writeJson(langFilePath, synced)

    return { locale, added, removed }
}

function printResults(results) {
    let totalAdded = 0
    let totalRemoved = 0

    for (const { locale, added, removed } of results) {
        const unchanged = added.length === 0 && removed.length === 0

        if (unchanged) {
            console.log(`  [${locale}] ✔ up to date`)
            continue
        }

        console.log(`  [${locale}]`)
        if (added.length) {
            console.log(`    + added (${added.length}):`)
            for (const key of added) console.log(`        ${key}`)
        }
        if (removed.length) {
            console.log(`    - removed (${removed.length}):`)
            for (const key of removed) console.log(`        ${key}`)
        }

        totalAdded += added.length
        totalRemoved += removed.length
    }

    return { totalAdded, totalRemoved }
}

if (!existsSync(l10nFile)) {
    console.error(`[sync-l10n] Source bundle not found: ${l10nFile}`)
    console.error(`[sync-l10n] Run \`npx @vscode/l10n-dev export\` first.`)
    process.exit(1)
}

const sourceBundle = readJson(l10nFile)
const sourceKeys = Object.keys(sourceBundle)
const langFiles = findLanguageFiles()

if (langFiles.length === 0) {
    console.log("[sync-l10n] No l10n language files found — nothing to sync.")
} else {
    console.log(`[sync-l10n] Source bundle: ${sourceKeys.length} keys`)
    console.log(`[sync-l10n] Language files found: ${langFiles.length}\n`)
    const results = langFiles.map((f) => syncFile(sourceKeys, sourceBundle, f))
    const { totalAdded, totalRemoved } = printResults(results)
    console.log(`\n[sync-l10n] Done. ${totalAdded} key${totalAdded === 1 ? "" : "s"} added, ${totalRemoved} key${totalRemoved === 1 ? "" : "s"} removed.`)
}

if (!existsSync(nlsFile)) {
    console.warn(`\n[sync-nls] package.nls.json not found — skipping NLS sync.`)
} else {
    const nlsBundle = readJson(nlsFile)
    const nlsKeys = Object.keys(nlsBundle)
    const nlsFiles = findNlsFiles()

    if (nlsFiles.length === 0) {
        console.log("\n[sync-nls] No nls language files found — nothing to sync.")
    } else {
        console.log(`[sync-nls] Source bundle: ${nlsKeys.length} keys`)
        console.log(`[sync-nls] Language files found: ${nlsFiles.length}\n`)
        const results = nlsFiles.map((f) => syncFile(nlsKeys, nlsBundle, f))
        const { totalAdded, totalRemoved } = printResults(results)
        console.log(`\n[sync-nls] Done. ${totalAdded} key${totalAdded === 1 ? "" : "s"} added, ${totalRemoved} key${totalRemoved === 1 ? "" : "s"} removed.`)
    }
}