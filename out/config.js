"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Defaults = void 0;
exports.getExtensionConfig = getExtensionConfig;
exports.findExtensionConfig = findExtensionConfig;
exports.loadExtensionConfig = loadExtensionConfig;
const _1 = require(".");
const vscode_1 = __importDefault(require("vscode"));
exports.Defaults = {
    customFunctionsPath: [],
    additionalPackages: [],
    colors: {
        function: {
            name: "#ac75ff",
            dollar: "#fe7ceb",
            semicolon: "#c586c0",
        },
        operators: {
            negation: "#4FA3FF",
            silent: "#FF9F43",
            count: "#33D17A",
            countDelimiter: "#76E3A0"
        },
    },
    features: {
        folding: true,
        hoverInfo: true,
        suggestions: true,
        signatureHelp: true,
        diagnostics: true,
        autocompletion: true,
    },
};
let cached = exports.Defaults;
/**
 * Returns the config options of the extension.
 * @returns
 */
function getExtensionConfig() {
    return cached;
}
/**
 * Finds the config file path of the extension.
 * @param root The root directory.
 * @returns
 */
async function findExtensionConfig(root) {
    const paths = [
        vscode_1.default.Uri.joinPath(root, ".forgevsc.json"),
        vscode_1.default.Uri.joinPath(root, ".vscode", ".forgevsc.json")
    ];
    for (const uri of paths) {
        try {
            await vscode_1.default.workspace.fs.stat(uri);
            return uri;
        }
        catch { }
    }
    return null;
}
/**
 * Loads the config options of the extension.
 * @returns
 */
async function loadExtensionConfig() {
    const folders = vscode_1.default.workspace.workspaceFolders;
    if (!folders?.length) {
        cached = exports.Defaults;
        return cached;
    }
    const root = folders[0].uri;
    const uri = await findExtensionConfig(root);
    if (uri) {
        try {
            const raw = await vscode_1.default.workspace.fs.readFile(uri);
            const parsed = JSON.parse(Buffer.from(raw).toString("utf8"));
            cached = {
                customFunctionsPath: (0, _1.toArray)(parsed.customFunctionsPath ?? exports.Defaults.customFunctionsPath),
                additionalPackages: Array.from(new Set([...exports.Defaults.additionalPackages, ...(parsed.additionalPackages ?? [])])),
                colors: {
                    function: { ...exports.Defaults.colors.function, ...(parsed.colors?.function ?? {}) },
                    operators: { ...exports.Defaults.colors.operators, ...(parsed.colors?.operators ?? {}) },
                },
                features: { ...exports.Defaults.features, ...(parsed.features ?? {}) },
            };
            return cached;
        }
        catch { }
    }
    cached = exports.Defaults;
    return cached;
}
//# sourceMappingURL=config.js.map