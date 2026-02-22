# Registries & Core

These methods construct the core extensibility pipeline, permitting plugins to mount logic, inject components into other plugins, and declare preferences.

## Plugin Management

### `fluxide.register(pluginConfig)`

Mounts a plugin into the boot sequence. It accepts an identifier, an optional view rendering configuration, and initialization routines.

```javascript
fluxide.register({
	id: 'my_plugin',
	view: { id: 'view1', label: 'My View', order: 5 },
	init(api) { 
		fluxide.ide.log('Plugin initialized');
	},
	render(container, api) { 
		container.appendChild(fluxide.ui.h('div', {}, 'View Active'));
	}
});
```

### `fluxide.expose(id, object)`

Assigns an object directly to the global API namespace, allowing cross-plugin method execution.

```javascript
fluxide.expose('customApi', {
	executeTask: () => true
});
```

## Hook Extensions

### `fluxide.registerComponent(slot, component)`

Allows plugins to inject HTML nodes dynamically into pre-defined slots maintained by primary plugins.

```javascript
fluxide.registerComponent('task-extra', {
	id: 'custom-tag',
	render: (taskData, api) => fluxide.ui.h('span', { class: 'fx-badge' }, taskData.id)
});
```

### `fluxide.getComponents(slot)`

Retrieves an array of all components actively mapped to a provided string slot.

### `fluxide.registerSetting(category, settingConfig)`

Automatically constructs and maps graphical interfaces in the user's System Preferences screen. Value mutations are inherently bound to the global state tree.

```javascript
fluxide.registerSetting('General', {
	id: 'custom_toggle',
	label: 'Enable Feature',
	type: 'select',
	options: [{value: 'true', label: 'On'}, {value: 'false', label: 'Off'}],
	onchange: (val) => fluxide.emit('workspace:change')
});
```

## Global Input

### `fluxide.keybinds.register(id, keys, action, description)`

Binds a global keyboard shortcut to a specific function execution.

```javascript
fluxide.keybinds.register('custom.action', 'Ctrl-M', () => executeAction(), 'Runs macro');
```

### `fluxide.keybinds.getAll()`

Returns the complete keybind dictionary object.