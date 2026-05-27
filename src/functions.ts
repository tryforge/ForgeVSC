import { ArgType, IMetadataArg, IMetadataFunction } from "./types"
import { getFunctions, toArray } from "."
import * as vscode from "vscode"
import ts from "typescript"

export type FunctionLocation = {
    file: string
    position: vscode.Position
}

export type ArgTypeKey = keyof typeof ArgType
export type CustomFunctionParamMetadata = IMetadataArg
export type CustomFunctionMetadata = Omit<IMetadataFunction, "category" | "examples" | "version"> & {
    firstParamCondition?: boolean
    location?: FunctionLocation
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

function getEnumName(node: ts.Expression) {
    node = unwrapExpression(node)
    if (ts.isIdentifier(node)) return node.text
    if (ts.isPropertyAccessExpression(node)) return node.name.text
    return undefined
}

function resolveArgType(node: ts.Expression) {
    if (ts.isPropertyAccessExpression(node)) {
        if (ts.isIdentifier(node.expression) && node.expression.text === "ArgType") {
            return node.name.text
        }
        return node.name.text
    }

    if (ts.isIdentifier(node)) return node.text
    if (ts.isStringLiteral(node)) return node.text

    return undefined
}

function parseArgType(node: ts.Expression) {
    const key = resolveArgType(node)
    if (!key) return undefined

    return (key in ArgType) ? (key as ArgTypeKey) : undefined
}

function normalizeParam(partial: Partial<CustomFunctionParamMetadata>) {
    if (!partial.name) return undefined
    let param = {} as CustomFunctionParamMetadata

    param.name = partial.name
    param.type = partial.type ?? DefaultParam.type
    param.required = partial.required ?? DefaultParam.required
    param.rest = partial.rest ?? DefaultParam.rest
    param.description = partial.description ?? DefaultParam.description

    if (partial.enum) param.enum = partial.enum
    if (partial.enumName) param.enumName = partial.enumName
    if (partial.pointer) param.pointer = partial.pointer
    if (partial.pointerProperty) param.pointerProperty = partial.pointerProperty
    if (partial.condition) param.condition = partial.condition
    if (partial.delimiter) param.delimiter = partial.delimiter

    return param
}

function getArgCall(node: ts.CallExpression) {
    if (!ts.isPropertyAccessExpression(node.expression)) return undefined

    const access = node.expression
    if (!ts.isIdentifier(access.expression) || access.expression.text !== "Arg")
        return undefined

    const method = access.name.text
    const match = method.match(/^(optional|required|rest)(.+)$/)
    if (!match) return undefined

    const [, mode, rawType] = match
    let type = rawType as ArgTypeKey

    const param: Partial<CustomFunctionParamMetadata> = {
        required: mode === "required",
        rest: mode === "rest",
        type
    }

    let offset = 0
    if (type === "Enum") {
        offset = 1
        param.enumName = getEnumName(node.arguments[0])
    }

    const name = node.arguments[offset]
    param.name = name && ts.isStringLiteral(name) ? name.text : undefined

    const desc = node.arguments[offset + 1]
    param.description = desc && ts.isStringLiteral(desc) ? desc.text : DefaultParam.description

    if (mode === "rest") {
        const req = node.arguments[offset + 2]
        const required = req && getBoolean(req)
        if (required !== undefined) param.required = required
    }

    switch (type) {
        case "GuildEmoji":
            param.pointer = 0
            break

        case "Reaction":
            param.pointer = 1
            break

        case "RoleOrUser":
            param.pointer = 0
            param.pointerProperty = "guild"
            break
    }

    return normalizeParam(param)
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
        else if (key === "condition") param.condition = getBoolean(prop.initializer)
        else if (key === "description") param.description = getString(prop.initializer)
        else if (key === "enum") param.enumName = getEnumName(prop.initializer)
    }

    return normalizeParam(param)
}

function getParam(el: ts.Expression) {
    if (ts.isStringLiteral(el)) return normalizeParam({ name: el.text })
    if (ts.isCallExpression(el)) {
        const arg = getArgCall(el)
        if (arg) return arg
    }
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
    const out: ArgTypeKey[] = []
    const add = (expr: ts.Expression) => {
        const value = parseArgType(expr)
        if (value) out.push(value)
    }

    if (ts.isArrayLiteralExpression(node)) {
        for (const el of node.elements) add(el)
    } else add(node)

    return out.length ? out : undefined
}

