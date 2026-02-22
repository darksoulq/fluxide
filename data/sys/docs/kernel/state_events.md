# State & Events API

The Fluxide Kernel utilizes a centralized, mutable state tree coupled with an event bus. This architecture guarantees that UI elements and plugins remain perfectly synchronized without requiring strict dependency loops.

## State Management

The global state holds the Virtual File System, active user settings, and plugin-specific workspaces.

### `fluxide.state.get()`

Retrieves a read-only snapshot of the entire current global state object.

```javascript
const currentState = fluxide.state.get();
const isDevMode = currentState.settings.dev_mode === 'true';
```

### `fluxide.state.update(fn)`

Safely mutates the global state. The provided callback function receives the active state tree as its single argument. Modifications made within this callback are synchronously applied to the core tree.

```javascript
fluxide.state.update(s => {
	s.settings.dev_mode = 'true';
	s.workspace.columns[0].tasks = [];
});
```

## Event Bus

The event bus allows decoupled plugins to react to global system changes or broadcast their own custom events.

### `fluxide.on(event, callback)`

Registers a listener for a specific string identifier. The callback executes whenever the event is emitted.

```javascript
fluxide.on('workspace:change', () => {
	fluxide.ide.log('Workspace data was updated.', 'info');
});
```

### `fluxide.emit(event, data)`

Broadcasts a signal across the system. All registered listeners for the specified event will immediately execute.

```javascript
fluxide.emit('settings:change', { source: 'custom_plugin_id' });
```