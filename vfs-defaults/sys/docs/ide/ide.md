# IDE Controls

The `fluxide.ide` API allows you to manipulate the active editor, open tabs, write to the output console, and inject tools into the sidebar.

## Managing Files & Tabs

* **`fluxide.ide.openFile(path)`**: Opens a file in the editor (or focuses it if already open).
* **`fluxide.ide.closeTab(path)`**: Closes a specific tab.
* **`fluxide.ide.switchTab(path)`**: Alias for `openFile`.
* **`fluxide.ide.getActiveTab()`**: Returns the string path of the file currently visible in the editor.
* **`fluxide.ide.getOpenTabs()`**: Returns an array of paths for all currently open tabs.
* **`fluxide.ide.listFiles()`**: Returns an array of all file paths loaded into the active VFS.

## Output Console

The IDE includes a collapsible Output Terminal at the bottom of the screen.

### `fluxide.ide.log(msg, type = 'info')`
Appends a line to the console. Automatically includes a timestamp.
* `msg`: Can be a string OR an HTML Element.
* `type`: Used for CSS coloring (`'info'`, `'error'`, `'success'`).

```javascript
fluxide.ide.log("Compilation Successful!", "success");
```

### `fluxide.ide.clearLogs()`
Wipes the output terminal clean.

## UI Injections (Context & Tools)

You can extend the IDE's core functionality by pushing functions into its injection arrays. These functions are executed at render time and should return context menu items or DOM elements.

### `fluxide.ide.addHeaderTool(fn)`
Adds a button next to the "Refresh" and "Collapse All" icons in the top-left Explorer header.
```javascript
fluxide.ide.addHeaderTool((ideInstance) => {
    return fluxide.ui.h('button', {
        class: 'fx-icon-btn',
        title: 'Run Script',
        innerHTML: '▶',
        onClick: () => executeScript()
    });
});
```

### `fluxide.ide.addTreeContext(fn)`
Injects options into the right-click menu of items in the file explorer.
```javascript
fluxide.ide.addTreeContext((itemPath, isFile, ideInstance) => {
    if (!isFile) return null; // Only show on files
    
    return [
        { 
            label: 'Copy Path', 
            action: () => navigator.clipboard.writeText(itemPath) 
        }
    ];
});
```

### `fluxide.ide.addEditorContext(fn)`
Injects options into the right-click menu inside the text editor window.
```javascript
fluxide.ide.addEditorContext((activeTab, ideInstance) => {
    return [
        { 
            label: 'Format Code', 
            action: () => runFormatter(activeTab) 
        }
    ];
});
```