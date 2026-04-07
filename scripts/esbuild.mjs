import { build } from "esbuild"

await build({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    platform: "browser",
    format: "cjs",
    target: "es2022",
    outfile: "out/web/extension.js",
    external: ["vscode"],
    sourcemap: true,
}).catch(() => process.exit(1))