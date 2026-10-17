import { context } from "esbuild"

const watch = process.argv.includes("--watch")

const logPlugin = {
    name: "log",
    setup(build) {
        build.onStart(() => console.log("[watch] Build started"))
        build.onEnd((result) => {
            for (const { text, location } of result.errors) {
                console.error(`✘ ${text}` + (location ? ` (${location.file}:${location.line}:${location.column})` : ""))
            }
            console.log("[watch] Build finished" + (result.errors.length ? ` with ${result.errors.length} error(s)` : ""))
        })
    }
}

const ctx = await context({
    entryPoints: ["src/extension.ts"],
    outfile: "out/extension.js",
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "es2022",
    external: ["vscode"],
    minify: !watch,
    sourcemap: watch,
    logLevel: "silent",
    plugins: [logPlugin]
})

if (watch) {
    await ctx.watch()
    console.log("[watch] Watching for changes...")
} else {
    await ctx.rebuild()
    await ctx.dispose()
}