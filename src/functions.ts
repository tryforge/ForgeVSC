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
                const type = parseArgType(el)
                if (type) out.push(type)
            }
        }
        return out.length ? out : undefined
    }

    return undefined
}

function getPropertyKey(name: ts.PropertyName) {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
        return name.text
    }

    return undefined
}

function readMetadata(obj: ts.ObjectLiteralExpression) {
    let fn: Partial<CustomFunctionMetadata> = {}

    for (const prop of obj.properties) {
        if (!ts.isPropertyAssignment(prop)) continue

        const key = getPropertyKey(prop.name)
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

function collectBindings(sf: ts.SourceFile) {
    const bindings = new Map<string, ts.Expression>()

    for (const stmt of sf.statements) {
        if (!ts.isVariableStatement(stmt)) continue

        for (const decl of stmt.declarationList.declarations) {
            if (!ts.isIdentifier(decl.name) || !decl.initializer) continue
            bindings.set(decl.name.text, decl.initializer)
        }
    }

    return bindings
}

function unwrapExpression(node: ts.Expression) {
    let current = node

    while (true) {
        if (ts.isParenthesizedExpression(current)) {
            current = current.expression
            continue
        }

        if (ts.isAsExpression(current)) {
            current = current.expression
            continue
        }

        if (ts.isSatisfiesExpression(current)) {
            current = current.expression
            continue
        }

        if (ts.isNonNullExpression(current)) {
            current = current.expression
            continue
        }

        return current
    }
}

function resolveMetadataExpressions(
    node: ts.Expression,
    bindings: Map<string, ts.Expression>,
    seen = new Set<string>()
): CustomFunctionMetadata[] {
    const expr = unwrapExpression(node)

    // { ... }
    if (ts.isObjectLiteralExpression(expr)) {
        const meta = readMetadata(expr)
        return meta ? [meta] : []
    }

    // new ForgeFunction({ ... })
    if (ts.isNewExpression(expr) && expr.arguments?.length) {
        const arg0 = unwrapExpression(expr.arguments[0])
        if (ts.isObjectLiteralExpression(arg0)) {
            const meta = readMetadata(arg0)
            return meta ? [meta] : []
        }
    }

    // [ ... ]
    if (ts.isArrayLiteralExpression(expr)) {
        const out: CustomFunctionMetadata[] = []

        for (const el of expr.elements) {
            if (ts.isSpreadElement(el)) {
                out.push(...resolveMetadataExpressions(el.expression, bindings, seen))
                continue
            }

            out.push(...resolveMetadataExpressions(el, bindings, seen))
        }

        return out
    }

    // Identifier
    if (ts.isIdentifier(expr)) {
        const name = expr.text
        if (seen.has(name)) return []

        const init = bindings.get(name)
        if (!init) return []

        seen.add(name)
        const out = resolveMetadataExpressions(init, bindings, seen)
        seen.delete(name)

        return out
    }

    return []
}

function extractCustomFunctions(text: string, fileName: string) {
    const kind = fileName.endsWith(".ts") || fileName.endsWith(".tsx")
        ? ts.ScriptKind.TS
        : fileName.endsWith(".jsx")
            ? ts.ScriptKind.JSX
            : ts.ScriptKind.JS

    const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind)
    const bindings = collectBindings(sf)
    const found: CustomFunctionMetadata[] = []

    const pushResolved = (expr: ts.Expression) =>
        found.push(...resolveMetadataExpressions(expr, bindings))

    function visit(node: ts.Node) {
        // export default ...
        if (ts.isExportAssignment(node)) pushResolved(node.expression)

        // module.exports = ...
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            const left = unwrapExpression(node.left)
            const right = node.right

            const check = ts.isPropertyAccessExpression(left) && ts.isIdentifier(left.expression)
            const isModuleExports = check && left.expression.text === "module" && left.name.text === "exports"
            const isExportsDefault = check && left.expression.text === "exports" && left.name.text === "default"

            if (isModuleExports || isExportsDefault) pushResolved(right)
        }

        ts.forEachChild(node, visit)
    }

    visit(sf)

    const unique = new Map<string, CustomFunctionMetadata>()
    for (const fn of found) unique.set(fn.name.toLowerCase(), fn)

    return [...unique.values()]
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