# UI Engine

Fluxide bundles a proprietary, zero-dependency declarative Virtual DOM wrapper alongside standard, system-wide graphical overlays.

## Declarative UI

### `fluxide.ui.h(tag, props, children)`

Creates standard DOM elements and fully resolves SVG namespaces dynamically. Event listeners map perfectly to standard browser events when prefixed with `on`.

```javascript
const btn = fluxide.ui.h('button', {
	class: 'fx-btn fx-btn-primary',
	style: { padding: '10px' },
	onClick: (e) => fluxide.ide.log('Executed.', 'info')
}, 'Execute Operation');
```

## Component Modals

### `fluxide.ui.modal(renderFn)`

Triggers the primary system overlay. The `renderFn` callback is passed the raw, empty modal DOM node, allowing plugins to append custom layouts.

```javascript
fluxide.ui.modal(win => {
	const content = fluxide.ui.h('div', { class: 'fx-modal-body' }, 'Plugin Interface');
	win.appendChild(content);
});
```

### `fluxide.ui.modal.close()`

Programmatically forces the currently active modal to destruct and return focus to the underlying application.

### `fluxide.ui.prompt(title, placeholder)`

A specialized asynchronous wrapper around the modal system designed to request text input from the user. Returns a Promise containing the string value, or `null` if cancelled.

```javascript
const folderName = await fluxide.ui.prompt('New Folder', 'folder_name');
```

## Navigation & Utilities

### `fluxide.ui.context(event, items)`

Spawns a highly-stylized context menu exactly at the cursor coordinates captured from a standard mouse event.

```javascript
node.oncontextmenu = (e) => {
	fluxide.ui.context(e, [
		{ label: 'Execute', icon: fluxide.theme.getIcon('save'), action: () => executeAction() },
		{ sep: true },
		{ label: 'Delete', danger: true, action: () => deleteNode() }
	]);
};
```

### `fluxide.ui.markdown(string)`

Parses raw markdown syntax into a valid HTML string, automatically running code blocks through the active `highlight.js` instance.

### `fluxide.ui.openView(id)`

Tears down the existing Workspace View, executes the unmount hooks, and mounts the rendering engine of the targeted view identifier.