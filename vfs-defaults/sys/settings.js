const { h, prompt, context, modal } = fluxide.ui;
const { state, emit, emitAsync, expose, on } = fluxide;

const Settings = {
    tree: [],
    expanded: new Set(),
    activeTab: null,
    draft: {},
    _container: null,
    pendingReload: false,

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
            .fx-form-group.fx-toggle-group { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; background: rgba(0,0,0,0.1); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid transparent; transition: background-color 0.3s, border-color 0.3s; }
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
                this.draft[key] = val;
                if(this._container) this.renderActiveTab(this._container.querySelector('.fx-settings-content'), this.activeTab);
            },
            requestReload: () => { this.pendingReload = true; },
            createControl: (label, type, key, opts = {}) => {
                let val = this.draft[key] !== undefined ? this.draft[key] : state.get().settings[key];
                if (key === 'ui_scale' && val === '1') val = '1.0';
                
                let input;
                if (type === 'select') {
                    input = h('select', { class: 'fx-select', onChange: (e) => fluxide.settings.set(key, e.target.value) }, 
                        opts.options.map(o => typeof o === 'string' ? h('option', { value: o, selected: o === val }, o) : h('option', { value: o.value, selected: o.value === val }, o.label)));
                } else if (type === 'slider') {
                    input = h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
                        h('input', { type: 'range', min: opts.min || 0, max: opts.max || 100, step: opts.step || 1, value: val, class: 'fx-slider', onInput: (e) => { e.target.nextSibling.innerText = e.target.value; fluxide.settings.set(key, e.target.value); } }),
                        h('span', { style: { fontSize: '12px', width: '30px', color: 'var(--text)' } }, val)
                    ]);
                } else if (type === 'toggle') {
                    input = h('label', { class: 'fx-toggle' }, [
                        h('input', { type: 'checkbox', checked: val === 'true', onChange: (e) => fluxide.settings.set(key, e.target.checked ? 'true' : 'false') }),
                        h('span', { class: 'fx-toggle-slider' })
                    ]);
                    return h('div', { class: 'fx-form-group fx-toggle-group' }, [ h('label', { class: 'fx-form-label', style: { marginBottom: 0, color: 'var(--text-dim)' } }, label), input ]);
                } else {
                    input = h('input', { class: 'fx-input', type, ...opts, value: val, onChange: (e) => fluxide.settings.set(key, e.target.value) });
                }
                return h('div', { class: 'fx-form-group', style: { marginBottom: '20px' } }, [ h('label', { class: 'fx-form-label', style: { color: 'var(--text-dim)' } }, label), input ]);
            }
        });

        setTimeout(() => {
            const status = document.getElementById('fx-status');
            if(status && !document.getElementById('settings-nav-btn')) {
                const btn = h('button', { 
                    id: 'settings-nav-btn',
                    class: 'fx-icon-btn', 
                    style: { width: '28px', height: '28px', marginLeft: 'auto' },
                    innerHTML: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
                    onClick: () => this.openModal() 
                });
                status.style.display = 'flex';
                status.style.width = '100%';
                status.appendChild(btn);
            }
        }, 100);

        fluxide.settings.register('appearance.general', {
            label: 'General UI',
            defaults: { ui_scale: '1.0', theme: 'dracula', icon_pack: 'default' }
        });
        fluxide.settings.register('appearance.keybinds', { label: 'Keybindings' });
        
        on('settings:render:appearance.general', ({container}) => {
            container.appendChild(h('h2', { style: { marginTop: 0, marginBottom: '24px', fontSize: '20px', color: 'var(--text)' } }, 'General UI'));
            
            const themes = [];
            const iconPacks = [];
            Object.keys(state.get().vfs).forEach(p => {
                if(p.startsWith('themes/') && p.endsWith('/theme.json')) {
                    try {
                        const m = JSON.parse(state.get().vfs[p]);
                        themes.push({value: p.split('/')[1], label: m.name || p.split('/')[1]});
                    } catch(e) {}
                }
                if(p.startsWith('icon-packs/') && p.endsWith('/main.json')) {
                    try {
                        const m = JSON.parse(state.get().vfs[p]);
                        iconPacks.push({value: p.split('/')[1], label: m.name || p.split('/')[1]});
                    } catch(e) {}
                }
            });

            container.appendChild(fluxide.settings.createControl('Theme', 'select', 'theme', { options: themes }));
            container.appendChild(fluxide.settings.createControl('Icon Pack', 'select', 'icon_pack', { options: iconPacks }));
            container.appendChild(fluxide.settings.createControl('UI Scale', 'select', 'ui_scale', { options: [{value:'0.75',label:'75%'},{value:'0.9',label:'90%'},{value:'1.0',label:'100%'},{value:'1.1',label:'110%'},{value:'1.25',label:'125%'},{value:'1.5',label:'150%'}] }));
        });

        const updateScale = (val) => {
            let style = document.getElementById('fx-ui-scale');
            if (!style) { style = document.createElement('style'); style.id = 'fx-ui-scale'; document.head.appendChild(style); }
            style.innerHTML = `
                #ide-sidebar, #ide-tabs, .fx-console, #fx-status, #fx-nav, .fx-settings-sidebar, .fx-modal-window { zoom: ${val}; }
                #ide-editor .CodeMirror { font-size: calc(${val} * var(--editor-font-size, 14px)); }
            `;
            emit('ui:scale');
        };

        on('settings:change', ({key, val}) => {
            if (key === 'ui_scale') {
                updateScale(val);
            }
            if (key === 'theme') {
                if (fluxide.theme) fluxide.theme.applyTheme(val);
            }
            if (key === 'icon_pack') {
                this.pendingReload = true;
            }
        });

        setTimeout(() => {
            let scale = state.get().settings.ui_scale || '1.0';
            if (scale === '1') scale = '1.0';
            updateScale(scale);
        }, 200);
    },

    openModal() {
        if (!this.activeTab && this.tree.length > 0) {
            const findFirst = (n) => (n.config || !n.children.length) ? n.id : findFirst(n.children[0]);
            this.activeTab = findFirst(this.tree[0]);
        }
        this.draft = JSON.parse(JSON.stringify(state.get().settings));
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

        const sidebar = h('div', { class: 'fx-settings-sidebar', style: { borderRight: '1px solid var(--border)', background: 'var(--surface-low)', overflowY: 'auto', transition: 'background-color 0.3s, border-color 0.3s' } }, [
            h('div', { class: 'fx-settings-header', style: { padding: '20px', fontSize: '11px', fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '1px' } }, 'SETTINGS'),
            h('div', { class: 'fx-settings-tree' }, this.renderTree(this.tree, 0))
        ]);

        const contentWrap = h('div', { style: { display: 'flex', flexDirection: 'column', background: 'var(--bg)', position: 'relative', overflow: 'hidden', transition: 'background-color 0.3s' } });
        const closeBtn = h('button', { class: 'fx-icon-btn', style: { position: 'absolute', top: '15px', right: '15px', width: '32px', height: '32px', zIndex: 10 }, innerHTML: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>', onClick: () => { emit('settings:cancel'); modal.close(); } });
        
        const content = h('div', { class: 'fx-settings-content', style: { padding: '40px', overflowY: 'auto', flex: 1 } });
        this.renderActiveTab(content, this.activeTab);

        const footer = h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '20px 32px', background: 'var(--surface-low)', borderTop: '1px solid var(--border)' } }, [
            h('button', { class: 'fx-btn', style: { padding: '10px 24px', fontSize: '13px' }, onClick: () => { emit('settings:cancel'); modal.close(); } }, 'Cancel'),
            h('button', { class: 'fx-btn fx-btn-primary', style: { padding: '10px 24px', fontSize: '13px' }, onClick: async (e) => {
                const originalText = e.target.innerText;
                e.target.innerText = 'Applying...';
                e.target.disabled = true;
                Object.keys(this.draft).forEach(k => {
                    if (this.draft[k] !== state.get().settings[k]) {
                        state.update(s => s.settings[k] = this.draft[k]);
                        emit('settings:change', { key: k, val: this.draft[k] });
                    }
                });
                await emitAsync('settings:apply');
                if (this.pendingReload) {
                    setTimeout(() => location.reload(), 200);
                } else {
                    e.target.innerText = originalText;
                    e.target.disabled = false;
                }
            }}, 'Apply Changes')
        ]);

        contentWrap.appendChild(closeBtn);
        contentWrap.appendChild(content);
        contentWrap.appendChild(footer);

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
                style: { paddingLeft: (depth * 14 + 12) + 'px', padding: '8px 12px 8px ' + (depth * 14 + 12) + 'px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: isActive ? 'var(--text)' : 'var(--text-dim)', background: isActive ? 'var(--accent-glow)' : 'transparent', borderRadius: 'var(--radius-sm)', margin: '0 10px 2px 10px', transition: 'background-color 0.2s, color 0.2s' },
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
        if (!container) return;
        container.innerHTML = '';
        const values = this.draft;

        if (id === 'appearance.keybinds') {
            container.appendChild(h('h2', { style: { marginTop: 0, marginBottom: '24px', fontSize: '20px', color: 'var(--text)' } }, 'Keybindings'));
            fluxide.keybinds.getAll().forEach(kb => {
                let currentKey = kb.key;
                let recording = false;

                const renderModifiers = (keysStr) => {
                    const p = keysStr.split('-');
                    const btn = (lbl, active) => h('div', { style: { padding: '4px 8px', fontSize: '11px', background: active ? 'var(--accent)' : 'var(--surface-high)', color: active ? 'var(--bg)' : 'var(--text-dim)', borderRadius: '4px', cursor: 'pointer', transition: 'background-color 0.2s, color 0.2s', fontWeight: 600 }, onClick: () => {
                        if(recording) return;
                        let np = [...p];
                        if(active) np = np.filter(x => x !== lbl); else { if(!np.includes(lbl)) np.unshift(lbl); }
                        const nw = np.join('-');
                        fluxide.keybinds.register(kb.id, nw, kb.action, kb.description);
                        btnGroup.parentElement.replaceChild(renderModifiers(nw), btnGroup);
                    }}, lbl);
                    const mainKey = p.filter(x => !['Ctrl','Shift','Alt'].includes(x))[0] || '';
                    const btnGroup = h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, [
                        btn('Ctrl', p.includes('Ctrl')), btn('Shift', p.includes('Shift')), btn('Alt', p.includes('Alt')),
                        h('button', { class: 'fx-btn', style: { marginLeft: '10px', minWidth: '70px', textAlign: 'center', padding: '4px 12px', fontSize: '11px' }, onClick: (e) => {
                            if(recording) return; recording = true; e.target.innerText = 'Press key...';
                            const hndl = (ke) => {
                                ke.preventDefault(); ke.stopPropagation();
                                if(!['Control','Shift','Alt','Meta'].includes(ke.key)) {
                                    const k = ke.key.length === 1 ? ke.key.toUpperCase() : ke.key;
                                    let np = p.filter(x => ['Ctrl','Shift','Alt'].includes(x));
                                    np.push(k); const nw = np.join('-');
                                    fluxide.keybinds.register(kb.id, nw, kb.action, kb.description);
                                    document.removeEventListener('keydown', hndl, true);
                                    btnGroup.parentElement.replaceChild(renderModifiers(nw), btnGroup);
                                }
                            };
                            document.addEventListener('keydown', hndl, true);
                        }}, mainKey || 'None')
                    ]);
                    return btnGroup;
                };

                const row = h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border)', transition: 'border-color 0.3s' } }, [
                    h('div', {}, [ h('div', { style: { fontWeight: 600, fontSize: '14px', marginBottom: '6px', color: 'var(--text)' } }, kb.description), h('div', { style: { fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-code)' } }, kb.id) ]),
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