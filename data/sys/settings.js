const { h } = fluxide.ui;
const { state, emit, expose, on } = fluxide;

const Settings = {
    tree: [
        { id: 'appearance', label: 'Appearance' },
        { id: 'keybinds', label: 'Keybindings' }
    ],
    expanded: new Set(['appearance', 'keybinds']),
    activeTab: 'appearance',
    _container: null,

    init() {
        expose('settings', {
            register: (id, config) => {
                const node = { id, label: config.label || id, children: config.sections || [] };
                const existing = this.tree.findIndex(n => n.id === id);
                if (existing > -1) this.tree[existing] = node;
                else this.tree.push(node);

                if (config.defaults) {
                    state.update(s => {
                        Object.keys(config.defaults).forEach(k => {
                            if (s.settings[k] === undefined) s.settings[k] = config.defaults[k];
                        });
                    });
                }
            },
            get: (key) => state.get().settings[key],
            set: (key, val) => {
                state.update(s => { s.settings[key] = val; });
                emit('settings:change', { key, val });
            },
            createControl: (label, type, key, opts = {}) => {
                const val = state.get().settings[key];
                const input = type === 'select' 
                    ? h('select', { class: 'fx-select', onChange: (e) => fluxide.settings.set(key, e.target.value) }, 
                        opts.options.map(o => typeof o === 'string' ? h('option', { value: o, selected: o === val }, o) : h('option', { value: o.value, selected: o.value === val }, o.label)))
                    : h('input', { 
                        class: 'fx-input', type, ...opts, value: val, 
                        onChange: (e) => fluxide.settings.set(key, e.target.value) 
                    });

                return h('div', { class: 'fx-form-group', style: { marginBottom: '20px' } }, [ h('label', { class: 'fx-form-label' }, label), input ]);
            }
        });

        setTimeout(() => {
            const status = document.getElementById('fx-status');
            if(status && !document.getElementById('settings-nav-btn')) {
                const btn = h('button', { 
                    id: 'settings-nav-btn',
                    class: 'fx-icon-btn', 
                    style: { width: '28px', height: '28px' },
                    innerHTML: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
                    onClick: () => fluxide.ui.openView('settings') 
                });
                status.appendChild(btn);
            }
        }, 100);
    },

    render(container) {
        this._container = container;
        container.style.display = 'grid';
        container.style.gridTemplateColumns = '240px 1fr';
        container.style.height = '100%';
        container.innerHTML = '';

        const sidebar = h('div', { class: 'fx-settings-sidebar', style: { borderRight: '1px solid var(--border)', background: 'var(--surface-low)', overflowY: 'auto' } }, [
            h('div', { class: 'fx-settings-header', style: { padding: '20px', fontSize: '11px', fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '1px' } }, 'SETTINGS'),
            h('div', { class: 'fx-settings-tree' }, this.renderTree(this.tree, 0))
        ]);

        const content = h('div', { class: 'fx-settings-content', style: { padding: '40px', overflowY: 'auto', background: 'var(--bg)' } });
        this.renderActiveTab(content, this.activeTab);

        container.appendChild(sidebar);
        container.appendChild(content);
    },

    renderTree(nodes, depth) {
        return nodes.map(node => {
            const hasChildren = node.children && node.children.length > 0;
            const isExpanded = this.expanded.has(node.id);
            const isActive = this.activeTab === node.id;

            const el = h('div', {
                class: `tree-node ${isActive ? 'active' : ''}`,
                style: { paddingLeft: (depth * 14 + 12) + 'px', padding: '8px 12px 8px ' + (depth * 14 + 12) + 'px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: isActive ? 'var(--text)' : 'var(--text-dim)', background: isActive ? 'var(--accent-glow)' : 'transparent', borderRadius: 'var(--radius-sm)', margin: '0 10px 2px 10px' },
                onMouseOver: (e) => { if(!isActive) e.currentTarget.style.background = 'var(--surface-hover)'; },
                onMouseOut: (e) => { if(!isActive) e.currentTarget.style.background = 'transparent'; },
                onClick: () => {
                    this.activeTab = node.id;
                    if (hasChildren) {
                        this.expanded.has(node.id) ? this.expanded.delete(node.id) : this.expanded.add(node.id);
                    }
                    this.render(this._container);
                }
            }, [
                hasChildren ? h('div', { style: { width: '12px', display: 'flex', alignItems: 'center' }, innerHTML: isExpanded ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>' }) : h('div', { style: { width: '12px' } }),
                h('span', { style: { fontWeight: isActive ? 600 : 500, fontSize: '13px' } }, node.label)
            ]);

            if (hasChildren && isExpanded) {
                return [el, ...this.renderTree(node.children, depth + 1)];
            }
            return el;
        }).flat();
    },

    renderActiveTab(container, id) {
        const values = state.get().settings;

        if (id === 'appearance') {
            container.appendChild(h('h2', { style: { marginTop: 0, marginBottom: '24px', fontSize: '20px' } }, 'Appearance'));
            container.appendChild(fluxide.settings.createControl('UI Scale', 'number', 'ui_scale', { step: 0.05 }));
        } else if (id === 'keybinds') {
            container.appendChild(h('h2', { style: { marginTop: 0, marginBottom: '24px', fontSize: '20px' } }, 'Keybindings'));
            fluxide.keybinds.getAll().forEach(kb => {
                const row = h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' } }, [
                    h('div', {}, [ h('div', { style: { fontWeight: 600, fontSize: '13px', marginBottom: '4px' } }, kb.description), h('div', { style: { fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-code)' } }, kb.id) ]),
                    h('input', {
                        class: 'fx-input',
                        style: { width: '150px', textAlign: 'center', fontFamily: 'var(--font-code)' },
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
                                fluxide.keybinds.register(kb.id, newKey, kb.action, kb.description);
                                emit('settings:change');
                            }
                        }
                    })
                ]);
                container.appendChild(row);
            });
        } else {
            emit(`settings:render:${id}`, { container, values });
        }
    }
};

fluxide.register({ id: 'settings', view: { id: 'settings', label: 'Settings', nav: false, order: 99 }, init: () => Settings.init(), render: (c) => Settings.render(c) });