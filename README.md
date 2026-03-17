<div align="center">

<img height="150" width="150" src="https://raw.githubusercontent.com/tryforge/ForgeVSC/main/assets/ForgeScript.png" alt="ForgeVSC">

# ForgeVSC
Official Visual Studio Code Extension for ForgeScript.

<a href="https://github.com/tryforge/ForgeVSC/"><img src="https://img.shields.io/github/package-json/v/tryforge/ForgeVSC/main?label=@tryforge/forge.vsc&color=5c16d4" alt="@tryforge/forge.vsc"></a>
<a href="https://github.com/tryforge/ForgeScript/"><img src="https://img.shields.io/github/package-json/v/tryforge/ForgeScript/main?label=@tryforge/forgescript&color=5c16d4" alt="@tryforge/forgescript"></a>
<a href="https://discord.gg/hcJgjzPvqb"><img src="https://img.shields.io/discord/997899472610795580?logo=discord" alt="Discord"></a>

</div>

---

ForgeVSC brings a much better development experience to ForgeScript inside Visual Studio Code. It adds rich editor tooling for writing Forge code in JavaScript, TypeScript, JSX, and TSX, while also providing a dedicated guides sidebar, diagnostics, hover cards, suggestions, syntax highlighting, and more!

> **Supported environments**
>
> - JavaScript
> - TypeScript
> - JavaScript React
> - TypeScript React

---

## Features

### Autocompletions
ForgeVSC provides autocompletion for Forge functions while you type. It also supports enum value suggestions and boolean suggestions for matching arguments when available.

This makes it much easier to discover functions, learn aliases, and write code faster with fewer mistakes.

<!-- IMAGE: Autocompletion popup showing Forge functions and enum argument suggestions -->

---

### Inline Bracket Suggestions
When a function supports brackets, ForgeVSC will suggest `[]` automatically. It also suggests missing closing brackets `]` when you are inside an unfinished function call.

This keeps writing nested Forge functions much smoother and reduces small syntax interruptions.

<!-- IMAGE: Inline suggestion showing [] being inserted after a function name -->
<!-- IMAGE: Inline suggestion showing a missing closing ] -->

---

### Signature Help for Arguments
As soon as you open a function bracket or move between arguments with `;`, ForgeVSC shows signature help for the active function.

This is especially useful for larger functions with many parameters.

<!-- IMAGE: Signature help card for a multi-argument Forge function -->

---

### Hover Info for Functions and Operators
Hover over a Forge function to see a rich hover card with:

ForgeVSC also supports hover cards for operators like:
- `!` Negation
- `#` Silent
- `@[x]` Count

That means both functions and operator chains are easier to understand directly in the editor.

<!-- IMAGE: Function hover card with usage, description, version, and links -->
<!-- IMAGE: Operator hover card for !, #, or @[.] -->

---

### Diagnostics and Validation
ForgeVSC validates Forge functions in your code and reports issues directly inside the editor.

It can detect:
- missing required brackets
- missing closing brackets
- missing required arguments
- too many arguments
- invalid operator order
- duplicated operators

This helps catch mistakes early while writing rather than after runtime.

<!-- IMAGE: Editor diagnostics showing invalid operator order -->
<!-- IMAGE: Editor diagnostics showing missing argument or missing brackets -->

---

### Syntax Highlighting
ForgeVSC highlights different parts of Forge functions with separate colors, including:
- function names
- dollar signs
- semicolons
- negation operator
- silent operator
- count operator
- count delimiter

These decorations make Forge code much easier to scan visually, especially in larger scripts.  
The colors are configurable through `.forgevsc.json`.

<!-- IMAGE: Code sample with full Forge syntax decorations enabled -->

---

### Folding for multiline function contents
ForgeVSC supports folding for multiline Forge function contents so large blocks stay manageable.

<!-- IMAGE: Folded multiline Forge function block in the editor -->

---

### Guides Sidebar
ForgeVSC includes a dedicated **Guides** activity bar view that lets you browse guides directly inside VS Code.

You can open and preview guides from inside the editor without leaving your workspace.

<!-- IMAGE: Guides activity bar icon and full guides tree view -->

---

