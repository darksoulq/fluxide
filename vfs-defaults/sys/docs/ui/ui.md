# UI Components & Modals

`fluxide.ui` provides tools to create DOM elements, trigger modals, and render context menus without needing external frameworks.

## Virtual DOM (`ui.h`)
The `h` function is a hyperscript-like utility for building DOM elements dynamically.

**Syntax:** `fluxide.ui.h(tag, props, children)`

```javascript
const btn = fluxide.ui.h('button', {
    class: 'fx-btn fx-btn-primary',
    style: { marginTop: '10px' },
    dataset: { id: '123' },
    onClick: (e) => console.log("Clicked!"),
    innerHTML: '<b>Save</b>' // Overrides children if provided
});

const layout = fluxide.ui.h('div', {}, [
    fluxide.ui.h('h1', {}, 'Hello World'),
    btn
]);
```

## Context Menus
Override the browser's right-click menu with Fluxide's themed context menu.

### `fluxide.ui.context(event, items)`
Takes the original `MouseEvent` (to calculate coordinates) and an array of items.

```javascript
element.oncontextmenu = (e) => {
    fluxide.ui.context(e, [
        { label: 'Action 1', key: 'Ctrl-A', action: () => alert('1') },
        { sep: true }, // Adds a separator line
        { label: 'Delete', icon: '<svg>...</svg>', danger: true, action: () => del() }
    ]);
};
```

## Modals & Prompts

### `await fluxide.ui.prompt(title, placeholder)`
Spawns an async popup asking the user for input. Returns the string, or `null` if cancelled.
```javascript
const name = await fluxide.ui.prompt("New Folder Name", "e.g. src");
```

### `fluxide.ui.modal(renderFn)`
Opens a blank, centered modal window and passes the container element to your render function.
```javascript
fluxide.ui.modal((win) => {
    win.style.width = '400px';
    win.appendChild(fluxide.ui.h('div', { class: 'fx-modal-body' }, 'Custom UI inside modal!'));
});
```

### `fluxide.ui.modal.close()`
Programmatically closes the currently open modal.

## Markdown Rendering
### `fluxide.ui.markdown(text)`
Returns an HTML string. Utilizes `marked.js` and `highlight.js` internally if loaded, applying Fluxide's theme to code blocks.