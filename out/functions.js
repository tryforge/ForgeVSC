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
exports.getCustomFunctionLocation = getCustomFunctionLocation;
exports.loadCustomFunctions = loadCustomFunctions;
const types_1 = require("./types");
const _1 = require(".");
const vscode = __importStar(require("vscode"));
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
function getEnumName(node) {
    node = unwrapExpression(node);
    if (typescript_1.default.isIdentifier(node))
        return node.text;
    if (typescript_1.default.isPropertyAccessExpression(node))
        return node.name.text;
    return undefined;
}
function resolveArgType(node) {
    if (typescript_1.default.isPropertyAccessExpression(node)) {
        if (typescript_1.default.isIdentifier(node.expression) && node.expression.text === "ArgType") {
            return node.name.text;
        }
        return node.name.text;
    }
    if (typescript_1.default.isIdentifier(node))
        return node.text;
    if (typescript_1.default.isStringLiteral(node))
        return node.text;
    return undefined;
}
function parseArgType(node) {
    const key = resolveArgType(node);
    if (!key)
        return undefined;
    return (key in types_1.ArgType) ? key : undefined;
}
function normalizeParam(partial) {
    if (!partial.name)
        return undefined;
    let param = {};
    param.name = partial.name;
    param.type = partial.type ?? exports.DefaultParam.type;
    param.required = partial.required ?? exports.DefaultParam.required;
    param.rest = partial.rest ?? exports.DefaultParam.rest;
    param.description = partial.description ?? exports.DefaultParam.description;
    if (partial.enum)
        param.enum = partial.enum;
    if (partial.enumName)
        param.enumName = partial.enumName;
    if (partial.pointer)
        param.pointer = partial.pointer;
    if (partial.pointerProperty)
        param.pointerProperty = partial.pointerProperty;
    if (partial.condition)
        param.condition = partial.condition;
    if (partial.delimiter)
        param.delimiter = partial.delimiter;
    return param;
}
function getArgCall(node) {
    if (!typescript_1.default.isPropertyAccessExpression(node.expression))
        return undefined;
    const access = node.expression;
    if (!typescript_1.default.isIdentifier(access.expression) || access.expression.text !== "Arg")
        return undefined;
    const method = access.name.text;
    const match = method.match(/^(optional|required|rest)(.+)$/);
    if (!match)
        return undefined;
    const [, mode, rawType] = match;
    let type = rawType;
    const param = {
        required: mode === "required",
        rest: mode === "rest",
        type
    };
    let offset = 0;
    if (type === "Enum") {
        offset = 1;
        param.enumName = getEnumName(node.arguments[0]);
    }
    const name = node.arguments[offset];
    param.name = name && typescript_1.default.isStringLiteral(name) ? name.text : undefined;
    const desc = node.arguments[offset + 1];
    param.description = desc && typescript_1.default.isStringLiteral(desc) ? desc.text : exports.DefaultParam.description;
    if (mode === "rest") {
        const req = node.arguments[offset + 2];
        const required = req && getBoolean(req);
        if (required !== undefined)
            param.required = required;
    }
    switch (type) {
        case "GuildEmoji":
            param.pointer = 0;
            break;
        case "Reaction":
            param.pointer = 1;
            break;
        case "RoleOrUser":
            param.pointer = 0;
            param.pointerProperty = "guild";
            break;
    }
    return normalizeParam(param);
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
            param.type = parseArgType(prop.initializer) ?? "String";
        else if (key === "required")
            param.required = getBoolean(prop.initializer);
        else if (key === "rest")
            param.rest = getBoolean(prop.initializer);
        else if (key === "condition")
            param.condition = getBoolean(prop.initializer);
        else if (key === "description")
            param.description = getString(prop.initializer);
        else if (key === "enum")
            param.enumName = getEnumName(prop.initializer);
    }
    return normalizeParam(param);
}
function getParam(el) {
    if (typescript_1.default.isStringLiteral(el))
        return normalizeParam({ name: el.text });
    if (typescript_1.default.isCallExpression(el)) {
        const arg = getArgCall(el);
        if (arg)
            return arg;
    }
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
function getOutput(node) {
    const out = [];
    const add = (expr) => {
        const value = parseArgType(expr);
        if (value)
            out.push(value);
    };
    if (typescript_1.default.isArrayLiteralExpression(node)) {
        for (const el of node.elements)
            add(el);
    }
    else
        add(node);
    return out.length ? out : undefined;
}
function getPropertyKey(name) {
    if (typescript_1.default.isIdentifier(name) || typescript_1.default.isStringLiteral(name) || typescript_1.default.isNoSubstitutionTemplateLiteral(name))
        return name.text;
    return undefined;
}
function readMetadata(obj) {
    let fn = {};
    for (const prop of obj.properties) {
        if (!typescript_1.default.isPropertyAssignment(prop))
            continue;
        const key = getPropertyKey(prop.name);
        if (!key)
            continue;
        if (key === "name") {
            const name = getString(prop.initializer);
            if (name)
                fn.name = (name.startsWith("$") ? name : "$" + name);
        }
        else if (key === "params" || key === "args")
            fn.args = getParams(prop.initializer);
        else if (key === "brackets")
            fn.brackets = getBoolean(prop.initializer);
        else if (key === "unwrap")
            fn.unwrap = getBoolean(prop.initializer);
        else if (key === "output")
            fn.output = getOutput(prop.initializer);
        else if (key === "description")
            fn.description = getString(prop.initializer);
        else if (key === "deprecated")
            fn.deprecated = getBoolean(prop.initializer);
        else if (key === "experimental")
            fn.experimental = getBoolean(prop.initializer);
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
function collectBindings(sf) {
    const bindings = new Map();
    for (const stmt of sf.statements) {
        if (!typescript_1.default.isVariableStatement(stmt))
            continue;
        for (const decl of stmt.declarationList.declarations) {
            if (!typescript_1.default.isIdentifier(decl.name) || !decl.initializer)
                continue;
            bindings.set(decl.name.text, decl.initializer);
        }
    }
    return bindings;
}
function unwrapExpression(node) {
    let current = node;
    while (true) {
        if (typescript_1.default.isParenthesizedExpression(current)) {
            current = current.expression;
            continue;
        }
        if (typescript_1.default.isAsExpression(current)) {
            current = current.expression;
            continue;
        }
        if (typescript_1.default.isSatisfiesExpression(current)) {
            current = current.expression;
            continue;
        }
        if (typescript_1.default.isNonNullExpression(current)) {
            current = current.expression;
            continue;
        }
        return current;
    }
}
function resolveMetadataExpressions(node, bindings, seen = new Set()) {
    const expr = unwrapExpression(node);
    // { ... }
    if (typescript_1.default.isObjectLiteralExpression(expr)) {
        const meta = readMetadata(expr);
        return meta ? [meta] : [];
    }
    // new ForgeFunction({ ... })
    if (typescript_1.default.isNewExpression(expr) && expr.arguments?.length) {
        const arg0 = unwrapExpression(expr.arguments[0]);
        if (typescript_1.default.isObjectLiteralExpression(arg0)) {
            const meta = readMetadata(arg0);
            return meta ? [meta] : [];
        }
    }
    // [ ... ]
    if (typescript_1.default.isArrayLiteralExpression(expr)) {
        const out = [];
        for (const el of expr.elements) {
            if (typescript_1.default.isSpreadElement(el)) {
                out.push(...resolveMetadataExpressions(el.expression, bindings, seen));
                continue;
            }
            out.push(...resolveMetadataExpressions(el, bindings, seen));
        }
        return out;
    }
    // Identifier
    if (typescript_1.default.isIdentifier(expr)) {
        const name = expr.text;
        if (seen.has(name))
            return [];
        const init = bindings.get(name);
        if (!init)
            return [];
        seen.add(name);
        const out = resolveMetadataExpressions(init, bindings, seen);
        seen.delete(name);
        return out;
    }
    return [];
}
function getPropertyChain(node) {
    let current = node;
    const parts = [];
    while (typescript_1.default.isPropertyAccessExpression(current)) {
        parts.unshift(current.name.text);
        current = current.expression;
    }
    if (typescript_1.default.isIdentifier(current)) {
        parts.unshift(current.text);
        return parts;
    }
    return undefined;
}
/**
 * Returns the location of a custom function.
 * @param name The name of the function.
 * @returns
 */
async function getCustomFunctionLocation(name) {
    const all = await (0, _1.getFunctions)();
    const fn = all.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!fn?.location)
        return;
    return new vscode.Location(vscode.Uri.file(fn.location.file), fn.location.position);
}
function extractCustomFunctions(text, fileName) {
    const kind = fileName.endsWith(".ts") || fileName.endsWith(".tsx")
        ? typescript_1.default.ScriptKind.TS
        : fileName.endsWith(".jsx")
            ? typescript_1.default.ScriptKind.JSX
            : typescript_1.default.ScriptKind.JS;
    const sf = typescript_1.default.createSourceFile(fileName, text, typescript_1.default.ScriptTarget.Latest, true, kind);
    const bindings = collectBindings(sf);
    const found = [];
    const pushResolved = (expr) => {
        const resolved = resolveMetadataExpressions(expr, bindings);
        for (const meta of resolved) {
            const target = unwrapExpression(expr);
            const { line, character } = sf.getLineAndCharacterOfPosition(target.getStart());
            meta.location = {
                file: fileName,
                position: new vscode.Position(line, character)
            };
            found.push(meta);
        }
    };
    function visit(node) {
        // export default ...
        if (typescript_1.default.isExportAssignment(node))
            pushResolved(node.expression);
        // module.exports = ...
        if (typescript_1.default.isBinaryExpression(node) && node.operatorToken.kind === typescript_1.default.SyntaxKind.EqualsToken) {
            const leftChain = getPropertyChain(node.left);
            if (!leftChain)
                return;
            const isModuleExports = leftChain[0] === "module" && leftChain[1] === "exports";
            const isExportsDefault = leftChain[0] === "exports" && leftChain[1] === "default";
            if (isModuleExports || isExportsDefault)
                pushResolved(node.right);
        }
        typescript_1.default.forEachChild(node, visit);
    }
    visit(sf);
    const unique = new Map();
    for (const fn of found)
        unique.set(fn.name.toLowerCase(), fn);
    return [...unique.values()];
}
/**
 * Returns whether the input is an absolute path.
 * @param p The path to check.
 * @returns
 */
function isAbsolutePath(p) {
    return /^(?:[a-zA-Z]:[\\/]|\/)/.test(p);
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
    if (isAbsolutePath(p))
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
    customFunctionsPath = (0, _1.toArray)(customFunctionsPath);
    if (!customFunctionsPath.length)
        return [];
    const meta = [];
    for (const p of customFunctionsPath) {
        const dirUri = resolveWorkspacePath(p);
        if (!dirUri)
            continue;
        const files = await collectFiles(dirUri);
        for (const file of files) {
            const buf = await vscode.workspace.fs.readFile(file);
            const text = new TextDecoder().decode(buf);
            meta.push(...extractCustomFunctions(text, file.path));
        }
    }
    return meta;
}
//# sourceMappingURL=functions.js.map