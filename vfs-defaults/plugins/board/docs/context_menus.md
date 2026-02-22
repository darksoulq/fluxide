# Context Menus

To maintain layout integrity, the Board exposes injection points specifically for right-click interaction menus on its primary interface objects.

## Menu Injection

### `fluxide.board.addCardContext(fn)`

Appends additional configuration objects to the context menu that triggers when a user right-clicks on a specific task card.

```javascript
fluxide.board.addCardContext((task, colId) => {
	return [
		{ label: 'Duplicate Task', action: () => copyRoutine(task, colId) },
		{ label: 'Archive Task', action: () => archiveRoutine(task) }
	];
});
```

### `fluxide.board.addColContext(fn)`

Appends additional configuration objects to the context menu that triggers when a user right-clicks on a column header.

```javascript
fluxide.board.addColContext((col) => {
	return [
		{ label: 'Clear All Tasks', danger: true, action: () => wipeRoutine(col.id) }
	];
});
```