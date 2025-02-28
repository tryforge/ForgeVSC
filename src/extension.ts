import * as vscode from "vscode"

export function activate(context: vscode.ExtensionContext) {
	let provider = vscode.languages.registerCompletionItemProvider({ scheme: "file", language: "javascript" },{
		async provideCompletionItems(document, position) {
			console.log("🚀 Forge Autocomplete Extension Activated!")

			const linePrefix = document.lineAt(position).text.substring(0, position.character)
			if (!linePrefix.endsWith("$")) return undefined
			
			console.log("🔄 Fetching functions...")
			const functions = await fetchForgeFunctions()
			if (!functions || functions.length === 0) return undefined

			console.log(`✅ Found ${functions.length} functions`)
			
			return functions.map(func => {
				const item = new vscode.CompletionItem(func.name, vscode.CompletionItemKind.Function)
				item.insertText = func.brackets ? `${func.name}[]` : func.name
				item.detail = `v${func.version} - ${func.category}`
				item.documentation = new vscode.MarkdownString(`**${func.name}**\n\n${func.description}\n\n**Args:**\n${formatArgs(func.args)}`)
				return item
			})
		},
	},
    "$")
	
	context.subscriptions.push(provider)
}

async function fetchForgeFunctions(): Promise<{
	name: string
	version: string
	description: string
	brackets: boolean
	category: string
	args: any[]
}[]> {
	try {
		const config = vscode.workspace.getConfiguration("Autocomplete")
		const functionsURL = config.get<string>("functionsURL")

		console.log("📡 Fetching functions from:", functionsURL)
		
		if (!functionsURL) {
			vscode.window.showErrorMessage("Functions metadata URL is not configured.")
			return []
		}
		
		const response = await fetch(functionsURL, {
			headers: { "Accept": "application/vnd.github.v3.raw" }
		})

		console.log("🔄 Response status:", response.status)
		
		if (!response.ok) {
			vscode.window.showErrorMessage(`Failed to fetch metadata: ${response.statusText}`)
			return []
		}
		
		const data = await response.json()
		console.log("✅ Fetched data:", data)
		
		return (Array.isArray(data) ? data : []).map(func => ({
			name: func.name,
			version: func.version,
			description: func.description,
			brackets: func.brackets,
			category: func.category,
			args: func.args || [],
		}))
	} catch (error) {
		vscode.window.showErrorMessage("Error fetching functions: " + error)
		return []
	}
}

function formatArgs(args: any[]): string {
	if (!args || args.length === 0) return "_No arguments_"
	return args.map(arg => `- **${arg.name}** (${arg.type}) - ${arg.description}`).join("\n")
}

export function deactivate() {}