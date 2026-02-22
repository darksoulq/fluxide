# Component Slots

The Kanban Board plugin heavily leverages the Kernel's Component Registry system. This architecture permits independent plugins to safely inject customized graphical DOM nodes directly into the Board's rendering cycles without modifying the Board's source code.

## Available Slots

### `board-task-card-content`

Fires during the construction of an individual task card directly on the Board view. Elements returned here are appended to the bottom of the card content wrapper.

```javascript
fluxide.registerComponent('board-task-card-content', {
	id: 'task-metrics-tag',
	render: (task) => {
		if (task.priority === 'high') {
			return fluxide.ui.h('div', { 
				style: { fontSize: '10px', color: 'red' } 
			}, 'URGENT');
		}
		return null;
	}
});
```

### `task-view-section`

Fires during the construction of the read-only Task Viewer modal. Allows injection of entire new layout sections below the standard Todo list.

```javascript
fluxide.registerComponent('task-view-section', {
	id: 'time-tracker-view',
	render: (task, colId) => {
		return fluxide.ui.h('div', { style: { marginTop: '25px' } }, [
			fluxide.ui.h('h3', { 
				style: { fontSize: '11px', color: 'var(--text-dim)' } 
			}, 'Time Tracking'),
			fluxide.ui.h('div', {}, 'No time logged.')
		]);
	}
});
```

### `task-edit-section`

Fires during the construction of the Task Editor modal (and Creation modal). Allows injection of form elements right before the modal footer.

```javascript
fluxide.registerComponent('task-edit-section', {
	id: 'time-tracker-edit',
	render: (task, colId) => {
		return fluxide.ui.h('div', { class: 'fx-form-row' }, [
			fluxide.ui.h('label', { class: 'fx-form-label' }, 'Estimated Hours'),
			fluxide.ui.h('input', { class: 'fx-input', type: 'number' })
		]);
	}
});
```