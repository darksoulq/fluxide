const { state, emit, expose, on } = fluxide;

const ThemeManager = {
    init() {
        expose('theme', {
            getIcon: (id) => {
                const iconPackId = state.get().settings.icon_pack || 'default';
                const packPath = `icon-packs/${iconPackId}/main.json`;
                const vfs = state.get().vfs;
                if (vfs[packPath]) {
                    try {
                        const pack = JSON.parse(vfs[packPath]);
                        if (pack.icons && pack.icons[id]) {
                            const svgPath = `icon-packs/${iconPackId}/${pack.icons[id].replace('./', '')}`;
                            if (vfs[svgPath]) return vfs[svgPath];
                        }
                    } catch(e) {}
                }
                return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>`;
            },
            getFileIconHtml: (filename) => {
                const iconPackId = state.get().settings.icon_pack || 'default';
                const packPath = `icon-packs/${iconPackId}/main.json`;
                const vfs = state.get().vfs;
                const ext = filename.split('.').pop().toLowerCase();
                
                if (vfs[packPath]) {
                    try {
                        const pack = JSON.parse(vfs[packPath]);
                        if (pack.fileIcons) {
                            let ref = pack.fileIcons[ext] || pack.fileIcons['default'];
                            if (ref) {
                                const svgPath = `icon-packs/${iconPackId}/${ref.replace('./', '')}`;
                                if (vfs[svgPath]) return vfs[svgPath];
                            }
                        }
                    } catch(e) {}
                }
                return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
            },
            getFolderIconHtml: (foldername, isOpen) => {
                const iconPackId = state.get().settings.icon_pack || 'default';
                const packPath = `icon-packs/${iconPackId}/main.json`;
                const vfs = state.get().vfs;
                
                if (vfs[packPath]) {
                    try {
                        const pack = JSON.parse(vfs[packPath]);
                        if (pack.folderIcons) {
                            let ref = isOpen ? (pack.folderIcons['open'] || pack.folderIcons['default']) : pack.folderIcons['default'];
                            if (ref) {
                                const svgPath = `icon-packs/${iconPackId}/${ref.replace('./', '')}`;
                                if (vfs[svgPath]) return vfs[svgPath];
                            }
                        }
                    } catch(e) {}
                }
                return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
            },
            registerVariables: (pluginId, vars) => {
                const root = document.documentElement;
                Object.keys(vars).forEach(k => {
                    if (!root.style.getPropertyValue(k)) {
                        root.style.setProperty(k, vars[k]);
                    }
                });
            },
            applyTheme: (themeId) => this.applyTheme(themeId)
        });

        this.applyTheme(state.get().settings.theme || 'dracula');
    },

    applyTheme(themeId) {
        const vfs = state.get().vfs;
        const themePath = `themes/${themeId}/theme.json`;
        
        if (vfs[themePath]) {
            try {
                const data = JSON.parse(vfs[themePath]);
                if (data.vars) {
                    const root = document.documentElement;
                    Object.keys(data.vars).forEach(k => {
                        root.style.setProperty(k, data.vars[k]);
                    });
                    if (data.vars['--bg']) document.body.style.backgroundColor = data.vars['--bg'];
                    if (data.vars['--text']) document.body.style.color = data.vars['--text'];
                }
            } catch(e) {}
        }
    }
};

fluxide.register({ id: 'theme_manager', init: () => ThemeManager.init() });