### Guide Preview Support
Guides can be previewed in Markdown directly inside VS Code. This makes the extension feel like a built-in knowledge hub for ForgeScript development.

<!-- IMAGE: Opened guide preview inside the VS Code markdown preview -->

---

### Favorite Guides
You can favorite guides and access them quickly from the dedicated **Favorites** section in the Guides tab.

<!-- IMAGE: Favorites section in the guides tree with saved guides -->

---

### Guide Search and Refresh Commands
The guides view includes built-in commands for:
- searching guides
- refreshing guide metadata

This helps keep the guide experience fast and practical for daily use. :contentReference[oaicite:16]{index=16} 

<!-- IMAGE: Guides view title bar showing search and refresh actions -->

---

### Custom function metadata support
ForgeVSC can load metadata for your own custom functions from a workspace path you define.

This enables extension features like:
- autocompletion
- hover info
- diagnostics
- signature help

for your own custom functions, not just native ForgeScript functions.  
Supported source files include:
- `.ts`
- `.tsx`
- `.js`
- `.jsx` :contentReference[oaicite:18]{index=18} :contentReference[oaicite:19]{index=19}

<!-- IMAGE: Custom function source file next to editor support for that function -->
<!-- IMAGE: Hover/autocomplete working for a custom function -->

---

### Metadata fetching and package support
ForgeVSC fetches metadata for installed Forge packages and can merge it with your custom function metadata.

It also supports additional package configuration when needed, helping the extension work across more Forge setups. :contentReference[oaicite:20]{index=20} :contentReference[oaicite:21]{index=21}

<!-- IMAGE: Example workspace with multiple Forge packages / metadata-enabled functions -->

---

### Config file generation
ForgeVSC includes a command to generate a `.forgevsc.json` config file in your workspace.

This config can control:
- custom function path
- additional packages
- syntax decoration colors
- feature toggles for editor behavior

The extension also ships JSON schema validation for this config file. :contentReference[oaicite:22]{index=22} :contentReference[oaicite:23]{index=23} 

<!-- IMAGE: Command palette showing “Create config file (.forgevsc.json)” -->
<!-- IMAGE: Open .forgevsc.json with schema-based IntelliSense -->

---

### Configurable feature toggles
You can enable or disable individual extension features through config, including:
- folding
- hover info
- suggestions
- signature help
- diagnostics
- autocompletion

This lets you keep only the parts of the extension you want active. :contentReference[oaicite:25]{index=25} :contentReference[oaicite:26]{index=26}

<!-- IMAGE: .forgevsc.json showing feature toggles -->

---

### Customizable highlight colors
ForgeVSC allows configuring highlight colors for:
- function names
- dollar signs
- semicolons
- negation operator
- silent operator
- count operator
- count delimiter

That means the extension can better match your preferred editor theme or branding. :contentReference[oaicite:27]{index=27} :contentReference[oaicite:28]{index=28}

<!-- IMAGE: Side-by-side example of default colors vs customized colors -->

---

### Status bar version display
ForgeVSC displays its extension version in the status bar for quick visibility and easy access to extension details. :contentReference[oaicite:29]{index=29}

<!-- IMAGE: ForgeVSC version shown in the VS Code status bar -->

---

### Commands included
ForgeVSC ships with commands for:
- creating the config file
- fetching function and guide metadata
- searching guides
- refreshing guides
- opening guides
- previewing guides

These commands are integrated into the extension and guide workflow.  :contentReference[oaicite:31]{index=31}

<!-- IMAGE: Command palette showing ForgeVSC commands -->

---

## Example configuration

Create a `.forgevsc.json` file in your workspace root:

```json
{
  "customFunctionsPath": "./src/functions",
  "additionalPackages": [],
  "colors": {
    "function": {
      "name": "#ac75ff",
      "dollar": "#fe7ceb",
      "semicolon": "#c586c0"
    },
    "operators": {
      "negation": "#4FA3FF",
      "silent": "#FF9F43",
      "count": "#33D17A",
      "countDelimiter": "#76E3A0"
    }
  },
  "features": {
    "folding": true,
    "hoverInfo": true,
    "suggestions": true,
    "signatureHelp": true,
    "diagnostics": true,
    "autocompletion": true
  }
}