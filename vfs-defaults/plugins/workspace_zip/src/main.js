const { h } = fluxide.ui;
const { state, on, expose, fs } = fluxide;

fluxide.register({
    id: 'workspace_zip',
    init() {
        fluxide.settings.register('utilities.workspace_zip', {
            label: 'Workspace Backup'
        });

        on('settings:render:utilities.workspace_zip', ({container}) => {
            container.appendChild(h('h2', { style: { marginTop: 0, marginBottom: '24px', fontSize: '20px' } }, 'Workspace Import / Export'));
            
            const exportBtn = h('button', {
                class: 'fx-btn fx-btn-primary',
                style: { padding: '10px 16px', fontSize: '13px', flex: 1, justifyContent: 'center' },
                onClick: async () => {
                    if (!window.JSZip) return fluxide.ide?.log('JSZip not found', 'error');
                    const zip = new JSZip();
                    const vfs = state.get().vfs;
                    
                    Object.keys(vfs).forEach(path => {
                        if (!path.endsWith('/.keep')) {
                            zip.file(path, vfs[path]);
                        } else {
                            const folderPath = path.substring(0, path.lastIndexOf('/.keep') + 1);
                            zip.folder(folderPath);
                        }
                    });
                    
                    const wsData = await fs.read('.fluxide/workspace.json');
                    if (wsData) zip.file('.fluxide/workspace.json', wsData);
                    
                    const setData = await fs.read('.fluxide/settings.json');
                    if (setData) zip.file('.fluxide/settings.json', setData);

                    const initData = await fs.read('.fluxide/init.json');
                    if (initData) zip.file('.fluxide/init.json', initData);
                    
                    const blob = await zip.generateAsync({ type: 'blob' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `fluxide_workspace_${new Date().getTime()}.zip`;
                    a.click();
                    URL.revokeObjectURL(url);
                    
                    if(fluxide.ide) fluxide.ide.log('Workspace exported', 'success');
                }
            }, 'Export Workspace (ZIP)');

            const importInput = h('input', {
                type: 'file',
                accept: '.zip',
                style: { display: 'none' },
                onChange: async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    if (!window.JSZip) return fluxide.ide?.log('JSZip not found', 'error');
                    
                    try {
                        const zip = await JSZip.loadAsync(file);
                        
                        const pBarContainer = h('div', { style: { width: '100%', height: '4px', background: 'var(--surface-high)', borderRadius: '2px', overflow: 'hidden', margin: '20px 0 10px 0' } });
                        const pBar = h('div', { style: { width: '0%', height: '100%', background: 'var(--accent)', transition: 'width 0.1s linear' } });
                        pBarContainer.appendChild(pBar);
                        const pText = h('div', { style: { fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-code)' } }, 'Extracting...');

                        fluxide.ui.modal(win => {
                            win.appendChild(h('div', { class: 'fx-modal-body', style: { textAlign: 'center', padding: '40px' } }, [
                                h('h3', { style: { marginTop: 0, marginBottom: '10px' } }, 'Importing Workspace...'),
                                pBarContainer,
                                pText
                            ]));
                        });

                        const files = Object.values(zip.files);
                        for (let i = 0; i < files.length; i++) {
                            const zf = files[i];
                            if (!zf.dir) {
                                const content = await zf.async('string');
                                await fs.write(zf.name, content);
                            } else {
                                await fs.write(zf.name + '.keep', '');
                            }
                            pBar.style.width = (((i + 1) / files.length) * 100) + '%';
                            pText.innerText = zf.name;
                        }
                        
                        pText.innerText = 'Reloading...';
                        setTimeout(() => location.reload(), 500);
                    } catch (err) {
                        if(fluxide.ide) fluxide.ide.log('Error importing ZIP', 'error');
                        fluxide.ui.modal.close();
                    }
                }
            });

            const importBtn = h('button', {
                class: 'fx-btn',
                style: { padding: '10px 16px', fontSize: '13px', flex: 1, justifyContent: 'center' },
                onClick: () => importInput.click()
            }, 'Import Workspace (ZIP)');

            const wrapper = h('div', { style: { display: 'flex', gap: '15px', maxWidth: '500px' } }, [ exportBtn, importBtn, importInput ]);
            
            container.appendChild(wrapper);
            container.appendChild(h('p', { style: { fontSize: '12px', color: 'var(--text-dim)', marginTop: '20px', lineHeight: '1.5' } }, 'Importing a workspace will overwrite matching files. The UI will reload upon completion.'));
        });
    }
});