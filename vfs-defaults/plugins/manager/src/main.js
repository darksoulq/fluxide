const { h } = fluxide.ui;
const { state, on, expose, fs } = fluxide;

fluxide.register({
    id: 'manager',
    init() {
        fluxide.settings.register('extensions.manager', {
            label: 'Fluxide Manager'
        });

        on('settings:render:extensions.manager', ({container}) => {
            let activeTab = 'installed';

            const renderUI = async () => {
                container.innerHTML = '';
                
                const header = h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' } }, [
                    h('h2', { style: { margin: 0, fontSize: '20px' } }, 'Fluxide Manager'),
                    h('div', { style: { display: 'flex', gap: '10px', background: 'var(--surface-low)', padding: '4px', borderRadius: 'var(--radius-sm)' } }, [
                        h('button', { class: 'fx-btn' + (activeTab === 'installed' ? ' fx-btn-primary' : ''), onClick: () => { activeTab = 'installed'; renderUI(); } }, 'Installed'),
                        h('button', { class: 'fx-btn' + (activeTab === 'market' ? ' fx-btn-primary' : ''), onClick: () => { activeTab = 'market'; renderUI(); } }, 'Fluxide Market')
                    ])
                ]);
                
                container.appendChild(header);

                const contentArea = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '15px' } });
                container.appendChild(contentArea);

                if (activeTab === 'installed') {
                    const vfs = state.get().vfs;
                    const extensions = [];

                    Object.keys(vfs).forEach(p => {
                        if (p.startsWith('plugins/') && p.endsWith('/plugin.json')) {
                            try {
                                const data = JSON.parse(vfs[p]);
                                const dir = p.substring(0, p.lastIndexOf('/'));
                                extensions.push({ type: 'plugin', path: dir, id: data.id || dir.split('/')[1], name: data.name || data.id, version: data.version || '1.0.0', author: data.author || 'Unknown', desc: data.description || 'No description provided.', raw: data });
                            } catch(e) {}
                        }
                        if (p.startsWith('themes/') && p.endsWith('.json')) {
                            try {
                                const data = JSON.parse(vfs[p]);
                                extensions.push({ type: 'theme', path: p, id: p.split('/').pop().replace('.json',''), name: data.name || 'Unknown Theme', version: 'N/A', author: data.author || 'Unknown', desc: 'UI Theme', raw: data });
                            } catch(e) {}
                        }
                        if (p.startsWith('icon-packs/') && p.endsWith('.json')) {
                            try {
                                const data = JSON.parse(vfs[p]);
                                extensions.push({ type: 'icon-pack', path: p, id: p.split('/').pop().replace('.json',''), name: data.name || 'Unknown Icon Pack', version: 'N/A', author: data.author || 'Unknown', desc: 'Icon Pack', raw: data });
                            } catch(e) {}
                        }
                    });

                    const importInput = h('input', {
                        type: 'file', accept: '.zip,.json', style: { display: 'none' },
                        onChange: async (e) => {
                            const file = e.target.files[0];
                            if(!file) return;
                            
                            if (file.name.endsWith('.json')) {
                                const text = await file.text();
                                try {
                                    const j = JSON.parse(text);
                                    if (j.vars) await fs.write('themes/' + file.name, text);
                                    else if (j.icons) await fs.write('icon-packs/' + file.name, text);
                                    else return fluxide.ide?.log('Invalid theme/icon pack JSON.', 'error');
                                    fluxide.ide?.log(`Imported ${file.name} successfully.`, 'success');
                                    renderUI();
                                } catch(err) { fluxide.ide?.log('Failed to parse JSON.', 'error'); }
                            } else if (file.name.endsWith('.zip')) {
                                if(!window.JSZip) return fluxide.ide?.log('JSZip not found', 'error');
                                try {
                                    const zip = await JSZip.loadAsync(file);
                                    const files = Object.values(zip.files);
                                    let rootFolder = '';
                                    
                                    const pluginJsonFile = files.find(f => f.name.endsWith('plugin.json'));
                                    if (!pluginJsonFile) return fluxide.ide?.log('Invalid plugin zip (missing plugin.json)', 'error');
                                    
                                    const pluginJsonContent = await pluginJsonFile.async('string');
                                    const pluginData = JSON.parse(pluginJsonContent);
                                    const pluginId = pluginData.id;
                                    
                                    rootFolder = pluginJsonFile.name.substring(0, pluginJsonFile.name.length - 'plugin.json'.length);
                                    
                                    for (let zf of files) {
                                        if (zf.dir) continue;
                                        if (zf.name.startsWith(rootFolder)) {
                                            const relPath = zf.name.substring(rootFolder.length);
                                            const content = await zf.async('string');
                                            await fs.write(`plugins/${pluginId}/${relPath}`, content);
                                        }
                                    }
                                    fluxide.ide?.log(`Imported plugin ${pluginId} successfully. Reloading...`, 'success');
                                    setTimeout(() => location.reload(), 500);
                                } catch (err) { fluxide.ide?.log('Failed to extract ZIP.', 'error'); }
                            }
                        }
                    });

                    contentArea.appendChild(h('div', { style: { display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' } }, [
                        importInput,
                        h('button', { class: 'fx-btn', onClick: () => importInput.click() }, 'Import Extension (.zip / .json)')
                    ]));

                    extensions.sort((a,b) => a.type.localeCompare(b.type)).forEach(ext => {
                        const card = h('div', { style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
                            h('div', {}, [
                                h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' } }, [
                                    h('span', { style: { fontWeight: 700, fontSize: '15px' } }, ext.name),
                                    h('span', { style: { fontSize: '10px', padding: '2px 6px', background: 'var(--surface-high)', borderRadius: '3px', color: 'var(--text-dim)', textTransform: 'uppercase' } }, ext.type),
                                    h('span', { style: { fontSize: '11px', color: 'var(--accent)', fontFamily: 'var(--font-code)' } }, 'v' + ext.version)
                                ]),
                                h('div', { style: { fontSize: '12px', color: 'var(--text-dim)', marginBottom: '8px' } }, ext.desc),
                                h('div', { style: { fontSize: '11px', color: 'var(--text-dark)' } }, 'By ' + ext.author)
                            ]),
                            h('div', { style: { display: 'flex', gap: '8px' } }, [
                                h('button', { class: 'fx-btn', onClick: async () => {
                                    if (ext.type === 'plugin') {
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
                                    } else {
                                        const content = vfs[ext.path];
                                        const blob = new Blob([content], { type: 'application/json' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a'); a.href = url; a.download = ext.path.split('/').pop(); a.click(); URL.revokeObjectURL(url);
                                    }
                                }}, 'Export'),
                                h('button', { class: 'fx-btn', style: { color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }, onClick: async () => {
                                    if (ext.id === 'manager' || ext.id === 'ide') return fluxide.ide?.log('Cannot delete core plugin.', 'error');
                                    if (confirm(`Are you sure you want to delete ${ext.name}?`)) {
                                        Object.keys(vfs).forEach(async p => {
                                            if (ext.type === 'plugin' && p.startsWith(ext.path + '/')) { state.update(s => delete s.vfs[p]); await fs.remove(p); }
                                            else if (p === ext.path) { state.update(s => delete s.vfs[p]); await fs.remove(p); }
                                        });
                                        fluxide.ide?.log(`Deleted ${ext.name}. Reloading...`, 'info');
                                        setTimeout(() => location.reload(), 500);
                                    }
                                }}, 'Delete')
                            ])
                        ]);
                        contentArea.appendChild(card);
                    });
                } else if (activeTab === 'market') {
                    contentArea.innerHTML = '<div style="color: var(--text-dim); padding: 20px; text-align: center;">Fetching Market Data...</div>';
                    try {
                        const res = await fetch('https://darksoulq.pythonanywhere.com/api/plugins');
                        if (!res.ok) throw new Error('Network error');
                        const data = await res.json();
                        
                        contentArea.innerHTML = '';
                        if (data.plugins.length === 0) {
                            contentArea.innerHTML = '<div style="color: var(--text-dim); padding: 20px; text-align: center;">No plugins available in the market yet.</div>';
                        }
                        
                        data.plugins.forEach(ext => {
                            const isInstalled = Object.keys(state.get().vfs).some(p => p === `plugins/${ext.plugin_id}/plugin.json`);
                            
                            const card = h('div', { style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
                                h('div', {}, [
                                    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' } }, [
                                        h('span', { style: { fontWeight: 700, fontSize: '15px' } }, ext.name),
                                        h('span', { style: { fontSize: '11px', color: 'var(--accent)', fontFamily: 'var(--font-code)' } }, 'v' + ext.version)
                                    ]),
                                    h('div', { style: { fontSize: '12px', color: 'var(--text-dim)', marginBottom: '8px' } }, ext.description),
                                    h('div', { style: { fontSize: '11px', color: 'var(--text-dark)' } }, 'By ' + ext.author)
                                ]),
                                h('div', { style: { display: 'flex', gap: '8px' } }, [
                                    h('button', { 
                                        class: 'fx-btn' + (isInstalled ? '' : ' fx-btn-primary'), 
                                        disabled: isInstalled,
                                        onClick: async (e) => {
                                            if(isInstalled) return;
                                            const btn = e.target;
                                            btn.innerText = 'Installing...';
                                            btn.disabled = true;
                                            try {
                                                const zipRes = await fetch(`https://darksoulq.pythonanywhere.com/api/plugins/${ext.id}/download`);
                                                const arrayBuffer = await zipRes.arrayBuffer();
                                                const zip = await JSZip.loadAsync(arrayBuffer);
                                                
                                                const files = Object.values(zip.files);
                                                let rootFolder = '';
                                                const pJson = files.find(f => f.name.endsWith('plugin.json'));
                                                if (pJson) rootFolder = pJson.name.substring(0, pJson.name.length - 'plugin.json'.length);
                                                
                                                for (let zf of files) {
                                                    if (zf.dir) continue;
                                                    if (zf.name.startsWith(rootFolder)) {
                                                        const relPath = zf.name.substring(rootFolder.length);
                                                        const content = await zf.async('string');
                                                        await fs.write(`plugins/${ext.plugin_id}/${relPath}`, content);
                                                    }
                                                }
                                                fluxide.ide?.log(`Installed ${ext.name} from Market. Reloading...`, 'success');
                                                setTimeout(() => location.reload(), 500);
                                            } catch(err) {
                                                btn.innerText = 'Install Failed';
                                                fluxide.ide?.log(`Failed to install ${ext.name}: ${err}`, 'error');
                                            }
                                        }
                                    }, isInstalled ? 'Installed' : 'Install')
                                ])
                            ]);
                            contentArea.appendChild(card);
                        });
                        
                    } catch (err) {
                        contentArea.innerHTML = `<div style="color: #ef4444; padding: 20px; text-align: center;">Failed to connect to Fluxide Market.<br/><span style="font-size: 11px; color: var(--text-dim);">${err.message}</span></div>`;
                    }
                }
            };

            renderUI();
        });
    }
});