import { ArgType, IForgeFunction, IForgeFunctionParam } from "@tryforge/forgescript"
import * as vscode from "vscode"
import * as path from "path"
import ts from "typescript"

export type ArgTypeKey = keyof typeof ArgType
export type CustomFunctionParamMetadata = Omit<IForgeFunctionParam, "type"> & {
    type: ArgTypeKey
    description: string
}
export type CustomFunctionMetadata = Omit<IForgeFunction, "code" | "params"> & {
    args?: CustomFunctionParamMetadata[]
    output?: Array<ArgTypeKey>
    unwrap: boolean
    description: string
}

export const DefaultParam: Omit<CustomFunctionParamMetadata, "name"> = {
    type: "String",
    required: true,
    rest: false,
    description: "Custom function param",
}

function getString(node: ts.Expression) {
    if (ts.isStringLiteral(node)) return node.text
    if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text
    return undefined
}

function getBoolean(node: ts.Expression) {
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false
    return undefined
}

function parseArgType(node: ts.Expression) {
    if (ts.isNumericLiteral(node)) {
        const n = Number(node.text)
        const key = ArgType[n] as unknown
        return (typeof key === "string" && key in ArgType) ? (key as ArgTypeKey) : undefined
    }

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isIdentifier(node)) {
        const key = node.text
        return (key in ArgType) ? (key as ArgTypeKey) : undefined
    }

    return undefined
}

function normalizeParam(partial: Partial<CustomFunctionParamMetadata>) {
    if (!partial.name) return undefined
    return {
        name: partial.name,
        type: partial.type ?? DefaultParam.type,
        required: partial.required ?? DefaultParam.required,
        rest: partial.rest ?? DefaultParam.rest,
        description: partial.description ?? DefaultParam.description,
    }
}

function getParamObject(node: ts.Expression) {
    if (!ts.isObjectLiteralExpression(node)) return undefined
    let param: Partial<CustomFunctionParamMetadata> = {}

    for (const prop of node.properties) {
        if (!ts.isPropertyAssignment(prop)) continue
        if (!ts.isIdentifier(prop.name) && !ts.isStringLiteral(prop.name)) continue
        const key = ts.isIdentifier(prop.name) ? prop.name.text : prop.name.text

        if (key === "name") param.name = getString(prop.initializer)
        else if (key === "type") param.type = parseArgType(prop.initializer) ?? "String"
        else if (key === "required") param.required = getBoolean(prop.initializer)
        else if (key === "rest") param.rest = getBoolean(prop.initializer)
        else if (key === "description") param.description = getString(prop.initializer)
    }

    return normalizeParam(param)
}

function getParam(el: ts.Expression) {
    if (ts.isStringLiteral(el)) return normalizeParam({ name: el.text })
    return getParamObject(el)
}

function getParams(node: ts.Expression) {
    if (!ts.isArrayLiteralExpression(node)) return undefined
    const args: CustomFunctionParamMetadata[] = []

    for (const el of node.elements) {
        const param = getParam(el)
        if (!param) return undefined
        args.push(param)
    }

    return args
}

function getOutput(node: ts.Expression) {
    const checkLiteral = (expr: ts.Expression) =>
        ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr) || ts.isNumericLiteral(expr)

    if (checkLiteral(node)) {
        const type = parseArgType(node)
        return type ? [type] : undefined
    }

    if (ts.isArrayLiteralExpression(node)) {
        const out: ArgTypeKey[] = []
        for (const el of node.elements) {
            if (checkLiteral(el)) {
                const type = parseArgType(node)
                if (type) out.push(type)
            }
        }
        return out.length ? out : undefined
    }

    return undefined
}

