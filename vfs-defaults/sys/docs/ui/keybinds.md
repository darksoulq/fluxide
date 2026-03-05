# Keybindings

The Kernel intercepts keyboard events globally and maps them to registered actions. The user can view and edit these in `Settings -> Keybindings`.

### `fluxide.keybinds.register(id, key, action, description)`
Registers or updates a shortcut.

* `id` (string): Unique identifier (e.g. `ide.save`).
* `key` (string): The combination string. Modifiers (`Ctrl`, `Shift`, `Alt`) followed by uppercase key.
* `action` (function): The callback to execute.
* `description` (string): User-facing description shown in the settings UI.

```javascript
fluxide.keybinds.register(
    'my_plugin.compile', 
    'Ctrl-Shift-B', 
    () => runCompiler(), 
    "Compile Current Project"
);
```

### `fluxide.keybinds.getAll()`
Returns an array of all registered keybind objects.