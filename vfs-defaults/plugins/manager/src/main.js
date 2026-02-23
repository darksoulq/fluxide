const { h } = fluxide.ui;
const { state, fs, theme } = fluxide;
const API_BASE = "http://darksoulq.pythonanywhere.com";

const Manager = {
    _container: null,
    items: [],
    loading: true,
    searchQuery: '',
    activeItem: null,
    itemTab: 'details',
    itemData: null,
    needsReload: false,

    async init() {
        if (!document.getElementById('manager-styles')) {
            const style = document.createElement('style');
            style.id = 'manager-styles';
            style.innerHTML = `
                .mgr-btn { background: var(--surface-high); border: 1px solid transparent; color: var(--text); padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; font-family: var(--font); transition: 0.2s; }
                .mgr-btn:hover { background: var(--surface-hover); }
                .mgr-btn-primary { background: var(--accent); color: #fff; }
                .mgr-btn-danger { color: var(--danger); border-color: var(--danger-border); background: transparent; }
                .mgr-btn-warning { color: #fbbf24; border-color: #fbbf24; background: transparent; }
                .mgr-input { background: var(--bg); border: 1px solid var(--border); color: var(--text); padding: 10px 14px; border-radius: 6px; font-family: var(--font); font-size: 14px; width: 100%; box-sizing: border-box; }
                .mgr-input:focus { outline: none; border-color: var(--accent); }
                .mgr-card { background: var(--surface-low); border: 1px solid var(--border); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; transition: transform 0.2s; }
                .mgr-card:hover { transform: translateY(-2px); border-color: var(--surface-high); cursor: pointer; }
                .mgr-badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; background: var(--surface-high); color: var(--text-dim); }
                .mgr-badge-success { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid #10b981; }
                .mgr-badge-warning { background: rgba(251, 191, 36, 0.1); color: #fbbf24; border: 1px solid #fbbf24; }
                .mgr-tabs { display: flex; gap: 20px; border-bottom: 1px solid var(--surface-high); margin-bottom: 24px; }
                .mgr-tab { background: transparent; border: none; padding: 12px 0; color: var(--text-dim); font-size: 14px; font-weight: 600; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
                .mgr-tab.active { color: var(--text); border-color: var(--accent); }
                .mgr-md { color: var(--text-dim); font-size: 14px; line-height: 1.6; }
                .mgr-md h1, .mgr-md h2, .mgr-md h3 { color: var(--text); margin-top: 0; }
                .mgr-md pre { background: var(--surface-high); padding: 16px; border-radius: 6px; overflow: auto; border: 1px solid var(--border); }
                .mgr-md code { font-family: var(--font-code); font-size: 13px; }
                .mgr-doc-section { margin-bottom: 24px; }
                .mgr-doc-head { font-size: 16px; font-weight: 700; color: var(--text); margin: 0 0 12px 0; border-bottom: 1px solid var(--surface-high); padding-bottom: 8px; }
                .mgr-doc-page { border: 1px solid var(--border); border-radius: 6px; margin-bottom: 8px; background: var(--bg); overflow: hidden; }
                .mgr-doc-page-title { padding: 12px 16px; font-weight: 600; cursor: pointer; color: var(--text); display: flex; justify-content: space-between; user-select: none; }
                .mgr-doc-page-title:hover { background: var(--surface-high); }
                .mgr-doc-page-content { padding: 16px; border-top: 1px solid var(--border); display: none; }
            `;
            document.head.appendChild(style);
        }
        this.fetchItems();
    },

    async fetchItems() {
        this.loading = true;
        this.render();
        try {
            const res = await fetch(`${API_BASE}/api/items`);
            const data = await res.json();
            this.items = data.items || [];
        } catch(e) {}
        this.loading = false;
        this.render();
    },

    async fetchItemData(id) {
        try {
            const res = await fetch(`${API_BASE}/api/items/${id}`);
            this.itemData = await res.json();
        } catch(e) {}
        this.render();
    },

    getBaseDir(type, itemId) {
        if (type === 'theme') return `themes/${itemId}`;
        if (type === 'icon_pack') return `icon-packs/${itemId}`;
        return `plugins/${itemId}`;
    },

    getDisabledDir(type, itemId) {
        return `disabled/${itemId}`;
    },

    isInstalled(type, itemId) {
        const p = this.getBaseDir(type, itemId);
        return state.get().vfs[`${p}/plugin.json`] || state.get().vfs[`${p}/theme.json`] || state.get().vfs[`${p}/main.json`];
    },

    isDisabled(type, itemId) {
        const p = this.getDisabledDir(type, itemId);
        return state.get().vfs[`${p}/plugin.json`] || state.get().vfs[`${p}/theme.json`] || state.get().vfs[`${p}/main.json`];
    },

    async install(item, versionId) {
        const btnId = `mgr-install-${item.id}`;
        const btn = document.getElementById(btnId);
        if (btn) btn.innerText = 'Installing...';
        
        try {
            const res = await fetch(`${API_BASE}/api/versions/${versionId}/extract`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            
            const base = this.getBaseDir(item.type, item.item_id);
            for (const [path, fileData] of Object.entries(data.files)) {
                const fullPath = `${base}/${path}`;
                if (fileData.binary) {
                    const binStr = atob(fileData.data);
                    const len = binStr.length;
                    const bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);
                    const ext = path.split('.').pop();
                    const blob = new Blob([bytes], { type: `application/${ext}` });
                    state.get().vfs[fullPath] = blob;
                    await fs.write(fullPath, blob);
                } else {
                    state.get().vfs[fullPath] = fileData.data;
                    await fs.write(fullPath, fileData.data);
                }
            }
            this.needsReload = true;
            if(fluxide.ide) fluxide.ide.log(`Installed ${item.name}`, 'success');
        } catch(e) {}
        this.render();
        fluxide.requireReload();
    },

    async uninstall(item) {
        const base = this.getBaseDir(item.type, item.item_id);
        const dis = this.getDisabledDir(item.type, item.item_id);
        
        for (const p of [base, dis]) {
            Object.keys(state.get().vfs).forEach(k => {
                if (k.startsWith(`${p}/`)) delete state.get().vfs[k];
            });
            await fs.remove(p);
        }
        this.needsReload = true;
        if(fluxide.ide) fluxide.ide.log(`Uninstalled ${item.name}`, 'info');
        this.render();
        fluxide.requireReload();
    },

    async toggleDisable(item) {
        const isDis = this.isDisabled(item.type, item.item_id);
        const source = isDis ? this.getDisabledDir(item.type, item.item_id) : this.getBaseDir(item.type, item.item_id);
        const target = isDis ? this.getBaseDir(item.type, item.item_id) : this.getDisabledDir(item.type, item.item_id);
        
        const pathsToMove = Object.keys(state.get().vfs).filter(k => k.startsWith(`${source}/`));
        for (const p of pathsToMove) {
            const newPath = p.replace(`${source}/`, `${target}/`);
            state.get().vfs[newPath] = state.get().vfs[p];
            await fs.write(newPath, state.get().vfs[p]);
            delete state.get().vfs[p];
        }
        await fs.remove(source);
        
        this.needsReload = true;
        if(fluxide.ide) fluxide.ide.log(`${item.name} ${isDis ? 'enabled' : 'disabled'}`, 'info');
        this.render();
        fluxide.requireReload();
    },

    renderGrid() {
        if (this.loading) return h('div', { style: { color: 'var(--text-dim)' } }, 'Loading marketplace...');

        const q = this.searchQuery.toLowerCase();
        const filtered = this.items.filter(i => 
            i.name.toLowerCase().includes(q) || 
            i.author.toLowerCase().includes(q) ||
            i.type.toLowerCase().includes(q)
        );

        if (filtered.length === 0) return h('div', { style: { color: 'var(--text-dim)', textAlign: 'center', padding: '40px' } }, 'No extensions found.');

        const cards = filtered.map(item => {
            const installed = this.isInstalled(item.type, item.item_id);
            const disabled = this.isDisabled(item.type, item.item_id);
            
            const badges = [];
            if (installed) badges.push(h('span', { class: 'mgr-badge mgr-badge-success' }, 'Installed'));
            if (disabled) badges.push(h('span', { class: 'mgr-badge mgr-badge-warning' }, 'Disabled'));

            const card = h('div', { class: 'mgr-card' }, [
                h('div', { style: { display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' } }, [
                    h('div', { style: { width: '48px', height: '48px', borderRadius: '50%', background: 'var(--surface-high)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800, border: '1px solid var(--border)' } }, item.name.substring(0,2).toUpperCase()),
                    h('div', { style: { flex: 1, minWidth: 0 } }, [
                        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
                            h('h3', { style: { margin: 0, fontSize: '16px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, item.name),
                            ...badges
                        ]),
                        h('div', { style: { fontSize: '12px', color: 'var(--text-dim)' } }, `by ${item.author}`)
                    ])
                ]),
                h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' } }, [
                    h('span', { class: 'mgr-badge' }, item.type.replace('_', ' ')),
                    h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } }, [
                        h('span', { style: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-dim)' } }, [
                            h('span', { style: { color: 'var(--accent)' }, innerHTML: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>' }),
                            item.upvotes || 0
                        ]),
                        h('span', { style: { fontSize: '12px', color: 'var(--text-dark)', fontFamily: 'var(--font-code)' } }, `v${item.version}`)
                    ])
                ])
            ]);
            
            card.onclick = () => {
                this.activeItem = item;
                this.itemTab = 'details';
                this.itemData = null;
                this.fetchItemData(item.id);
                this.render();
            };
            return card;
        });

        return h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' } }, cards);
    },

    renderItemView() {
        if (!this.activeItem) return h('div');
        const i = this.activeItem;
        const d = this.itemData;

        const installed = this.isInstalled(i.type, i.item_id);
        const disabled = this.isDisabled(i.type, i.item_id);
        
        const actions = [];
        if (this.needsReload && (installed || disabled)) {
            actions.push(h('button', { class: 'mgr-btn mgr-btn-warning', onClick: () => fluxide.requireReload() }, 'Reload Required'));
        } else if (installed || disabled) {
            actions.push(h('button', { class: 'mgr-btn', onClick: () => this.toggleDisable(i) }, disabled ? 'Enable' : 'Disable'));
            actions.push(h('button', { class: 'mgr-btn mgr-btn-danger', onClick: () => this.uninstall(i) }, 'Uninstall'));
        } else {
            actions.push(h('button', { id: `mgr-install-${i.id}`, class: 'mgr-btn mgr-btn-primary', onClick: () => {
                if (d && d.versions && d.versions.length > 0) this.install(i, d.versions[0].id);
            }}, 'Install'));
        }

        const head = h('div', { style: { display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid var(--surface-high)' } }, [
            h('button', { class: 'mgr-btn', style: { padding: '8px 12px' }, onClick: () => { this.activeItem = null; this.render(); } }, '←'),
            h('div', { style: { width: '64px', height: '64px', borderRadius: '50%', background: 'var(--surface-high)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 800, border: '1px solid var(--border)' } }, i.name.substring(0,2).toUpperCase()),
            h('div', { style: { flex: 1 } }, [
                h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '4px' } }, [
                    h('h1', { style: { margin: 0, fontSize: '24px', color: 'var(--text)' } }, i.name),
                    h('span', { class: 'mgr-badge' }, i.type.replace('_', ' '))
                ]),
                h('div', { style: { color: 'var(--text-dim)', fontSize: '14px' } }, `by ${i.author} • ID: ${i.item_id}`)
            ]),
            h('div', { style: { display: 'flex', gap: '8px' } }, actions)
        ]);

        const tabsArray = [
            { id: 'details', label: 'Details' },
            { id: 'gallery', label: 'Gallery' },
            { id: 'versions', label: 'Versions' },
            { id: 'docs', label: 'Documentation' },
            { id: 'reviews', label: 'Reviews' }
        ];

        const tabsRow = h('div', { class: 'mgr-tabs' }, tabsArray.map(t => 
            h('button', { class: `mgr-tab ${this.itemTab === t.id ? 'active' : ''}`, onClick: () => { this.itemTab = t.id; this.render(); } }, t.label)
        ));

        let content = h('div', { style: { color: 'var(--text-dim)' } }, 'Loading data...');
        if (d) {
            if (this.itemTab === 'details') {
                const linksObj = JSON.parse(d.links_json || '{}');
                const linksHtml = Object.keys(linksObj).length > 0 ? Object.entries(linksObj).map(([k,v]) => h('a', { href: v, target: '_blank', style: { color: 'var(--accent)', display: 'block', marginBottom: '8px' } }, k)) : [h('div', { style: { color: 'var(--text-dim)' } }, 'No links.')];
                
                content = h('div', { style: { display: 'flex', gap: '32px', alignItems: 'flex-start' } }, [
                    h('div', { class: 'mgr-md', style: { flex: 3 }, innerHTML: fluxide.ui.markdown(d.description_md || '*No description provided.*') }),
                    h('div', { style: { flex: 1, background: 'var(--surface-low)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border)' } }, [
                        h('h4', { style: { margin: '0 0 16px 0', color: 'var(--text)' } }, 'Links'),
                        ...linksHtml
                    ])
                ]);
            } else if (this.itemTab === 'gallery') {
                const imgs = JSON.parse(d.gallery_json || '[]');
                if (imgs.length === 0) content = h('div', { style: { color: 'var(--text-dim)' } }, 'No gallery images.');
                else content = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' } }, imgs.map(url => h('img', { src: url, style: { width: '100%', borderRadius: '8px', border: '1px solid var(--border)' } })));
            } else if (this.itemTab === 'versions') {
                content = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } }, d.versions.map(v => 
                    h('div', { style: { background: 'var(--surface-low)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' } }, [
                        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
                            h('div', {}, [
                                h('h3', { style: { margin: '0 0 4px 0', color: 'var(--text)', fontSize: '16px' } }, `v${v.version}`),
                                h('div', { style: { fontSize: '12px', color: 'var(--text-dim)' } }, v.created_at.substring(0, 10))
                            ]),
                            h('div', { style: { display: 'flex', gap: '8px' } }, [
                                v.changelog ? h('button', { class: 'mgr-btn', onClick: () => {
                                    fluxide.ui.modal(win => {
                                        win.appendChild(h('div', { class: 'fx-modal-body', style: { padding: '24px' } }, [
                                            h('h3', { style: { marginTop: 0, color: 'var(--text)' } }, `Changelog v${v.version}`),
                                            h('div', { class: 'mgr-md', innerHTML: fluxide.ui.markdown(v.changelog) }),
                                            h('div', { style: { marginTop: '20px', textAlign: 'right' } }, [
                                                h('button', { class: 'mgr-btn mgr-btn-primary', onClick: () => fluxide.ui.modal.close() }, 'Close')
                                            ])
                                        ]));
                                    });
                                }}, 'Changelog') : h('span', {}),
                                installed ? h('button', { class: 'mgr-btn', onClick: () => this.install(i, v.id) }, 'Reinstall') : h('span', {})
                            ])
                        ])
                    ])
                ));
            } else if (this.itemTab === 'docs') {
                if (!d.docs || Object.keys(d.docs).length === 0) {
                    content = h('div', { style: { color: 'var(--text-dim)' } }, 'No documentation bundled.');
                } else {
                    let idx = { sections: [] };
                    try { idx = JSON.parse(d.docs['docs/index.json'] || '{}'); } catch(e){}
                    const secs = idx.sections || [];
                    content = h('div', {}, secs.map(sec => h('div', { class: 'mgr-doc-section' }, [
                        h('h3', { class: 'mgr-doc-head' }, sec.title),
                        ...sec.pages.map(p => h('div', { class: 'mgr-doc-page' }, [
                            h('div', { class: 'mgr-doc-page-title', onClick: (e) => {
                                const body = e.currentTarget.nextElementSibling;
                                body.style.display = body.style.display === 'block' ? 'none' : 'block';
                            }}, [ h('span', {}, p.title), h('span', { style: { fontSize: '10px' } }, '▼') ]),
                            h('div', { class: 'mgr-doc-page-content mgr-md', innerHTML: fluxide.ui.markdown(d.docs[`docs/${p.file}`] || '*Empty*') })
                        ]))
                    ])));
                }
            } else if (this.itemTab === 'reviews') {
                if (!d.reviews || d.reviews.length === 0) {
                    content = h('div', { style: { color: 'var(--text-dim)' } }, 'No reviews yet.');
                } else {
                    content = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } }, d.reviews.map(r => 
                        h('div', { style: { background: 'var(--surface-low)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' } }, [
                            h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' } }, [
                                h('span', { style: { fontWeight: 600, color: 'var(--text)' } }, r.username),
                                h('span', { style: { color: '#fbbf24' } }, '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating))
                            ]),
                            h('div', { style: { color: 'var(--text-dim)', fontSize: '14px' } }, r.comment)
                        ])
                    ));
                }
            }
        }

        return h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } }, [head, tabsRow, content]);
    },

    render(container = this._container) {
        if (!container) return;
        this._container = container;
        container.innerHTML = '';
        container.style.padding = '32px';
        container.style.overflowY = 'auto';

        if (this.activeItem) {
            container.appendChild(this.renderItemView());
        } else {
            const head = h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' } }, [
                h('h1', { style: { margin: 0, fontSize: '28px', color: 'var(--text)' } }, 'Marketplace'),
                h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 12px', width: '300px' } }, [
                    h('span', { style: { color: 'var(--text-dim)' }, innerHTML: theme.getIcon('search') }),
                    h('input', { 
                        class: 'mgr-input', placeholder: 'Search...', value: this.searchQuery, 
                        style: { border: 'none', padding: 0, background: 'transparent' },
                        onInput: (e) => { this.searchQuery = e.target.value; this.render(); }
                    })
                ])
            ]);

            container.appendChild(h('div', { style: { display: 'flex', flexDirection: 'column' } }, [head, this.renderGrid()]));
        }
    }
};

fluxide.register({
    id: 'manager',
    view: { id: 'manager', label: 'Market', nav: true, order: 2 },
    init() { Manager.init(); },
    render: (c) => Manager.render(c)
});