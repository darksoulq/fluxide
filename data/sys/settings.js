const { h } = fluxide.ui;
const { state, emit, expose, on } = fluxide;

const Settings = {
    init() {
        state.update(s => {
            s.settings.tree = [
                { id: 'appearance', label: 'Appearance' },
                { id: 'keybinds', label: 'Keybindings' }
            ];
            s.settings.expanded = new Set(['appearance', 'keybinds']);
        });

        expose('settings', {
            register: (id, config) => {
                state.update(s => {
                    const node = { id, label: config.label || id, children: config.sections || [] };
                    const existing = s.settings.tree.findIndex(n => n.id === id);
                    if (existing > -1) s.settings.tree[existing] = node;
                    else s.settings.tree.push(node);

                    if (config.defaults) {
                        Object.keys(config.defaults).forEach(k => {
                            if (s.settings.values[k] === undefined) s.settings.values[k] = config.defaults[k];
                        });
                    }
                });
            },
            get: (key) => state.get().settings.values[key],
            set: (key, val) => {
                state.update(s => { s.settings.values[key] = val; });
                emit('settings:change', { key, val });
            }
        });
    },

    render(container) {
        this._container = container;
        container.style.display = 'grid';
        container.style.gridTemplateColumns = '240px 1fr';
        container.style.height = '100%';
        container.innerHTML = '';

        const s = state.get().settings;

        const sidebar = h('div', { class: 'fx-settings-sidebar' }, [
            h('div', { class: 'fx-settings-header' }, 'SETTINGS'),
            h('div', { class: 'fx-settings-tree' }, this.renderTree(s.tree, 0))
        ]);

        const content = h('div', { class: 'fx-settings-content' });
        this.renderActiveTab(content, s.activeTab);

        container.appendChild(sidebar);
        container.appendChild(content);
    },

    renderTree(nodes, depth) {
        const s = state.get().settings;
        return nodes.map(node => {
            const hasChildren = node.children && node.children.length > 0;
            const isExpanded = s.expanded.has(node.id);
            const isActive = s.activeTab === node.id;

            const el = h('div', {
                class: `tree-node ${isActive ? 'active' : ''}`,
                style: { paddingLeft: (depth * 14 + 12) + 'px' },
                onClick: () => {
                    state.update(st => {
                        st.settings.activeTab = node.id;
                        if (hasChildren) {
                            st.settings.expanded.has(node.id) ? st.settings.expanded.delete(node.id) : st.settings.expanded.add(node.id);
                        }
                    });
                    this.render(this._container);
                }
            }, [
                hasChildren ? h('div', { class: 'tree-arrow', innerHTML: isExpanded ? '▼' : '▶' }) : h('div', { style: 'width:12px' }),
                h('span', {}, node.label)
            ]);

            if (hasChildren && isExpanded) {
                return [el, ...this.renderTree(node.children, depth + 1)];
            }
            return el;
        }).flat();
    },

    renderActiveTab(container, id) {
        const values = state.get().settings.values;

        if (id === 'appearance') {
            container.appendChild(h('h2', {}, 'Appearance'));
            container.appendChild(this.createControl('UI Scale', 'range', 'ui_scale', { min: 0.7, max: 1.3, step: 0.05 }));
            container.appendChild(this.createControl('Theme', 'select', 'theme', { options: ['dracula', 'catppuccin', 'flat_dark'] }));
        } else if (id === 'keybinds') {
            container.appendChild(h('h2', {}, 'Keybindings'));
            fluxide.keybinds.getAll().forEach(kb => {
                const row = h('div', { class: 'fx-kb-row' }, [
                    h('div', { class: 'fx-kb-info' }, [ h('div', { class: 'fx-kb-label' }, kb.description), h('div', { class: 'fx-kb-id' }, kb.id) ]),
                    h('input', {
                        class: 'fx-input fx-kb-input',
                        value: kb.key,
                        onKeyDown: (e) => {
                            e.preventDefault();
                            const keys = [];
                            if(e.ctrlKey) keys.push('Ctrl');
                            if(e.shiftKey) keys.push('Shift');
                            if(e.altKey) keys.push('Alt');
                            if(!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
                                keys.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
                                const newKey = keys.join('-');
                                e.target.value = newKey;
                                fluxide.keybinds.update(kb.id, newKey);
                                emit('settings:change');
                            }
                        }
                    })
                ]);
                container.appendChild(row);
            });
        } else {
            const pluginId = id.split('.')[0];
            const sectionId = id.includes('.') ? id.split('.')[1] : null;
            emit(`settings:render:${id}`, { container, values });
        }
    },

    createControl(label, type, key, opts = {}) {
        const val = state.get().settings.values[key];
        const input = type === 'select' 
            ? h('select', { class: 'fx-select', onChange: (e) => fluxide.settings.set(key, e.target.value) }, 
                opts.options.map(o => h('option', { value: o, selected: o === val }, o)))
            : h('input', { 
                class: 'fx-input', type, ...opts, value: val, 
                onChange: (e) => fluxide.settings.set(key, e.target.value) 
            });

        return h('div', { class: 'fx-form-group' }, [ h('label', {}, label), input ]);
    }
};

fluxide.register({ id: 'settings', view: { id: 'settings', label: 'Settings', order: 99 }, init: () => Settings.init(), render: (c) => Settings.render(c) });