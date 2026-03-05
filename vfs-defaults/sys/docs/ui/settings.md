# Settings API

Fluxide features a dynamically generated settings panel. Plugins can register their own tabs, populate them with controls, and react to changes.

## 1. Registering a Category
You must register your settings namespace and provide default values.

### `fluxide.settings.register(id, config)`
* `id` (string): The dot-notation path for the sidebar tree (e.g., `editor.minimap`).
* `config` (object): Contains a display `label` and `defaults`.

```javascript
fluxide.settings.register('plugins.my_plugin', {
    label: 'My Awesome Plugin',
    defaults: { 
        auto_save: 'true', 
        max_limit: '100' 
    }
});
```

## 2. Rendering the Controls
When the user clicks your tab, the system emits `settings:render:YOUR_ID`. You must listen for this event to render your UI.

### `fluxide.settings.createControl(label, type, key, opts)`
Generates standard Fluxide-themed inputs. Types: `toggle`, `slider`, `select`, `text`, `number`.

```javascript
fluxide.on('settings:render:plugins.my_plugin', ({ container, values }) => {
    
    container.appendChild(fluxide.ui.h('h2', { 
        style: { marginTop: 0, marginBottom: '24px', fontSize: '20px' } 
    }, 'My Plugin Configuration'));

    // Create a toggle switch
    container.appendChild(fluxide.settings.createControl('Enable Auto Save', 'toggle', 'auto_save'));
    
    // Create a number input
    container.appendChild(fluxide.settings.createControl('Max Limit', 'number', 'max_limit'));
    
    // Create a select dropdown
    container.appendChild(fluxide.settings.createControl('Mode', 'select', 'mode_select', {
        options: [
            { value: 'light', label: 'Light Mode' },
            { value: 'dark', label: 'Dark Mode' }
        ]
    }));
});
```

## 3. Reading & Applying
* **`fluxide.settings.get(key)`**: Get the current active value of a setting.
* **`fluxide.settings.set(key, val)`**: Used internally by controls to draft changes.
* **`fluxide.settings.requestReload()`**: Call this if your setting requires a full refresh to take effect. It will reload the app instantly when the user clicks "Apply Changes".

*Note: You can listen to the `settings:change` event globally to react to config updates in real-time.*