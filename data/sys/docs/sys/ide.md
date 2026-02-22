# IDE Subsystem

The System IDE is heavily decoupled. It maintains internal layout states while exposing an API layer that allows external scripts to manipulate tabs, output logs, and append UI segments.

## Programmatic Controls

### `fluxide.ide.openFile(path)`

Programmatically triggers the IDE to fetch a path from the active Virtual File System and mount it into an active CodeMirror tab.

### `fluxide.ide.closeTab(path)`

Forces an open CodeMirror tab to destruct.

### `fluxide.ide.switchTab(path)`

Alias logic that changes the current active viewport to the designated path.

### `fluxide.ide.log(message, type)`

Appends standardized output trace lines into the IDE's integrated terminal.
Available typings: `info`, `warn`, `error`, `success`.

```javascript
fluxide.ide.log('Build process completed successfully.', 'success');
```

### `fluxide.ide.clearLogs()`

Purges the internal output terminal cache.

### `fluxide.ide.listFiles()`

Returns an array of strings representing every file currently mapped into the Virtual File System dictionary.

## Interface Extensibility

### `fluxide.ide.addHeaderTool(renderFn)`

Injects customized interactive nodes into the File Explorer's right-aligned control bar.

```javascript
fluxide.ide.addHeaderTool((ideInstance) => {
	return fluxide.ui.h('button', { 
		class: 'fx-icon-btn', 
		onClick: () => executeCustomTool() 
	}, 'T');
});
```

### `fluxide.ide.addTreeContext(renderFn)`

Injects custom commands dynamically into the right-click properties of standard Virtual File System tree nodes.

```javascript
fluxide.ide.addTreeContext((path, isFile, ideInstance) => {
	return [
		{ label: 'Compile Definition', action: () => executeCompiler(path) }
	];
});
```

### `fluxide.ide.addEditorContext(renderFn)`

Injects configuration objects dynamically into the CodeMirror editor's primary right-click overlay canvas.

```javascript
fluxide.ide.addEditorContext((activeTabPath, ideInstance) => {
	return [
		{ label: 'Format Document', action: () => executeFormatter(activeTabPath) }
	];
});
```