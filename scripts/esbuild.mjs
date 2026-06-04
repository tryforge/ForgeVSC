import { build } from "esbuild"

await build({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    platform: "browser",
    format: "cjs",
    target: "es2022",
    outfile: "out/web/extension.js",
    external: [
        "@xhayper/discord-rpc",
        "vscode",
        "net",
        "events",
        "tls",
        "fs",
        "path",
        "buffer",
        "stream"
    ],
    sourcemap: true,
}).catch(() => process.exit(1))