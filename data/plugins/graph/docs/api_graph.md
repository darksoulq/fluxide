# Graph Core API

The Graph plugin provides a force-directed visualization of the workspace, mapping columns as parent hubs and tasks as child nodes, with support for cross-task dependency links.

## Properties

### `fluxide.graph.instance`
Returns the raw ForceGraph instance. This provides direct access to the underlying d3-force simulation engine for advanced manipulation.

### `fluxide.graph.nodes` / `fluxide.graph.links`
Current datasets active in the visualization. 
* **Nodes**: Contains `id`, `label`, and `type` (`column` | `task`).
* **Links**: Contains `source`, `target`, and `type` (`ownership` | `dependency`).

## Methods

### `fluxide.graph.refresh()`
Syncs the graph internal state with the current `workspace` state. This is automatically called on `workspace:change`.

### `fluxide.graph.focusNode(id)`
Smoothly pans and zooms the camera to center on a specific node.
```javascript
fluxide.graph.focusNode('t_12345');
```

### `fluxide.graph.addNodeContext(fn)`
Register custom context menu entries for nodes.
```javascript
fluxide.graph.addNodeContext((node) => {
    if (node.type === 'task') {
        return [{ label: 'Log Progress', action: () => console.log(node.id) }];
    }
});
```