// darksoulq/fluxide/darksoulq-fluxide-6f73439658620ffb9d43ea294ca73f49b6c7d35b/vfs-defaults/sys/settings.js
const { h, modal } = fluxide.ui;
const { state, emit, expose, on } = fluxide;

const Settings = {
    tree: [],
    expanded: new Set(),
    activeTab: null,
    _container: null,

    init() {
        const style = document.createElement('style');
        style.id = 'fx-settings-styles';
        style.innerHTML = `
            .fx-toggle { position: relative; display: inline-block; width: 36px; height: 20px; flex-shrink: 0; }
            .fx-toggle input { opacity: 0; width: 0; height: 0; }
            .fx-toggle-slider { position: absolute; cursor: pointer; inset: 0; background-color: var(--surface-high); border: 1px solid var(--border); transition: .2s; border-radius: 20px; }
            .fx-toggle-slider:before { position: absolute; content: ""; height: 12px; width: 12px; left: 3px; bottom: 3px; background-color: var(--text-dim); transition: .2s; border-radius: 50%; }
            .fx-toggle input:checked + .fx-toggle-slider { background-color: var(--accent); border-color: var(--accent); }
            .fx-toggle input:checked + .fx-toggle-slider:before { transform: translateX(16px); background-color: #fff; }
            .fx-form-group.fx-toggle-group { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; background: rgba(0,0,0,0.1); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid transparent; }
            .fx-form-group.fx-toggle-group:hover { border-color: var(--border); background: var(--surface-low); }
        `;
        if(!document.getElementById('fx-settings-styles')) document.head.appendChild(style);

        expose('settings', {
            register: (id, config) => {
                const parts = id.split('.');
                let curr = this.tree;
                let path = '';
                parts.forEach((p, i) => {
                    path += (path ? '.' : '') + p;
                    let node = curr.find(n => n.id === path);
                    if (!node) {
                        node = { id: path, label: i === parts.length - 1 ? (config.label || p) : (p.charAt(0).toUpperCase() + p.slice(1)), children: [], config: i === parts.length - 1 ? config : null };
                        curr.push(node);
                    } else if (i === parts.length - 1) {
                        node.label = config.label || p;
                        node.config = config;
                    }
                    curr = node.children;
                });

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
                let val = state.get().settings[key];
                if (key === 'ui_scale' && val === '1') val = '1.0';
                
                let input;
                if (type === 'select') {
                    input = h('select', { class: 'fx-select', onChange: (e) => fluxide.settings.set(key, e.target.value) }, 
                        opts.options.map(o => typeof o === 'string' ? h('option', { value: o, selected: o === val }, o) : h('option', { value: o.value, selected: o.value === val }, o.label)));
                } else if (type === 'slider') {
                    input = h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
                        h('input', { type: 'range', min: opts.min || 0, max: opts.max || 100, step: opts.step || 1, value: val, class: 'fx-slider', onInput: (e) => { e.target.nextSibling.innerText = e.target.value; fluxide.settings.set(key, e.target.value); } }),
                        h('span', { style: { fontSize: '12px', width: '30px' } }, val)
                    ]);
                } else if (type === 'toggle') {
                    input = h('label', { class: 'fx-toggle' }, [
                        h('input', { type: 'checkbox', checked: val === 'true', onChange: (e) => fluxide.settings.set(key, e.target.checked ? 'true' : 'false') }),
                        h('span', { class: 'fx-toggle-slider' })
                    ]);
                    return h('div', { class: 'fx-form-group fx-toggle-group' }, [ h('label', { class: 'fx-form-label', style: { marginBottom: 0 } }, label), input ]);
                } else {
                    input = h('input', { class: 'fx-input', type, ...opts, value: val, onChange: (e) => fluxide.settings.set(key, e.target.value) });
                }
                return h('div', { class: 'fx-form-group', style: { marginBottom: '20px' } }, [ h('label', { class: 'fx-form-label' }, label), input ]);
            }
        });

        setTimeout(() => {
            const status = document.getElementById('fx-status');
            if(status && !document.getElementById('settings-nav-btn')) {
                const btn = h('button', { 
                    id: 'settings-nav-btn',
                    class: 'fx-icon-btn', 
                    style: { width: '28px', height: '28px', marginLeft: 'auto' },
                    innerHTML: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
                    onClick: () => this.openModal() 
                });
                status.style.display = 'flex';
                status.style.width = '100%';
                status.appendChild(btn);
            }
        }, 100);

        fluxide.settings.register('appearance.general', {
            label: 'General UI',
            defaults: { ui_scale: '1.0' }
        });
        fluxide.settings.register('appearance.keybinds', { label: 'Keybindings' });
        
        on('settings:render:appearance.general', ({container}) => {
            container.appendChild(h('h2', { style: { marginTop: 0, marginBottom: '24px', fontSize: '20px' } }, 'General UI'));
            container.appendChild(fluxide.settings.createControl('UI Scale', 'select', 'ui_scale', { options: [{value:'0.75',label:'75%'},{value:'0.9',label:'90%'},{value:'1.0',label:'100%'},{value:'1.1',label:'110%'},{value:'1.25',label:'125%'},{value:'1.5',label:'150%'}] }));
        });

        on('settings:change', ({key, val}) => {
            if (key === 'ui_scale') {
                document.body.style.zoom = val;
                const shell = document.getElementById('fx-shell');
                if (shell) shell.style.height = `calc(100vh / ${val})`;
                emit('ui:scale');
            }
        });

        setTimeout(() => {
            let scale = state.get().settings.ui_scale || '1.0';
            if (scale === '1') scale = '1.0';
            document.body.style.zoom = scale;
            const shell = document.getElementById('fx-shell');
            if (shell) shell.style.height = `calc(100vh / ${scale})`;
        }, 200);
    },

    openModal() {
        if (!this.activeTab && this.tree.length > 0) {
            const findFirst = (n) => (n.config || !n.children.length) ? n.id : findFirst(n.children[0]);
            this.activeTab = findFirst(this.tree[0]);
        }
        modal(win => {
            win.style.width = '80vw';
            win.style.height = '80vh';
            win.style.maxWidth = '1000px';
            win.style.padding = '0';
            this.render(win);
        });
    },

    render(container) {
        this._container = container;
        container.style.display = 'grid';
        container.style.gridTemplateColumns = '240px 1fr';
        container.style.height = '100%';
        container.style.borderRadius = 'var(--radius-md)';
        container.style.overflow = 'hidden';
        container.innerHTML = '';

        const sidebar = h('div', { class: 'fx-settings-sidebar', style: { borderRight: '1px solid var(--border)', background: 'var(--surface-low)', overflowY: 'auto' } }, [
            h('div', { class: 'fx-settings-header', style: { padding: '20px', fontSize: '11px', fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '1px' } }, 'SETTINGS'),
            h('div', { class: 'fx-settings-tree' }, this.renderTree(this.tree, 0))
        ]);

        const contentWrap = h('div', { style: { display: 'flex', flexDirection: 'column', background: 'var(--bg)', position: 'relative', overflow: 'hidden' } });
        const closeBtn = h('button', { class: 'fx-icon-btn', style: { position: 'absolute', top: '15px', right: '15px', width: '32px', height: '32px', zIndex: 10 }, innerHTML: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>', onClick: () => modal.close() });
        
        const content = h('div', { class: 'fx-settings-content', style: { padding: '40px', overflowY: 'auto', flex: 1 } });
        this.renderActiveTab(content, this.activeTab);

        contentWrap.appendChild(closeBtn);
        contentWrap.appendChild(content);

        container.appendChild(sidebar);
        container.appendChild(contentWrap);
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
                    if (hasChildren) {
                        this.expanded.has(node.id) ? this.expanded.delete(node.id) : this.expanded.add(node.id);
                    }
                    if (node.config || !hasChildren) {
                        this.activeTab = node.id;
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

        if (id === 'appearance.keybinds') {
            container.appendChild(h('h2', { style: { marginTop: 0, marginBottom: '24px', fontSize: '20px' } }, 'Keybindings'));
            fluxide.keybinds.getAll().forEach(kb => {
                let currentKey = kb.key;
                let recording = false;

                const renderModifiers = (keysStr) => {
                    const p = keysStr.split('-');
                    const btn = (lbl, active) => h('div', { style: { padding: '2px 6px', fontSize: '10px', background: active ? 'var(--accent)' : 'var(--surface-high)', color: active ? '#fff' : 'var(--text-dim)', borderRadius: '3px', cursor: 'pointer' }, onClick: () => {
                        if(recording) return;
                        let np = [...p];
                        if(active) np = np.filter(x => x !== lbl); else { if(!np.includes(lbl)) np.unshift(lbl); }
                        const nw = np.join('-');
                        fluxide.keybinds.register(kb.id, nw, kb.action, kb.description); emit('settings:change', { key: 'keybinds' });
                        btnGroup.parentElement.replaceChild(renderModifiers(nw), btnGroup);
                    }}, lbl);
                    const mainKey = p.filter(x => !['Ctrl','Shift','Alt'].includes(x))[0] || '';
                    const btnGroup = h('div', { style: { display: 'flex', gap: '4px', alignItems: 'center' } }, [
                        btn('Ctrl', p.includes('Ctrl')), btn('Shift', p.includes('Shift')), btn('Alt', p.includes('Alt')),
                        h('button', { class: 'fx-btn', style: { marginLeft: '8px', minWidth: '60px', textAlign: 'center' }, onClick: (e) => {
                            if(recording) return; recording = true; e.target.innerText = 'Press key...';
                            const hndl = (ke) => {
                                ke.preventDefault(); ke.stopPropagation();
                                if(!['Control','Shift','Alt','Meta'].includes(ke.key)) {
                                    const k = ke.key.length === 1 ? ke.key.toUpperCase() : ke.key;
                                    let np = p.filter(x => ['Ctrl','Shift','Alt'].includes(x));
                                    np.push(k); const nw = np.join('-');
                                    fluxide.keybinds.register(kb.id, nw, kb.action, kb.description); emit('settings:change', { key: 'keybinds' });
                                    document.removeEventListener('keydown', hndl, true);
                                    btnGroup.parentElement.replaceChild(renderModifiers(nw), btnGroup);
                                }
                            };
                            document.addEventListener('keydown', hndl, true);
                        }}, mainKey || 'None')
                    ]);
                    return btnGroup;
                };

                const row = h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' } }, [
                    h('div', {}, [ h('div', { style: { fontWeight: 600, fontSize: '13px', marginBottom: '4px' } }, kb.description), h('div', { style: { fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-code)' } }, kb.id) ]),
                    renderModifiers(currentKey)
                ]);
                container.appendChild(row);
            });
        } else {
            emit(`settings:render:${id}`, { container, values });
        }
    }
};

fluxide.register({ id: 'settings', init: () => Settings.init() });