function getPropertyKey(name: ts.PropertyName) {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name))
        return name.text
    return undefined
}

function readMetadata(obj: ts.ObjectLiteralExpression) {
    let fn: Partial<CustomFunctionMetadata> = {}

    for (const prop of obj.properties) {
        if (!ts.isPropertyAssignment(prop)) continue

        const key = getPropertyKey(prop.name)
        if (!key) continue

        if (key === "name") {
            const name = getString(prop.initializer)
            if (name) fn.name = (name.startsWith("$") ? name : "$" + name) as `$${string}`
        }
        else if (key === "params" || key === "args") fn.args = getParams(prop.initializer)
        else if (key === "brackets") fn.brackets = getBoolean(prop.initializer)
        else if (key === "unwrap") fn.unwrap = getBoolean(prop.initializer)
        else if (key === "output") fn.output = getOutput(prop.initializer)
        else if (key === "description") fn.description = getString(prop.initializer)
        else if (key === "deprecated") fn.deprecated = getBoolean(prop.initializer)
        else if (key === "experimental") fn.experimental = getBoolean(prop.initializer)
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

function getPropertyChain(node: ts.Expression) {
    let current = node
    const parts = []

    while (ts.isPropertyAccessExpression(current)) {
        parts.unshift(current.name.text)
        current = current.expression
    }

    if (ts.isIdentifier(current)) {
        parts.unshift(current.text)
        return parts
    }

    return undefined
}

/**
 * Returns the location of a custom function.
 * @param name The name of the function.
 * @returns 
 */
export async function getCustomFunctionLocation(name: string) {
    const all = await getFunctions()
    const fn = all.find((x) => x.name.toLowerCase() === name.toLowerCase())
    if (!fn?.location) return

    return new vscode.Location(vscode.Uri.file(fn.location.file), fn.location.position)
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

    const pushResolved = (expr: ts.Expression) => {
        const resolved = resolveMetadataExpressions(expr, bindings)

        for (const meta of resolved) {
            const target = unwrapExpression(expr)
            const { line, character } = sf.getLineAndCharacterOfPosition(target.getStart())

            meta.location = {
                file: fileName,
                position: new vscode.Position(line, character)
            }

            found.push(meta)
        }
    }

    function visit(node: ts.Node) {
        // export default ...
        if (ts.isExportAssignment(node)) pushResolved(node.expression)

        // module.exports = ...
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            const leftChain = getPropertyChain(node.left)
            if (!leftChain) return

            const isModuleExports = leftChain[0] === "module" && leftChain[1] === "exports"
            const isExportsDefault = leftChain[0] === "exports" && leftChain[1] === "default"

            if (isModuleExports || isExportsDefault) pushResolved(node.right)
        }

        ts.forEachChild(node, visit)
    }

    visit(sf)

    const unique = new Map<string, CustomFunctionMetadata>()
    for (const fn of found) unique.set(fn.name.toLowerCase(), fn)

    return [...unique.values()]
}

/**
 * Returns whether the input is an absolute path.
 * @param p The path to check.
 * @returns 
 */
function isAbsolutePath(p: string) {
    return /^(?:[a-zA-Z]:[\\/]|\/)/.test(p)
}

/**
 * Resolves the workspace path.
 * @param p The path to resolve.
 * @returns 
 */
function resolveWorkspacePath(p: string) {
    const folders = vscode.workspace.workspaceFolders
    if (!folders?.length) return null
    if (isAbsolutePath(p)) return vscode.Uri.file(p)

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
export async function loadCustomFunctions(customFunctionsPath: string | string[]) {
    customFunctionsPath = toArray(customFunctionsPath)
    if (!customFunctionsPath.length) return []

    const meta: CustomFunctionMetadata[] = []
    for (const p of customFunctionsPath) {
        const dirUri = resolveWorkspacePath(p)
        if (!dirUri) continue

        const files = await collectFiles(dirUri)

        for (const file of files) {
            const buf = await vscode.workspace.fs.readFile(file)
            const text = new TextDecoder().decode(buf)
            meta.push(...extractCustomFunctions(text, file.path))
        }
    }

    return meta
}