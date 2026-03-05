# State & Events

Fluxide provides a reactive event-driven architecture and a centralized state manager exposed under `fluxide.state`.

## State Management

The `fluxide.state` API gives you access to the internal Virtual File System (VFS), application settings, and workspace data.

### `fluxide.state.get()`
Returns the global state object:
* `activeView` (string): The ID of the currently active view (e.g., `'ide'`).
* `vfs` (object): A key-value map of file paths to their string contents.
* `settings` (object): Global settings merged from `.fluxide/settings.json`.
* `workspace` (object): Local workspace data (e.g., Kanban boards).
* `startupErrors` (array): Errors captured during plugin compilation.

### `fluxide.state.update(fn)`
Safely mutate the state. Pass a function that modifies the provided state object.
```javascript
fluxide.state.update((s) => {
    s.vfs['my_plugin/data.txt'] = "New Content";
});
```

## Event Emitter

Fluxide relies heavily on event hooks to synchronize plugins. 

### `fluxide.on(event, callback)`
Registers a listener for a specific event.
```javascript
fluxide.on('ide:file_saved', (path) => {
    console.log(`${path} was just saved!`);
});
```

### `fluxide.emit(event, data)`
Synchronously fires an event to all registered listeners.

### `fluxide.emitAsync(event, data)`
Asynchronously fires an event. Awaits all Promise-returning callbacks.

## Core System Events
Fluxide automatically emits the following events:

* `workspace:change` - Fired when the workspace requires a sync/render.
* `settings:change` - Fired when a setting value changes (`{ key, val }`).
* `settings:apply` - Fired when the user hits "Apply" in the settings modal.
* `settings:cancel` - Fired when the settings modal closes without applying.
* `ui:scale` - Fired when the UI zoom level changes.
* `ide:file_opened` / `ide:tab_switched` / `ide:file_closed` - Passed the `path`.
* `ide:file_changed` - Passed `{ path, content }`.
* `ide:file_saved` - Passed the `path`.
* `ide:file_created` / `ide:file_deleted` - Passed the `path`.
* `ide:folder_created` / `ide:folder_deleted` - Passed the `path`.
* `ide:file_renamed` / `ide:folder_renamed` - Passed `{ oldPath, newPath }`.
* `ide:item_moved` - Passed `{ oldPath, newPath, isFile }`.
* `ide:project_created` - Passed `{ type, id }`.