function readMetadata(obj: ts.ObjectLiteralExpression) {
    let fn: Partial<CustomFunctionMetadata> = {}

    for (const prop of obj.properties) {
        if (!ts.isPropertyAssignment(prop)) continue
        const key = prop.name && ts.isIdentifier(prop.name) ? prop.name.text : undefined
        if (!key) continue

        if (key === "name") fn.name = "$" + getString(prop.initializer)
        else if (key === "params") fn.args = getParams(prop.initializer)
        else if (key === "brackets") fn.brackets = getBoolean(prop.initializer)
        else if (key === "output") fn.output = getOutput(prop.initializer)
        else if (key === "description") fn.description = getString(prop.initializer)
    }

    if (!fn.name) return null
    if (fn.unwrap === undefined) fn.unwrap = (!!fn.args?.length && !fn.firstParamCondition)
    if (fn.brackets === undefined) fn.brackets = (fn.args?.length ? true : undefined)
    if (fn.description === undefined) fn.description = "Custom function"

    return fn as CustomFunctionMetadata
}

function extractCustomFunctions(text: string, fileName: string) {
    const kind = fileName.endsWith(".ts") || fileName.endsWith(".tsx")
        ? ts.ScriptKind.TS
        : fileName.endsWith(".jsx")
            ? ts.ScriptKind.JSX
            : ts.ScriptKind.JS

    const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind)
    const found: CustomFunctionMetadata[] = []

    function visit(node: ts.Node) {
        // export default new ForgeFunction({ ... })
        if (ts.isExportAssignment(node)) {
            const expr = node.expression
            if (ts.isNewExpression(expr) && expr.arguments?.length) {
                const arg0 = expr.arguments[0]
                if (ts.isObjectLiteralExpression(arg0)) {
                    const meta = readMetadata(arg0)
                    if (meta) found.push(meta)
                }
            }
            // export default { ... }
            if (ts.isObjectLiteralExpression(expr)) {
                const meta = readMetadata(expr)
                if (meta) found.push(meta)
            }
        }

        // module.exports = { ... }
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            const left = node.left
            const right = node.right

            const isModuleExports = ts.isPropertyAccessExpression(left) && ts.isIdentifier(left.expression)
                && left.expression.text === "module" && left.name.text === "exports"

            if (isModuleExports && ts.isObjectLiteralExpression(right)) {
                const meta = readMetadata(right)
                if (meta) found.push(meta)
            }
        }

        ts.forEachChild(node, visit)
    }

    visit(sf)
    return found
}

/**
 * Resolves the workspace path.
 * @param p The path to resolve.
 * @returns 
 */
function resolveWorkspacePath(p: string) {
    const folders = vscode.workspace.workspaceFolders
    if (!folders?.length) return null
    if (path.isAbsolute(p)) return vscode.Uri.file(p)

    return vscode.Uri.joinPath(folders[0].uri, p)
}

/**
 * Reads the directory safely.
 * @param uri The directory uri.
 * @returns 
 */
async function safeReadDirectory(uri: vscode.Uri) {
    try {
        return await vscode.workspace.fs.readDirectory(uri)
    } catch (e: any) {
        if (e?.code === "FileNotFound" || e?.code === "ENOENT") return []
        throw e
    }
}

/**
 * Collects all files from the custom functions folder.
 * @param dir The directory uri.
 * @param out 
 * @returns 
 */
async function collectFiles(dir: vscode.Uri, out: vscode.Uri[] = []) {
    const entries = await safeReadDirectory(dir)
    for (const [name, type] of entries) {
        const uri = vscode.Uri.joinPath(dir, name)
        if (type === vscode.FileType.Directory) await collectFiles(uri, out)
        else if (/\.(ts|js|tsx|jsx)$/.test(name)) out.push(uri)
    }

    return out
}

/**
 * Returns the metadata of all custom functions.
 * @param customFunctionsPath The custom functions folder path.
 * @returns 
 */
export async function loadCustomFunctions(customFunctionsPath: string) {
    if (!customFunctionsPath) return []

    const dirUri = resolveWorkspacePath(customFunctionsPath)
    if (!dirUri) return []

    const files = await collectFiles(dirUri)
    const meta: CustomFunctionMetadata[] = []

    for (const file of files) {
        const buf = await vscode.workspace.fs.readFile(file)
        const text = Buffer.from(buf).toString("utf8")
        meta.push(...extractCustomFunctions(text, file.fsPath))
    }

    return meta
}