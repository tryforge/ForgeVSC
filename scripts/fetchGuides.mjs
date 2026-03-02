import { writeFileSync, renameSync, statSync } from "node:fs"

async function main() {
    const BASE_URL = process.env.GUIDES_BASE_URL
    const API_KEY = process.env.GUIDES_API_KEY

    if (!BASE_URL) throw new Error(`Missing "GUIDES_BASE_URL" secret.`)
    if (!API_KEY) throw new Error(`Missing "GUIDES_API_KEY" secret.`)

    const res = await fetch(BASE_URL + "?limit=none")
    if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(`Fetching guides failed: ${res.status} ${res.statusText}\n${text}`)
    }

    const data = await res.json()
    if (!data || data.success !== true || !Array.isArray(data.guides)) {
        throw new Error(`API response was not successful or missing guides array.`)
    }

    const tmpFile = "./guides.json.tmp"
    const outFile = "./guides.json"

    writeFileSync(tmpFile, JSON.stringify(data.guides), "utf8")
    renameSync(tmpFile, outFile)

    if (statSync(outFile).size < 2) throw new Error("File guides.json written but looks empty or corrupted.")
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})