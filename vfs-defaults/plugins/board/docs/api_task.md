# Task Viewer API

The Task Viewer is implemented as a parallel sub-module within the Board plugin. It handles all graphical user interfacing related to viewing, updating, and interacting with specific task payloads.

## Graphical Interfaces

### `fluxide.task.openModal(taskData, colId, mode)`

Instructs the system UI engine to mount the Task Viewer modal overhead.

* `taskData`: The raw object payload representing the task. Pass `null` if the mode is set to `'create'`.
* `colId`: The string identifier of the column this task resides in (or will reside in).
* `mode`: Accepts either `'view'`, `'edit'`, or `'create'`.

```javascript
node.onmousedown = () => {
	fluxide.task.openModal(nodeTaskData, parentColId, 'view');
};
```