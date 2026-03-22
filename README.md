<div align="center">

<img height="150" width="150" src="https://raw.githubusercontent.com/tryforge/ForgeVSC/main/assets/ForgeScript.png" alt="ForgeVSC">

# ForgeVSC
Official Visual Studio Code Extension for ForgeScript.

<a href="https://github.com/tryforge/ForgeVSC/"><img src="https://img.shields.io/github/package-json/v/tryforge/ForgeVSC/main?label=ForgeVSC&color=5c16d4" alt="ForgeVSC"></a>
<a href="https://marketplace.visualstudio.com/items?itemName=tryforge.forgevsc"><img src="https://img.shields.io/visual-studio-marketplace/v/tryforge.forgevsc?label=VSC+Marketplace&color=5c16d4" alt="VSC Marketplace"></a>
<a href="https://open-vsx.org/extension/tryforge/forgevsc"><img src="https://img.shields.io/open-vsx/v/tryforge/forgevsc?label=OpenVSX+Marketplace&color=5c16d4 " alt="OpenVSX Marketplace"></a>
<a href="https://github.com/tryforge/ForgeScript/"><img src="https://img.shields.io/github/package-json/v/tryforge/ForgeScript/main?label=@tryforge/forgescript&color=5c16d4" alt="@tryforge/forgescript"></a>
<a href="https://discord.gg/hcJgjzPvqb"><img src="https://img.shields.io/discord/997899472610795580?logo=discord" alt="Discord"></a>

---

ForgeVSC brings a much better development experience to ForgeScript inside Visual Studio Code. It adds rich editor tooling for writing Forge code in JavaScript, TypeScript, JSX, and TSX, while also providing a dedicated guides sidebar, diagnostics, hover info, suggestions, syntax highlighting, and more!

</div>

## Features
- [Syntax Highlighting](#syntax-highlighting)
- [Autocompletions](#autocompletions)
- [Diagnostics](#diagnostics)
- [Hover Info](#hover-info)
- [Signature Help](#signature-help)
- [Guides Sidebar](#guides-sidebar)
- [Folding Support](#folding-support)
- [Inline Bracket Suggestions](#inline-bracket-suggestions)

---

### Configuration
You can configure the setup of ForgeVSC by placing a `.forgevsc.json` file inside your workspace root. This config file can be easily generated using the "**ForgeVSC: Create config file**" command.

> ℹ️ **Note**\
> Installed Forge packages are detected automatically. This file may only be needed if metadata fetching fails or you want to change some of the configurations among all various options.

<img src="https://raw.githubusercontent.com/tryforge/ForgeVSC/main/assets/examples/config.png" draggable=false>

> 💡 **Tip**\
> For more info about an option simply hover over the property key to view a brief description. All properties are optional and can be completely omitted.

---

### Syntax Highlighting
ForgeVSC adds full syntax highlighting support for registered functions. These decorations make Forge code much easier to read visually, especially in larger projects.  

<img src="https://raw.githubusercontent.com/tryforge/ForgeVSC/main/assets/examples/highlights.png" draggable=false>

> 💡 **Tip**\
> The colors are configurable through the `.forgevsc.json` config file.

---

### Autocompletions
This extension provides autocompletion for Forge functions and enum values while you type. This makes it much easier to discover functions, learn aliases, and write code faster with fewer mistakes.

<img src="https://raw.githubusercontent.com/tryforge/ForgeVSC/main/assets/examples/autocompletions.gif" draggable=false>

---

### Diagnostics
Diagnostics validate your Forge code in real-time and report issues directly inside the editor. This helps catching mistakes early while writing rather than during or after runtime.

<img src="https://raw.githubusercontent.com/tryforge/ForgeVSC/main/assets/examples/diagnostics.png" draggable=false>

---

### Hover Info
Shows detailed information when hovering over a function or operator. It also contains useful resources such as links to the source code, documentation, or [guide preview](#guides-sidebar).

<img src="https://raw.githubusercontent.com/tryforge/ForgeVSC/main/assets/examples/hover.gif" draggable=false>

---

### Signature Help
Displays function signatures while typing arguments. This is especially useful for keeping track of the current argument and for larger functions with many parameters.

<img src="https://raw.githubusercontent.com/tryforge/ForgeVSC/main/assets/examples/signature.gif" draggable=false>

---

### Guides Sidebar
This extension adds built-in support for previewing approved guides from any package. The **Guides** sidebar lets you browse through all guides directly inside Visual Studio Code!

You can also favorite guides to access them quickly from the dedicated **Favorites** section in the "Guides" tab.

<img src="https://raw.githubusercontent.com/tryforge/ForgeVSC/main/assets/examples/guides.png" draggable=false>

---

### Folding Support
ForgeVSC supports folding/collapsing for multiline function contents so large blocks stay manageable.

<img src="https://raw.githubusercontent.com/tryforge/ForgeVSC/main/assets/examples/folding.gif" draggable=false>

---

### Inline Bracket Suggestions
Automatically suggests and inserts missing brackets while typing.

When a function accepts brackets, ForgeVSC will suggest `[]` automatically. It also suggests missing closing brackets `]` when you are inside an unfinished function call.

Simply press `TAB` to accept those suggestions.

<img src="https://raw.githubusercontent.com/tryforge/ForgeVSC/main/assets/examples/suggestions.gif" draggable=false>

---

## License

[LGPL-3.0-or-later](https://github.com/tryforge/ForgeVSC/blob/main/LICENSE)