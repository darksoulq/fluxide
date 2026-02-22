# Theme Engine

The Theme Engine dynamically manipulates CSS variables and manages a unified Icon Engine capable of resolving path-based SVG injections.

## Styling Management

### `fluxide.theme.registerVariables(pluginId, vars)`

Permits a plugin to mount custom layout properties into the active system stylesheet.

```javascript
fluxide.theme.registerVariables('my_plugin', {
	'--custom-bg': 'var(--surface-low)',
	'--custom-border': 'var(--accent)'
});
```

### `fluxide.theme.injectCSS(id, cssString)`

Safely attaches an isolated, dynamic standard stylesheet to the application's document head.

```javascript
fluxide.theme.injectCSS('my-styles', '.my-class { display: flex; color: white; }');
```

## The Icon Engine

### `fluxide.theme.registerIconPack(id, name, iconsObject)`

Registers an entire dictionary of SVG literal definitions, making it available as a selectable System Preference.

### `fluxide.theme.registerFileIcon(extension, iconId)`

Maps a specific file extension dynamically to an actively loaded SVG definition.

```javascript
fluxide.theme.registerFileIcon('ts', 'js');
```

### `fluxide.theme.registerNameIcon(filename, iconId)`

Forces a strict icon map that prioritizes exact string patterns over standard extensions.

```javascript
fluxide.theme.registerNameIcon('package.json', 'json');
```

### `fluxide.theme.getIcon(iconId)`

Returns the literal SVG string for a targeted identifier, applying safe fallback handling to prevent layout breaks.

### `fluxide.theme.getFileIconHtml(filename)`

Evaluates a raw filename via the internal resolution logic and returns the accurately mapped SVG string.

### `fluxide.theme.getFolderIconHtml(foldername, isOpen)`

Evaluates directory states and fetches respective folder SVG trees based on custom name definitions or fallbacks.