const { h } = fluxide.ui;
const { state, on, expose, fs, theme } = fluxide;

fluxide.register({
    id: 'manager',
    init() {
        fluxide.settings.register('extra.manager', {
            label: 'Extension Manager'
        });

        let pendingActions = [];
        let viewingItem = null;
        let activeTab = 'installed';
        let marketItems = [];
        let loadingMarket = false;
        let marketSearch = '';
        let detailsTab = 'details';

        on('settings:apply', async () => {
            if (pendingActions.length === 0) return;

            const actionsToProcess = [...pendingActions];
            pendingActions = [];

            fluxide.ui.modal(win => {
                win.innerHTML = '';
                const pText = h('div', { style: { marginBottom: '16px', color: 'var(--text)', fontSize: '15px', fontWeight: 600 } }, 'Applying changes...');
                const pBar = h('div', { style: { width: '0%', height: '100%', background: 'var(--accent)', transition: 'width 0.2s' } });
                
                win.appendChild(h('div', { class: 'fx-modal-body', style: { padding: '40px', textAlign: 'center' } }, [
                    pText,
                    h('div', { style: { height: '6px', width: '100%', background: 'var(--surface-high)', borderRadius: '3px', overflow: 'hidden' } }, [pBar])
                ]));

                (async () => {
                    let totalSteps = 0;
                    for (const a of actionsToProcess) {
                        if (a.type === 'install') {
                            totalSteps += Object.keys(a.files || {}).length;
                        } else {
                            totalSteps += Object.keys(state.get().vfs).filter(p => p.startsWith(a.path + '/')).length + 1;
                        }
                    }
                    let currentStep = 0;

                    for (let i = 0; i < actionsToProcess.length; i++) {
                        const action = actionsToProcess[i];
                        
                        if (action.type === 'install') {
                            pText.innerText = `Placing files for ${action.name || action.itemId}...`;
                            for (const [path, content] of Object.entries(action.files || {})) {
                                state.get().vfs[path] = content;
                                await fs.write(path, content);
                                currentStep++;
                                pBar.style.width = ((currentStep / Math.max(1, totalSteps)) * 100) + '%';
                            }
                        } else if (action.type === 'delete') {
                            pText.innerText = `Removing ${action.name || action.itemId}...`;
                            const pathsToDel = Object.keys(state.get().vfs).filter(p => p.startsWith(action.path + '/'));
                            for (const p of pathsToDel) {
                                delete state.get().vfs[p];
                                await fs.remove(p);
                                currentStep++;
                                pBar.style.width = ((currentStep / Math.max(1, totalSteps)) * 100) + '%';
                            }
                            await fs.remove(action.path);
                            currentStep++;
                            pBar.style.width = ((currentStep / Math.max(1, totalSteps)) * 100) + '%';
                        } else if (action.type === 'disable' || action.type === 'enable') {
                            pText.innerText = `${action.type === 'disable' ? 'Disabling' : 'Enabling'} ${action.name || action.itemId}...`;
                            const targetBase = action.type === 'disable' ? 'disabled' : (action.itemType === 'plugin' ? 'plugins' : (action.itemType === 'theme' ? 'themes' : 'icon-packs'));
                            const targetPath = `${targetBase}/${action.itemId}`;
                            const pathsToMove = Object.keys(state.get().vfs).filter(p => p.startsWith(action.path + '/'));
                            for (const p of pathsToMove) {
                                const newPath = p.replace(action.path, targetPath);
                                state.get().vfs[newPath] = state.get().vfs[p];
                                await fs.write(newPath, state.get().vfs[p]);
                                delete state.get().vfs[p];
                                await fs.remove(p);
                                currentStep++;
                                pBar.style.width = ((currentStep / Math.max(1, totalSteps)) * 100) + '%';
                            }
                            await fs.remove(action.path);
                            currentStep++;
                            pBar.style.width = ((currentStep / Math.max(1, totalSteps)) * 100) + '%';
                        }
                    }
                    
                    pText.innerText = 'Reloading IDE...';
                    pBar.style.width = '100%';
                    setTimeout(() => location.reload(), 500);
                })();
            });
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
                    if (!viewingItem._fetched) {
                        contentArea.innerHTML = '<div style="color: var(--text-dim); padding: 40px; text-align: center;">Loading details...</div>';
                        try {
                            const res = await fetch(`https://darksoulq.pythonanywhere.com/api/items/${viewingItem.id}`);
                            const data = await res.json();
                            Object.assign(viewingItem, data);
                            viewingItem._fetched = true;
                        } catch(e) {}
                        renderUI();
                        return;
                    }
                    
                    const data = viewingItem;
                    const vfsPaths = Object.keys(state.get().vfs);
                    const isInstalled = vfsPaths.some(p => p.startsWith(`plugins/${data.item_id}/`) || p.startsWith(`themes/${data.item_id}/`) || p.startsWith(`icon-packs/${data.item_id}/`));
                    const isDisabled = vfsPaths.some(p => p.startsWith(`disabled/${data.item_id}/`));
                    
                    const queuedInstall = pendingActions.find(a => a.type === 'install' && a.itemId === data.item_id);

                    const actionBtn = h('button', {
                        class: 'fx-btn' + (isInstalled || isDisabled || queuedInstall ? '' : ' fx-btn-primary'),
                        style: { padding: '10px 24px', fontSize: '14px', transition: '0.2s' },
                        disabled: isInstalled || isDisabled || queuedInstall,
                        onClick: async (e) => {
                            const btn = e.target;
                            const vid = document.getElementById('version-select').value;
                            
                            const pBarContainer = h('div', { style: { width: '100px', height: '8px', background: 'var(--surface-high)', borderRadius: '4px', overflow: 'hidden' } });
                            const pBar = h('div', { style: { width: '0%', height: '100%', background: 'var(--accent)', transition: 'width 0.1s linear' } });
                            pBarContainer.appendChild(pBar);
                            btn.parentNode.replaceChild(pBarContainer, btn);

                            try {
                                const zipRes = await fetch(`https://darksoulq.pythonanywhere.com/api/versions/${vid}/download`);
                                const arrayBuffer = await zipRes.arrayBuffer();
                                const zip = await window.JSZip.loadAsync(arrayBuffer);
                                const files = Object.values(zip.files);
                                
                                let rootFolder = '';
                                let metaName = data.type === 'plugin' ? 'plugin.json' : (data.type === 'theme' ? 'theme.json' : 'main.json');
                                const pJson = files.find(f => f.name.endsWith(metaName));
                                if (pJson) rootFolder = pJson.name.substring(0, pJson.name.length - metaName.length);
                                let basePath = data.type === 'plugin' ? 'plugins' : (data.type === 'theme' ? 'themes' : 'icon-packs');
                                
                                const preparedFiles = {};
                                let i = 0;
                                for (let zf of files) {
                                    if (zf.dir) continue;
                                    if (zf.name.startsWith(rootFolder)) {
                                        const relPath = zf.name.substring(rootFolder.length);
                                        const fullPath = `${basePath}/${data.item_id}/${relPath}`;
                                        const ext = zf.name.split('.').pop().toLowerCase();
                                        const isBin = ['png','jpg','jpeg','gif','webp','ico','mp4','webm','mp3','wav','ogg','zip','wasm','woff','woff2','ttf','otf','eot'].includes(ext);
                                        
                                        if (isBin) {
                                            preparedFiles[fullPath] = await zf.async('blob');
                                        } else {
                                            preparedFiles[fullPath] = await zf.async('string');
                                        }
                                    }
                                    i++;
                                    pBar.style.width = ((i / files.length) * 100) + '%';
                                }
                                
                                pendingActions.push({ type: 'install', name: data.name, itemType: data.type, itemId: data.item_id, files: preparedFiles });
                                renderUI();
                                
                            } catch(err) {
                                const errBtn = h('button', { class: 'fx-btn', disabled: true }, 'Failed');
                                pBarContainer.parentNode.replaceChild(errBtn, pBarContainer);
                            }
                        }
                    }, isInstalled || isDisabled ? 'Installed' : (queuedInstall ? 'Queued (Install)' : 'Install'));

                    const installCard = h('div', { style: { background: 'var(--surface-low)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '32px', marginBottom: '24px' } }, [
                        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } }, [
                            h('div', { style: { display: 'flex', gap: '20px', alignItems: 'center' } }, [
                                h('div', { style: { width: '80px', height: '80px', fontSize: '32px', borderRadius: '16px', background: 'var(--surface-high)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', flexShrink: 0 } }, data.name.substring(0,1).toUpperCase()),
                                h('div', {}, [
                                    h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' } }, [
                                        h('h3', { style: { margin: 0, fontSize: '24px', color: 'var(--text)' } }, data.name),
                                        h('span', { class: `badge badge-${data.type}`, style: { padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', background: 'var(--surface-high)', color: 'var(--text-dim)' } }, data.type.replace('_', ' '))
                                    ]),
                                    h('div', { style: { fontSize: '14px', color: 'var(--text-dim)' } }, `By ${data.author}`)
                                ])
                            ]),
                            h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } }, [
                                h('select', { id: 'version-select', class: 'fx-select', style: { width: '140px', marginBottom: 0 } }, 
                                    (data.versions || []).map(v => h('option', { value: v.id }, `v${v.version}`))
                                ),
                                actionBtn
                            ])
                        ])
                    ]);
                    
                    const tabBtn = (id, label) => h('button', {
                        style: { background: 'transparent', border: 'none', padding: '12px 16px', color: detailsTab === id ? 'var(--text)' : 'var(--text-dim)', borderBottom: detailsTab === id ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: '0.2s' },
                        onClick: () => { detailsTab = id; renderUI(); }
                    }, label);

                    const tabsHeader = h('div', { style: { display: 'flex', borderBottom: '1px solid var(--surface-high)', marginBottom: '24px' } }, [
                        tabBtn('details', 'Details'),
                        tabBtn('gallery', 'Gallery'),
                        tabBtn('versions', 'Versions'),
                        tabBtn('docs', 'Documentation'),
                        tabBtn('reviews', 'Reviews')
                    ]);

                    let tabContent = h('div');
                    
                    if (detailsTab === 'details') {
                        let linksHtml = [];
                        try {
                            const linksObj = JSON.parse(data.links_json || '{}');
                            linksHtml = Object.entries(linksObj).map(([k,v]) => h('a', { href: v, target: '_blank', style: { display: 'block', color: 'var(--accent)', textDecoration: 'none', marginBottom: '8px' } }, k));
                        } catch(e){}

                        tabContent = h('div', { style: { display: 'flex', gap: '32px' } }, [
                            h('div', { style: { flex: 3, color: 'var(--text)', lineHeight: '1.6', fontSize: '14px' }, innerHTML: fluxide.ui.markdown(data.description_md || '*No description.*') }),
                            h('div', { style: { flex: 1, background: 'var(--surface-low)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border)', alignSelf: 'flex-start' } }, [
                                h('h4', { style: { margin: '0 0 16px 0', color: 'var(--text)' } }, 'Links'),
                                ...linksHtml
                            ])
                        ]);
                    } else if (detailsTab === 'gallery') {
                        let imgs = [];
                        try { imgs = JSON.parse(data.gallery_json || '[]'); } catch(e){}
                        if (imgs.length === 0) tabContent = h('div', { style: { color: 'var(--text-dim)' } }, 'No gallery images.');
                        else tabContent = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' } }, imgs.map(url => h('img', { src: url, style: { width: '100%', borderRadius: '8px', border: '1px solid var(--border)' } })));
                    } else if (detailsTab === 'versions') {
                        tabContent = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } }, (data.versions||[]).map(v => 
                            h('div', { style: { background: 'var(--surface-low)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' } }, [
                                h('h3', { style: { margin: '0 0 4px 0', color: 'var(--text)', fontSize: '16px' } }, `v${v.version}`),
                                h('div', { style: { fontSize: '12px', color: 'var(--text-dim)', marginBottom: v.changelog ? '12px' : '0' } }, v.created_at.substring(0, 10)),
                                v.changelog ? h('div', { style: { background: 'var(--bg)', padding: '12px', borderRadius: '6px', fontSize: '13px', color: 'var(--text-dim)' }, innerHTML: fluxide.ui.markdown(v.changelog) }) : h('span')
                            ])
                        ));
                    } else if (detailsTab === 'docs') {
                        if (!data.docs || Object.keys(data.docs).length === 0) {
                            tabContent = h('div', { style: { color: 'var(--text-dim)' } }, 'No documentation bundled.');
                        } else {
                            let idx = { sections: [] };
                            try { idx = JSON.parse(data.docs['docs/index.json'] || '{}'); } catch(e){}
                            tabContent = h('div', {}, (idx.sections || []).map(sec => h('div', { style: { marginBottom: '24px' } }, [
                                h('h3', { style: { fontSize: '16px', color: 'var(--text)', borderBottom: '1px solid var(--surface-high)', paddingBottom: '8px', marginBottom: '12px' } }, sec.title),
                                ...sec.pages.map(p => h('div', { style: { border: '1px solid var(--border)', borderRadius: '6px', marginBottom: '8px', background: 'var(--bg)' } }, [
                                    h('div', { style: { padding: '12px 16px', fontWeight: 600, cursor: 'pointer', color: 'var(--text)', userSelect: 'none' }, onClick: (e) => {
                                        const body = e.currentTarget.nextElementSibling;
                                        body.style.display = body.style.display === 'block' ? 'none' : 'block';
                                    }}, p.title),
                                    h('div', { style: { padding: '16px', borderTop: '1px solid var(--border)', display: 'none', color: 'var(--text-dim)', fontSize: '14px', lineHeight: '1.6' }, innerHTML: fluxide.ui.markdown(data.docs[`docs/${p.file}`] || '*Empty*') })
                                ]))
                            ])));
                        }
                    } else if (detailsTab === 'reviews') {
                        tabContent = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } }, (data.reviews||[]).map(r => 
                            h('div', { style: { background: 'var(--surface-low)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' } }, [
                                h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' } }, [
                                    h('span', { style: { fontWeight: 600, color: 'var(--text)' } }, r.username),
                                    h('span', { style: { color: '#fbbf24' } }, '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating))
                                ]),
                                h('div', { style: { color: 'var(--text-dim)', fontSize: '14px' } }, r.comment)
                            ])
                        ));
                        if(data.reviews.length === 0) tabContent = h('div', { style: { color: 'var(--text-dim)' } }, 'No reviews yet.');
                    }

                    contentArea.appendChild(installCard);
                    contentArea.appendChild(tabsHeader);
                    contentArea.appendChild(tabContent);
                    
                } else if (activeTab === 'installed') {
                    const vfs = state.get().vfs;
                    const extensions = [];

                    Object.keys(vfs).forEach(p => {
                        const isDis = p.startsWith('disabled/');
                        if ((p.startsWith('plugins/') || isDis) && p.endsWith('/plugin.json')) {
                            try {
                                const data = JSON.parse(vfs[p]);
                                const dir = p.substring(0, p.lastIndexOf('/'));
                                extensions.push({ type: 'plugin', path: dir, id: data.id || dir.split('/')[1], name: data.name || data.id, version: data.version || '1.0.0', author: data.author || 'Unknown', disabled: isDis });
                            } catch(e) {}
                        }
                        if ((p.startsWith('themes/') || isDis) && p.endsWith('/theme.json')) {
                            try {
                                const data = JSON.parse(vfs[p]);
                                const dir = p.substring(0, p.lastIndexOf('/'));
                                extensions.push({ type: 'theme', path: dir, id: data.id || dir.split('/')[1], name: data.name || data.id, version: data.version || '1.0.0', author: data.author || 'Unknown', disabled: isDis });
                            } catch(e) {}
                        }
                        if ((p.startsWith('icon-packs/') || isDis) && p.endsWith('/main.json')) {
                            try {
                                const data = JSON.parse(vfs[p]);
                                const dir = p.substring(0, p.lastIndexOf('/'));
                                extensions.push({ type: 'icon-pack', path: dir, id: data.id || dir.split('/')[1], name: data.name || data.id, version: data.version || '1.0.0', author: data.author || 'Unknown', disabled: isDis });
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

                                fluxide.ui.modal(win => {
                                    win.appendChild(h('div', { class: 'fx-modal-body', style: { textAlign: 'center', padding: '40px', color: 'var(--text)' } }, [
                                        h('h3', { style: { marginTop: 0, marginBottom: '10px' } }, 'Preparing Package...'),
                                        pBarContainer,
                                        h('div', { style: { fontSize: '12px', color: 'var(--text-dim)' } }, 'Extracting contents to memory.')
                                    ]));
                                });

                                try {
                                    const zip = await window.JSZip.loadAsync(file);
                                    const files = Object.values(zip.files);
                                    const pJson = files.find(f => f.name.endsWith('plugin.json') || f.name.endsWith('theme.json') || f.name.endsWith('main.json'));
                                    
                                    if (pJson) {
                                        const metaName = pJson.name.split('/').pop();
                                        const metaContent = await pJson.async('string');
                                        const metaData = JSON.parse(metaContent);
                                        const itemId = metaData.id || metaData.name.toLowerCase().replace(/\s+/g, '_');
                                        const rootFolder = pJson.name.substring(0, pJson.name.length - metaName.length);
                                        const typeFolder = metaName === 'plugin.json' ? 'plugin' : (metaName === 'theme.json' ? 'theme' : 'icon_pack');
                                        
                                        const preparedFiles = {};
                                        let i = 0;
                                        for (let zf of files) {
                                            if (zf.dir) continue;
                                            if (zf.name.startsWith(rootFolder)) {
                                                const relPath = zf.name.substring(rootFolder.length);
                                                const fullPath = `${typeFolder === 'plugin' ? 'plugins' : (typeFolder === 'theme' ? 'themes' : 'icon-packs')}/${itemId}/${relPath}`;
                                                const ext = zf.name.split('.').pop().toLowerCase();
                                                const isBin = ['png','jpg','jpeg','gif','webp','ico','mp4','webm','mp3','wav','ogg','zip','wasm','woff','woff2','ttf','otf','eot'].includes(ext);
                                                
                                                if (isBin) {
                                                    preparedFiles[fullPath] = await zf.async('blob');
                                                } else {
                                                    preparedFiles[fullPath] = await zf.async('string');
                                                }
                                            }
                                            i++;
                                            pBar.style.width = ((i / files.length) * 100) + '%';
                                        }
                                        
                                        pendingActions.push({ type: 'install', name: metaData.name || itemId, itemType: typeFolder, itemId: itemId, files: preparedFiles });
                                        fluxide.ui.modal.close();
                                        renderUI();
                                    } else {
                                        fluxide.ui.modal.close();
                                    }
                                } catch(err) {
                                    fluxide.ui.modal.close();
                                }
                            }
                        }
                    });

                    contentArea.appendChild(h('div', { style: { display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' } }, [
                        importInput,
                        h('button', { class: 'fx-btn', style: { padding: '8px 16px' }, onClick: () => importInput.click() }, 'Import Package (.zip)')
                    ]));

                    extensions.sort((a,b) => a.type.localeCompare(b.type)).forEach(ext => {
                        const isQueuedDel = pendingActions.some(a => a.type === 'delete' && a.path === ext.path);
                        const isQueuedToggle = pendingActions.some(a => (a.type === 'disable' || a.type === 'enable') && a.path === ext.path);
                        
                        const willBeDisabled = (ext.disabled && !isQueuedToggle) || (!ext.disabled && pendingActions.some(a => a.type === 'disable' && a.path === ext.path));

                        const card = h('div', { style: { background: 'var(--surface-low)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: isQueuedDel ? '0.5' : '1' } }, [
                            h('div', { style: { display: 'flex', gap: '20px', alignItems: 'center' } }, [
                                h('div', { style: { width: '48px', height: '48px', fontSize: '20px', borderRadius: '8px', background: 'var(--surface-high)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', opacity: willBeDisabled ? '0.5' : '1' } }, ext.name.substring(0,1).toUpperCase()),
                                h('div', {}, [
                                    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' } }, [
                                        h('span', { style: { fontWeight: 600, fontSize: '15px', color: willBeDisabled ? 'var(--text-dim)' : 'var(--text)', textDecoration: willBeDisabled ? 'line-through' : 'none' } }, ext.name),
                                        h('span', { style: { padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', background: 'var(--surface-high)', color: 'var(--text-dim)' } }, ext.type),
                                        h('span', { style: { fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-code)' } }, 'v' + ext.version)
                                    ]),
                                    h('div', { style: { fontSize: '12px', color: 'var(--text-dim)' } }, `By ${ext.author}`)
                                ])
                            ]),
                            h('div', { style: { display: 'flex', gap: '8px' } }, [
                                h('button', { class: 'fx-btn', style: { padding: '6px 12px' }, disabled: isQueuedDel, onClick: () => {
                                    if (ext.id === 'manager' || ext.id === 'ide') return;
                                    const actionType = ext.disabled ? 'enable' : 'disable';
                                    const existingIdx = pendingActions.findIndex(a => (a.type === 'disable' || a.type === 'enable') && a.path === ext.path);
                                    if (existingIdx > -1) pendingActions.splice(existingIdx, 1);
                                    else pendingActions.push({ type: actionType, path: ext.path, itemType: ext.type, itemId: ext.id, name: ext.name });
                                    renderUI();
                                }}, isQueuedToggle ? 'Queued' : (ext.disabled ? 'Enable' : 'Disable')),
                                h('button', { class: 'fx-btn', style: { padding: '6px 12px' }, disabled: isQueuedDel, onClick: async () => {
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
                                h('button', { class: 'fx-btn', disabled: isQueuedDel, style: { padding: '6px 12px', color: isQueuedDel ? 'var(--text-dim)' : 'var(--danger)', borderColor: isQueuedDel ? 'var(--border)' : 'var(--danger-border)' }, onClick: () => {
                                    if (ext.id === 'manager' || ext.id === 'ide') return;
                                    pendingActions.push({ type: 'delete', path: ext.path, name: ext.name });
                                    renderUI();
                                }}, isQueuedDel ? 'Queued' : 'Uninstall')
                            ])
                        ]);
                        contentArea.appendChild(card);
                    });
                } else if (activeTab === 'market') {
                    const searchBar = h('input', {
                        class: 'fx-input',
                        placeholder: 'Search marketplace...',
                        value: marketSearch,
                        style: { marginBottom: '16px', padding: '10px 14px' },
                        onInput: (e) => { marketSearch = e.target.value; renderUI(); }
                    });
                    contentArea.appendChild(searchBar);

                    if (loadingMarket) {
                        contentArea.appendChild(h('div', { style: { color: 'var(--text-dim)', padding: '40px', textAlign: 'center' } }, 'Fetching Market Data...'));
                    } else if (marketItems.length === 0) {
                        contentArea.appendChild(h('div', { style: { color: 'var(--text-dim)', padding: '40px', textAlign: 'center' } }, 'No items available in the market.'));
                    } else {
                        const q = marketSearch.toLowerCase();
                        const filtered = marketItems.filter(i => i.name.toLowerCase().includes(q) || i.author.toLowerCase().includes(q) || i.type.toLowerCase().includes(q));
                        
                        const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' } });
                        
                        filtered.forEach(ext => {
                            let isInstalled = false;
                            if (ext.type === 'plugin') isInstalled = Object.keys(state.get().vfs).some(p => p.startsWith(`plugins/${ext.item_id}/`) || p.startsWith(`disabled/${ext.item_id}/`));
                            else if (ext.type === 'theme') isInstalled = Object.keys(state.get().vfs).some(p => p.startsWith(`themes/${ext.item_id}/`) || p.startsWith(`disabled/${ext.item_id}/`));
                            else if (ext.type === 'icon_pack') isInstalled = Object.keys(state.get().vfs).some(p => p.startsWith(`icon-packs/${ext.item_id}/`) || p.startsWith(`disabled/${ext.item_id}/`));

                            const card = h('div', { style: { background: 'var(--surface-low)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', flexDirection: 'column', padding: '20px', transition: 'transform 0.2s, border-color 0.2s' },
                                onMouseOver: (e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; },
                                onMouseOut: (e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; },
                                onClick: () => { viewingItem = ext; detailsTab = 'details'; renderUI(); } }, [
                                h('div', { style: { display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' } }, [
                                    h('div', { style: { width: '48px', height: '48px', fontSize: '20px', borderRadius: '12px', background: 'var(--surface-high)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', flexShrink: 0 } }, ext.name.substring(0,1).toUpperCase()),
                                    h('div', { style: { flex: 1, minWidth: 0 } }, [
                                        h('h3', { style: { margin: '0 0 4px 0', fontSize: '16px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, ext.name),
                                        h('div', { style: { fontSize: '12px', color: 'var(--text-dim)' } }, `By ${ext.author}`)
                                    ])
                                ]),
                                h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' } }, [
                                    h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, [
                                        h('span', { style: { padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', background: 'var(--surface-high)', color: 'var(--text-dim)' } }, ext.type.replace('_', ' ')),
                                        isInstalled ? h('span', { style: { fontSize: '11px', color: '#10b981' } }, 'Installed') : h('span', {})
                                    ]),
                                    h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text)' } }, [
                                        h('span', { style: { color: 'var(--accent)' } }, '★'),
                                        ext.upvotes || 0
                                    ])
                                ])
                            ]);
                            grid.appendChild(card);
                        });
                        contentArea.appendChild(grid);
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

            if (marketItems.length === 0 && !loadingMarket) {
                loadingMarket = true;
                fetch('https://darksoulq.pythonanywhere.com/api/items')
                    .then(r => r.json())
                    .then(d => { marketItems = d.items || []; loadingMarket = false; renderUI(); })
                    .catch(() => { loadingMarket = false; renderUI(); });
            }

            renderUI();
        });
    }
});