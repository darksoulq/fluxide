# Board Management API

The Kanban Board plugin exposes a robust API to programmatically manipulate the workspace board, allowing external scripts to interface with columns and individual tasks dynamically.

## Column Operations

### `fluxide.board.getColumns()`

Retrieves the entire array of column objects currently present in the active workspace state.

```javascript
const columns = fluxide.board.getColumns();
```

### `fluxide.board.getColumn(id)`

Retrieves a specific column object reference based on its exact string identifier.

```javascript
const todoColumn = fluxide.board.getColumn('col_1708531200000');
```

### `fluxide.board.addColumn(title)`

Programmatically appends a new column to the rightmost edge of the board layout.

```javascript
fluxide.board.addColumn('Q1 Release');
```

### `fluxide.board.removeColumn(id)`

Permanently removes a column and all of its associated tasks from the workspace.

```javascript
fluxide.board.removeColumn('col_1708531200000');
```

### `fluxide.board.moveColumn(colId, targetIndex)`

Shifts a column to a new structural index within the board arrays, triggering a UI reflow.

```javascript
fluxide.board.moveColumn('col_1708531200000', 0);
```

## Task Operations

### `fluxide.board.addTask(colId, taskObject)`

Injects a fully constructed task object into the targeted column identifier.

```javascript
fluxide.board.addTask('col_1708531200000', {
	id: 't_custom99',
	title: 'Automated Migration',
	priority: 'high',
	tags: ['script'],
	deps: [],
	desc: 'Execute standard migration routines.',
	todos: []
});
```

### `fluxide.board.removeTask(colId, taskId)`

Deletes a targeted task from a designated column.

```javascript
fluxide.board.removeTask('col_1708531200000', 't_custom99');
```

### `fluxide.board.moveTask(taskId, fromColId, toColId, targetIndex)`

Transfers a task between columns or repositions it within its native column. The `targetIndex` is optional; omitting it or passing `-1` appends the task to the bottom of the targeted column.

```javascript
fluxide.board.moveTask('t_custom99', 'col_1', 'col_2', 0);
```