# Change Log

## v1.2.5 <sub>(June 04, 2026)</sub>

### Added
- Added Discord RPC, manageable in extension settings

### Changed
- Disabled most features for code inside `$escapeCode[]`

### Fixed
- Fixed guides tab causing error in web when no workspace folder is open

## v1.2.4 <sub>(May 30, 2026)</sub>

### Added
- Added highlighting to condition operators
- Added information message for refreshing function metadata

## v1.2.3 <sub>(May 27, 2026)</sub>

### Added
- Added support for NativeFunction class
- Added regex validation pattern for hex inputs in config settings

## v1.2.2 <sub>(May 25, 2026)</sub>

### Added
- Added string localization

## v1.2.1 <sub>(May 09, 2026)</sub>

### Added
- Added comment highlighting to `$c[]`
- Added quick pick options for opening extension settings via command
- Added resolved package names to extension logs

## v1.2.0 <sub>(April 16, 2026)</sub>

### Added
- Added advanced guide search
- Added extension settings
- Added ability to enable/disable the extension for specific workspaces
- Added "**ForgeVSC: Open Extension Settings**" command

### Changed
- Renamed config property "customFunctionsPath" to `customFunctionPaths`

### Fixed
- Fixed code still highlighted inside JavaScript comments

### Deprecated
- Deprecated `.forgevsc.json` config file (replaced by extension settings)\
    <sub>This file remains supported for compatibility, but is legacy. Extension settings are recommended instead.</sub>

## v1.1.0 <sub>(April 07, 2026)</sub>

### Added
- Added extension support for web code editors

## v1.0.3 <sub>(March 29, 2026)</sub>

### Added
- Added diagnostic warning to deprecated functions
- Added diagnostic hint to experimental functions
- Added validating all files on first activation

### Fixed
- Fixed decorations not applying to all visible editors

## v1.0.2 <sub>(March 26, 2026)</sub>

### Added
- Added definition ("go to file") for custom functions *(`Ctrl+Click`/`Cmd+Click`)*
- Added JavaScript code highlighting to `$djsEval[]`
- Added escaping support for whole function call
- Added support for config file inside `.vscode` folder

### Fixed
- Potential fix for custom functions not registering on first activation

## v1.0.1 <sub>(March 23, 2026)</sub>

### Added
- Added package icon to status bar item
- Added category specific icons for functions, events and enums to guides sidebar
- Added possibility to specify multiple paths for custom functions

### Changed
- Changed status bar item to open extension log instead of extension page

## v1.0.0 <sub>(March 22, 2026)</sub>

- Release