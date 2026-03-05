# Registry & Plugins

The Registry handles the lifecycle of plugins, API exposure, component slots, and hot-reloading architectures.

## Registering a Plugin
Plugins are initialized by passing an object to `fluxide.register()`.

```javascript
fluxide.register({
    id: 'my_plugin',
    view: { 
        id: 'my_plugin_view', 
        label: 'My View', 
        nav: true, 
        order: 5 
    },
    init(api) {},
    render(container, api) {},
    unmount() {},
    onDisable(api) {},
    onUninstall(api) {
        return api.ui.prompt("Type 'yes' to uninstall:").then(res => res === 'yes');
    }
});
```

## Plugin Data & Management

### `fluxide.plugins.has(id)`
Returns `true` if the plugin was successfully loaded.

### `fluxide.plugins.get(id)`
Returns the metadata (`plugin.json`) for the specified plugin ID.

### `fluxide.plugins.enable(id)` / `disable(id)`
Toggles the active state of a plugin within `.fluxide/settings.json`. Disabling calls `onDisable()` and issues a reload request to strip hooks from memory.

### `fluxide.plugins.uninstall(id)`
Awaits the optional `onUninstall(api)` lifecycle hook. If it returns false/rejects, the uninstallation is cancelled. If true, the system calls `unmount()`, deletes the plugin directory recursively from memory and disk, and refreshes the viewport.

### `fluxide.plugins.reload(id)`
Facilitates dynamic "micro updates". Safely triggers `unmount()`, flushes the registry module cache, re-reads the disk contents of `plugin.json` and the `.js` entry file, evaluates it natively, and invokes `init()` without requiring a page refresh.