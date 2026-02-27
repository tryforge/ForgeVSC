"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Defaults = void 0;
exports.getExtensionConfig = getExtensionConfig;
exports.loadExtensionConfig = loadExtensionConfig;
const vscode = __importStar(require("vscode"));
exports.Defaults = {
    customFunctionsPath: "",
    additionalPackages: [],
    colors: {
        function: "#ac75ff",
        dollar: "#fe7ceb",
        semicolon: "#c586c0",
        brackets: "#ffd700",
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
function getExtensionConfig() {
    return cached;
}
async function loadExtensionConfig() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
        cached = exports.Defaults;
        return cached;
    }
    const uri = vscode.Uri.joinPath(folders[0].uri, ".forgevsc.json");
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const parsed = JSON.parse(Buffer.from(raw).toString("utf8"));
        cached = {
            customFunctionsPath: parsed.customFunctionsPath ?? exports.Defaults.customFunctionsPath,
            additionalPackages: Array.from(new Set([...exports.Defaults.additionalPackages, ...(parsed.additionalPackages ?? [])])),
            colors: { ...exports.Defaults.colors, ...(parsed.colors ?? {}) },
            features: { ...exports.Defaults.features, ...(parsed.features ?? {}) },
        };
    }
    catch {
        cached = exports.Defaults;
    }
    return cached;
}
//# sourceMappingURL=config.js.map