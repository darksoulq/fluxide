const { h } = fluxide.ui;
const { state, on, expose, fs } = fluxide;

fluxide.register({
    id: 'manager',
    init() {
        fluxide.settings.register('extra.manager', {
            label: 'Extension Manager'
        });

        let pendingActions = [];
        let viewingItem = null;
        let activeTab = 'installed';

        on('settings:apply', async () => {
            if (pendingActions.length > 0) fluxide.settings.requestReload();
            for (const action of pendingActions) {
                if (action.type === 'delete') {
                    Object.keys(state.get().vfs).forEach(async p => {
                        if (p.startsWith(action.path + '/')) { await fs.remove(p); }
                    });
                }
            }
            pendingActions = [];
        });

        on('settings:cancel', () => { pendingActions = []; });

        on('settings:render:extra.manager', ({container}) => {
            const renderUI = async () => {
                container.innerHTML = '';
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                container.style.height = '100%';
                
                const header = h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexShrink: 0 } }, [
                    h('h2', { style: { margin: 0, fontSize: '24px', color: 'var(--text)' } }, viewingItem ? viewingItem.name : 'Extension Manager'),
                    !viewingItem ? h('div', { style: { display: 'flex', gap: '8px', background: 'var(--surface)', padding: '6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' } }, [
                        h('button', { class: 'fx-btn' + (activeTab === 'installed' ? ' fx-btn-primary' : ''), style: { border: 'none', background: activeTab === 'installed' ? 'var(--accent)' : 'transparent', color: activeTab === 'installed' ? '#fff' : 'var(--text-dim)', padding: '8px 16px' }, onClick: () => { activeTab = 'installed'; renderUI(); } }, 'Installed'),
                        h('button', { class: 'fx-btn' + (activeTab === 'market' ? ' fx-btn-primary' : ''), style: { border: 'none', background: activeTab === 'market' ? 'var(--accent)' : 'transparent', color: activeTab === 'market' ? '#fff' : 'var(--text-dim)', padding: '8px 16px' }, onClick: () => { activeTab = 'market'; renderUI(); } }, 'Marketplace')
                    ]) : h('button', { class: 'fx-btn', style: { padding: '8px 16px' }, onClick: () => { viewingItem = null; renderUI(); } }, 'Back to Results')
                ]);
                
                container.appendChild(header);

                const contentArea = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1, paddingRight: '10px', paddingBottom: '20px' } });
                container.appendChild(contentArea);

                if (viewingItem && activeTab === 'market') {
                    contentArea.innerHTML = '<div style="color: var(--text-dim); padding: 40px; text-align: center;">Loading details...</div>';
                    try {
                        const res = await fetch(`https://darksoulq.pythonanywhere.com/api/items/${viewingItem.id}`);
                        if (!res.ok) throw new Error('Network error');
                        const data = await res.json();
                        
                        contentArea.innerHTML = '';
                        
                        const installCard = h('div', { style: { background: 'var(--surface-low)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '32px' } }, [
                            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', borderBottom: '1px solid var(--border)', paddingBottom: '24px' } }, [
                                h('div', { style: { display: 'flex', gap: '20px', alignItems: 'center' } }, [
                                    h('div', { style: { width: '80px', height: '80px', fontSize: '32px', borderRadius: '16px', background: 'var(--surface-high)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', flexShrink: 0 } }, data.name.substring(0,1).toUpperCase()),
                                    h('div', {}, [
                                        h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' } }, [
                                            h('h3', { style: { margin: 0, fontSize: '24px', color: 'var(--text)' } }, data.name),
                                            h('span', { class: `badge badge-${data.type}` }, data.type.replace('_', ' '))
                                        ]),
                                        h('div', { style: { fontSize: '14px', color: 'var(--text-dim)' } }, `By ${data.author}`)
                                    ])
                                ]),
                                h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } }, [
                                    h('select', { id: 'version-select', class: 'fx-select', style: { width: '140px', marginBottom: 0 } }, 
                                        data.versions.map(v => h('option', { value: v.id }, `v${v.version}`))
                                    ),
                                    h('button', { class: 'fx-btn fx-btn-primary', style: { padding: '10px 24px', fontSize: '14px' }, onClick: async (e) => {
                                        const btn = e.target;
                                        const vid = document.getElementById('version-select').value;
                                        const btnParent = btn.parentElement;
                                        
                                        const pBarContainer = h('div', { style: { width: '100px', height: '8px', background: 'var(--surface-high)', borderRadius: '4px', overflow: 'hidden' } });
                                        const pBar = h('div', { style: { width: '0%', height: '100%', background: 'var(--accent)', transition: 'width 0.1s linear' } });
                                        pBarContainer.appendChild(pBar);
                                        btnParent.replaceChild(pBarContainer, btn);

                                        try {
                                            const zipRes = await fetch(`https://darksoulq.pythonanywhere.com/api/versions/${vid}/download`);
                                            const arrayBuffer = await zipRes.arrayBuffer();
                                            const zip = await JSZip.loadAsync(arrayBuffer);
                                            const files = Object.values(zip.files);
                                            
                                            let rootFolder = '';
                                            let metaName = data.type === 'plugin' ? 'plugin.json' : (data.type === 'theme' ? 'theme.json' : 'main.json');
                                            const pJson = files.find(f => f.name.endsWith(metaName));
                                            if (pJson) rootFolder = pJson.name.substring(0, pJson.name.length - metaName.length);
                                            let basePath = data.type === 'plugin' ? 'plugins' : (data.type === 'theme' ? 'themes' : 'icon-packs');
                                            
                                            let i = 0;
                                            for (let zf of files) {
                                                if (zf.dir) continue;
                                                if (zf.name.startsWith(rootFolder)) {
                                                    const relPath = zf.name.substring(rootFolder.length);
                                                    const content = await zf.async('string');
                                                    await fs.write(`${basePath}/${data.item_id}/${relPath}`, content);
                                                }
                                                i++;
                                                pBar.style.width = ((i / files.length) * 100) + '%';
                                            }
                                            fluxide.ide?.log(`Installed ${data.name} from Market. Reloading...`, 'success');
                                            setTimeout(() => location.reload(), 500);
                                        } catch(err) {
                                            btn.innerText = 'Failed';
                                            btnParent.replaceChild(btn, pBarContainer);
                                            fluxide.ide?.log(`Failed to install: ${err}`, 'error');
                                        }
                                    }}, 'Install')
                                ])
                            ]),
                            h('div', { class: 'prose', style: { fontSize: '15px', lineHeight: '1.7', color: 'var(--text)' }, innerHTML: fluxide.ui.markdown(data.description_md || '*No description provided.*') })
                        ]);
                        contentArea.appendChild(installCard);
                        
                    } catch(err) {
                        contentArea.innerHTML = `<div style="color: var(--danger); padding: 40px; text-align: center;">Failed to load item details.</div>`;
                    }
                    
                } else if (activeTab === 'installed') {
                    const vfs = state.get().vfs;
                    const extensions = [];

                    Object.keys(vfs).forEach(p => {
                        if (p.startsWith('plugins/') && p.endsWith('/plugin.json')) {
                            try {
                                const data = JSON.parse(vfs[p]);
                                const dir = p.substring(0, p.lastIndexOf('/'));
                                extensions.push({ type: 'plugin', path: dir, id: data.id || dir.split('/')[1], name: data.name || data.id, version: data.version || '1.0.0', author: data.author || 'Unknown', desc: data.description || 'No description provided.' });
                            } catch(e) {}
                        }
                        if (p.startsWith('themes/') && p.endsWith('/theme.json')) {
                            try {
                                const data = JSON.parse(vfs[p]);
                                const dir = p.substring(0, p.lastIndexOf('/'));
                                extensions.push({ type: 'theme', path: dir, id: data.id || dir.split('/')[1], name: data.name || data.id, version: data.version || '1.0.0', author: data.author || 'Unknown', desc: data.description || 'Theme' });
                            } catch(e) {}
                        }
                        if (p.startsWith('icon-packs/') && p.endsWith('/main.json')) {
                            try {
                                const data = JSON.parse(vfs[p]);
                                const dir = p.substring(0, p.lastIndexOf('/'));
                                extensions.push({ type: 'icon-pack', path: dir, id: data.id || dir.split('/')[1], name: data.name || data.id, version: data.version || '1.0.0', author: data.author || 'Unknown', desc: data.description || 'Icon Pack' });
                            } catch(e) {}
                        }
                    });

                    const importInput = h('input', {
                        type: 'file', accept: '.zip', style: { display: 'none' },
                        onChange: async (e) => {
                            const file = e.target.files[0];
                            if(!file) return;
                            if (file.name.endsWith('.zip')) {
                                const pBarContainer = h('div', { style: { width: '100%', height: '4px', background: 'var(--surface-high)', borderRadius: '2px', overflow: 'hidden', margin: '20px 0 10px 0' } });
                                const pBar = h('div', { style: { width: '0%', height: '100%', background: 'var(--accent)', transition: 'width 0.1s linear' } });
                                pBarContainer.appendChild(pBar);
                                const pText = h('div', { style: { fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-code)' } }, 'Extracting...');

                                fluxide.ui.modal(win => {
                                    win.appendChild(h('div', { class: 'fx-modal-body', style: { textAlign: 'center', padding: '40px', color: 'var(--text)' } }, [
                                        h('h3', { style: { marginTop: 0, marginBottom: '10px' } }, 'Installing Package...'),
                                        pBarContainer,
                                        pText
                                    ]));
                                });

                                try {
                                    const zip = await JSZip.loadAsync(file);
                                    const files = Object.values(zip.files);
                                    const pJson = files.find(f => f.name.endsWith('plugin.json') || f.name.endsWith('theme.json') || f.name.endsWith('main.json'));
                                    if (pJson) {
                                        const metaName = pJson.name.split('/').pop();
                                        const metaContent = await pJson.async('string');
                                        const metaData = JSON.parse(metaContent);
                                        const itemId = metaData.id || metaData.name.toLowerCase().replace(/\s+/g, '_');
                                        const rootFolder = pJson.name.substring(0, pJson.name.length - metaName.length);
                                        const typeFolder = metaName === 'plugin.json' ? 'plugins' : (metaName === 'theme.json' ? 'themes' : 'icon-packs');
                                        
                                        let i = 0;
                                        for (let zf of files) {
                                            if (zf.dir) continue;
                                            if (zf.name.startsWith(rootFolder)) {
                                                const relPath = zf.name.substring(rootFolder.length);
                                                const content = await zf.async('string');
                                                await fs.write(`${typeFolder}/${itemId}/${relPath}`, content);
                                            }
                                            i++;
                                            pBar.style.width = ((i / files.length) * 100) + '%';
                                        }
                                        pText.innerText = 'Reloading...';
                                        setTimeout(() => location.reload(), 500);
                                    } else {
                                        fluxide.ui.modal.close();
                                        fluxide.ide?.log('Invalid zip (missing meta file)', 'error');
                                    }
                                } catch(err) {
                                    fluxide.ui.modal.close();
                                    fluxide.ide?.log('Failed to extract ZIP', 'error');
                                }
                            }
                        }
                    });

                    contentArea.appendChild(h('div', { style: { display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' } }, [
                        importInput,
                        h('button', { class: 'fx-btn', style: { padding: '8px 16px' }, onClick: () => importInput.click() }, 'Import Package (.zip)')
                    ]));

                    extensions.sort((a,b) => a.type.localeCompare(b.type)).forEach(ext => {
                        const isQueuedDelete = pendingActions.some(a => a.type === 'delete' && a.path === ext.path);
                        const card = h('div', { style: { background: 'var(--surface-low)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'border-color 0.3s', opacity: isQueuedDelete ? '0.5' : '1' } }, [
                            h('div', { style: { display: 'flex', gap: '20px', alignItems: 'center' } }, [
                                h('div', { style: { width: '48px', height: '48px', fontSize: '20px', borderRadius: '8px', background: 'var(--surface-high)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' } }, ext.name.substring(0,1).toUpperCase()),
                                h('div', {}, [
                                    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' } }, [
                                        h('span', { style: { fontWeight: 600, fontSize: '15px', color: 'var(--text)' } }, ext.name),
                                        h('span', { class: `badge badge-${ext.type.replace('-', '_')}` }, ext.type),
                                        h('span', { style: { fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-code)' } }, 'v' + ext.version)
                                    ]),
                                    h('div', { style: { fontSize: '12px', color: 'var(--text-dim)' } }, `By ${ext.author}`)
                                ])
                            ]),
                            h('div', { style: { display: 'flex', gap: '8px' } }, [
                                h('button', { class: 'fx-btn', style: { padding: '8px 16px' }, disabled: isQueuedDelete, onClick: async () => {
                                    if(!window.JSZip) return;
                                    const zip = new JSZip();
                                    Object.keys(vfs).forEach(p => {
                                        if(p.startsWith(ext.path + '/') && !p.endsWith('/.keep')) {
                                            zip.file(p.substring(ext.path.length + 1), vfs[p]);
                                        }
                                    });
                                    const blob = await zip.generateAsync({ type: 'blob' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a'); a.href = url; a.download = `${ext.id}_${ext.version}.zip`; a.click(); URL.revokeObjectURL(url);
                                }}, 'Export'),
                                h('button', { class: 'fx-btn', disabled: isQueuedDelete, style: { padding: '8px 16px', color: isQueuedDelete ? 'var(--text-dim)' : 'var(--danger)', borderColor: isQueuedDelete ? 'var(--border)' : 'var(--danger-border)' }, onClick: () => {
                                    if (ext.id === 'manager' || ext.id === 'ide') return;
                                    pendingActions.push({ type: 'delete', path: ext.path, name: ext.name });
                                    renderUI();
                                }}, isQueuedDelete ? 'Queued' : 'Uninstall')
                            ])
                        ]);
                        contentArea.appendChild(card);
                    });
                } else if (activeTab === 'market') {
                    contentArea.innerHTML = '<div style="color: var(--text-dim); padding: 40px; text-align: center;">Fetching Market Data...</div>';
                    try {
                        const res = await fetch('https://darksoulq.pythonanywhere.com/api/items');
                        if (!res.ok) throw new Error('Network error');
                        const data = await res.json();
                        
                        contentArea.innerHTML = '';
                        if (data.items.length === 0) {
                            contentArea.innerHTML = '<div style="color: var(--text-dim); padding: 40px; text-align: center;">No items available in the market yet.</div>';
                        }
                        
                        data.items.forEach(ext => {
                            let isInstalled = false;
                            if (ext.type === 'plugin') isInstalled = Object.keys(state.get().vfs).some(p => p === `plugins/${ext.item_id}/plugin.json`);
                            else if (ext.type === 'theme') isInstalled = Object.keys(state.get().vfs).some(p => p === `themes/${ext.item_id}/theme.json`);
                            else if (ext.type === 'icon_pack') isInstalled = Object.keys(state.get().vfs).some(p => p === `icon-packs/${ext.item_id}/main.json`);

                            const card = h('div', { style: { background: 'var(--surface-low)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', gap: '20px', alignItems: 'flex-start', padding: '24px', transition: 'transform 0.2s, border-color 0.2s' },
                                onMouseOver: (e) => e.currentTarget.style.borderColor = 'var(--accent)',
                                onMouseOut: (e) => e.currentTarget.style.borderColor = 'var(--border)',
                                onClick: () => { viewingItem = ext; renderUI(); } }, [
                                h('div', { style: { width: '64px', height: '64px', fontSize: '28px', borderRadius: '16px', background: 'var(--surface-high)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', flexShrink: 0 } }, ext.name.substring(0,1).toUpperCase()),
                                h('div', { style: { flex: 1, minWidth: 0 } }, [
                                    h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' } }, [
                                        h('span', { style: { fontWeight: 700, fontSize: '18px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, ext.name),
                                        h('span', { class: `badge badge-${ext.type}` }, ext.type.replace('_', ' '))
                                    ]),
                                    h('div', { style: { fontSize: '14px', color: 'var(--text-dim)', marginBottom: '16px', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.5' }, innerHTML: fluxide.ui.markdown(ext.description_md || '').replace(/<[^>]*>?/gm, '') }),
                                    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' } }, [
                                        h('div', { style: { fontSize: '13px', color: 'var(--text-dim)' } }, `By ${ext.author}`),
                                        isInstalled ? h('span', { style: { fontSize: '13px', color: 'var(--text-dim)' } }, 'Installed') : h('span', {})
                                    ])
                                ])
                            ]);
                            contentArea.appendChild(card);
                        });
                        
                    } catch (err) {
                        contentArea.innerHTML = `<div style="color: var(--danger); padding: 40px; text-align: center;">Failed to connect to Fluxide Market.</div>`;
                    }
                }

                if (pendingActions.length > 0) {
                    const notice = h('div', { style: { background: 'var(--accent-glow)', padding: '16px 24px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent)', color: 'var(--text)', fontSize: '14px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 } }, [
                        h('span', {}, `${pendingActions.length} action(s) queued. Apply changes in the main window to proceed.`),
                        h('button', { class: 'fx-btn', style: { padding: '6px 12px', fontSize: '12px', background: 'transparent', borderColor: 'var(--accent)' }, onClick: () => { pendingActions = []; renderUI(); } }, 'Clear Queue')
                    ]);
                    contentArea.appendChild(notice);
                }
            };

            renderUI();
        });
    }
});