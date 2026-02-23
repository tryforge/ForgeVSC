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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultParam = void 0;
exports.loadCustomFunctions = loadCustomFunctions;
const forgescript_1 = require("@tryforge/forgescript");
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const typescript_1 = __importDefault(require("typescript"));
exports.DefaultParam = {
    type: "String",
    required: true,
    rest: false,
    description: "Custom function param",
};
function getString(node) {
    if (typescript_1.default.isStringLiteral(node))
        return node.text;
    if (typescript_1.default.isNoSubstitutionTemplateLiteral(node))
        return node.text;
    return undefined;
}
function getBoolean(node) {
    if (node.kind === typescript_1.default.SyntaxKind.TrueKeyword)
        return true;
    if (node.kind === typescript_1.default.SyntaxKind.FalseKeyword)
        return false;
    return undefined;
}
function parseArgType(init) {
    if (typescript_1.default.isNumericLiteral(init)) {
        const n = Number(init.text);
        const key = forgescript_1.ArgType[n];
        return (typeof key === "string" && key in forgescript_1.ArgType) ? key : "String";
    }
    if (typescript_1.default.isStringLiteral(init) || typescript_1.default.isNoSubstitutionTemplateLiteral(init) || typescript_1.default.isIdentifier(init)) {
        const key = init.text;
        return (key in forgescript_1.ArgType) ? key : "String";
    }
    return "String";
}
function normalizeParam(partial) {
    if (!partial.name)
        return undefined;
    return {
        name: partial.name,
        type: partial.type ?? exports.DefaultParam.type,
        required: partial.required ?? exports.DefaultParam.required,
        rest: partial.rest ?? exports.DefaultParam.rest,
        description: partial.description ?? exports.DefaultParam.description,
    };
}
function getParamObject(node) {
    if (!typescript_1.default.isObjectLiteralExpression(node))
        return undefined;
    let param = {};
    for (const prop of node.properties) {
        if (!typescript_1.default.isPropertyAssignment(prop))
            continue;
        if (!typescript_1.default.isIdentifier(prop.name) && !typescript_1.default.isStringLiteral(prop.name))
            continue;
        const key = typescript_1.default.isIdentifier(prop.name) ? prop.name.text : prop.name.text;
        if (key === "name")
            param.name = getString(prop.initializer);
        else if (key === "type")
            param.type = parseArgType(prop.initializer);
        else if (key === "required")
            param.required = getBoolean(prop.initializer);
        else if (key === "rest")
            param.rest = getBoolean(prop.initializer);
        else if (key === "description")
            param.description = getString(prop.initializer);
    }
    return normalizeParam(param);
}
function getParam(el) {
    if (typescript_1.default.isStringLiteral(el))
        return normalizeParam({ name: el.text });
    return getParamObject(el);
}
function getParams(node) {
    if (!typescript_1.default.isArrayLiteralExpression(node))
        return undefined;
    const args = [];
    for (const el of node.elements) {
        const param = getParam(el);
        if (!param)
            return undefined;
        args.push(param);
    }
    return args;
}
function readMetadata(obj) {
    let fn = {};
    for (const prop of obj.properties) {
        if (!typescript_1.default.isPropertyAssignment(prop))
            continue;
        const key = prop.name && typescript_1.default.isIdentifier(prop.name) ? prop.name.text : undefined;
        if (!key)
            continue;
        if (key === "name")
            fn.name = "$" + getString(prop.initializer);
        else if (key === "params")
            fn.args = getParams(prop.initializer);
        else if (key === "brackets")
            fn.brackets = getBoolean(prop.initializer);
        else if (key === "output")
            fn.output = []; // <= Function here
        else if (key === "description")
            fn.description = getString(prop.initializer);
    }
    if (!fn.name)
        return null;
    if (fn.unwrap === undefined)
        fn.unwrap = (!!fn.args?.length && !fn.firstParamCondition);
    if (fn.brackets === undefined)
        fn.brackets = (fn.args?.length ? true : undefined);
    if (fn.description === undefined)
        fn.description = "Custom function";
    return fn;
}
function extractCustomFunctions(text, fileName) {
    const kind = fileName.endsWith(".ts") || fileName.endsWith(".tsx")
        ? typescript_1.default.ScriptKind.TS
        : fileName.endsWith(".jsx")
            ? typescript_1.default.ScriptKind.JSX
            : typescript_1.default.ScriptKind.JS;
    const sf = typescript_1.default.createSourceFile(fileName, text, typescript_1.default.ScriptTarget.Latest, true, kind);
    const found = [];
    function visit(node) {
        // export default new ForgeFunction({ ... })
        if (typescript_1.default.isExportAssignment(node)) {
            const expr = node.expression;
            if (typescript_1.default.isNewExpression(expr) && expr.arguments?.length) {
                const arg0 = expr.arguments[0];
                if (typescript_1.default.isObjectLiteralExpression(arg0)) {
                    const meta = readMetadata(arg0);
                    if (meta)
                        found.push(meta);
                }
            }
            // export default { ... }
            if (typescript_1.default.isObjectLiteralExpression(expr)) {
                const meta = readMetadata(expr);
                if (meta)
                    found.push(meta);
            }
        }
        // module.exports = { ... }
        if (typescript_1.default.isBinaryExpression(node) && node.operatorToken.kind === typescript_1.default.SyntaxKind.EqualsToken) {
            const left = node.left;
            const right = node.right;
            const isModuleExports = typescript_1.default.isPropertyAccessExpression(left) && typescript_1.default.isIdentifier(left.expression)
                && left.expression.text === "module" && left.name.text === "exports";
            if (isModuleExports && typescript_1.default.isObjectLiteralExpression(right)) {
                const meta = readMetadata(right);
                if (meta)
                    found.push(meta);
            }
        }
        typescript_1.default.forEachChild(node, visit);
    }
    visit(sf);
    return found;
}
/**
 * Resolves the workspace path.
 * @param p The path to resolve.
 * @returns
 */
