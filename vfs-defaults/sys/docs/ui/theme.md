# Theming & Icons

Fluxide manages dynamic UI themes and icon packs (used in the tree view and tabs).

### `fluxide.theme.getIcon(id)`
Returns the raw SVG string for a core UI icon from the active Icon Pack.
```javascript
const closeSvg = fluxide.theme.getIcon('close');
```

### `fluxide.theme.getFileIconHtml(filename)`
Returns the SVG string representing the specific file extension from the active Icon Pack.
```javascript
const jsIcon = fluxide.theme.getFileIconHtml('main.js');
```

### `fluxide.theme.getFolderIconHtml(foldername, isOpen)`
Returns the SVG string for a folder (either default or open state).

### `fluxide.theme.registerVariables(pluginId, vars)`
Injects custom CSS variables into the `:root` element. Useful if your plugin introduces new UI that needs theme-aware fallback colors.
```javascript
fluxide.theme.registerVariables('my_plugin', {
    '--my-custom-bg': '#ff0000'
});
```

### `fluxide.theme.applyTheme(themeId)`
Programmatically switches the editor to a new theme by parsing its `theme.json` and injecting the variables.