function resolveWorkspacePath(p) {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length)
        return null;
    if (path.isAbsolute(p))
        return vscode.Uri.file(p);
    return vscode.Uri.joinPath(folders[0].uri, p);
}
/**
 * Reads the directory safely.
 * @param uri The directory uri.
 * @returns
 */
async function safeReadDirectory(uri) {
    try {
        return await vscode.workspace.fs.readDirectory(uri);
    }
    catch (e) {
        if (e?.code === "FileNotFound" || e?.code === "ENOENT")
            return [];
        throw e;
    }
}
/**
 * Collects all files from the custom functions folder.
 * @param dir The directory uri.
 * @param out
 * @returns
 */
async function collectFiles(dir, out = []) {
    const entries = await safeReadDirectory(dir);
    for (const [name, type] of entries) {
        const uri = vscode.Uri.joinPath(dir, name);
        if (type === vscode.FileType.Directory)
            await collectFiles(uri, out);
        else if (/\.(ts|js|tsx|jsx)$/.test(name))
            out.push(uri);
    }
    return out;
}
/**
 * Returns the metadata of all custom functions.
 * @param customFunctionsPath The custom functions folder path.
 * @returns
 */
async function loadCustomFunctions(customFunctionsPath) {
    if (!customFunctionsPath)
        return [];
    const dirUri = resolveWorkspacePath(customFunctionsPath);
    if (!dirUri)
        return [];
    const files = await collectFiles(dirUri);
    const meta = [];
    for (const file of files) {
        const buf = await vscode.workspace.fs.readFile(file);
        const text = Buffer.from(buf).toString("utf8");
        meta.push(...extractCustomFunctions(text, file.fsPath));
    }
    return meta;
}
//# sourceMappingURL=functions.js.map