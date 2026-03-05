const { state, emit, expose, on } = fluxide;

const ThemeManager = {
    init() {
        const getPacks = (key, def) => {
            let v = state.get().settings[key];
            if (!v) return [def];
            if (typeof v === 'string') {
                try { const p = JSON.parse(v); if(Array.isArray(p)) return p; } catch(e) {}
                return [v];
            }
            if (Array.isArray(v)) return v;
            return [def];
        };

        expose('theme', {
            getIcon: (id) => {
                const packs = getPacks('icon_pack', 'default');
                const vfs = state.get().vfs;
                for (const packId of packs) {
                    const packPath = `icon-packs/${packId}/main.json`;
                    if (vfs[packPath]) {
                        try {
                            const pack = JSON.parse(vfs[packPath]);
                            if (pack.icons && pack.icons[id]) {
                                const svgPath = `icon-packs/${packId}/${pack.icons[id].replace('./', '')}`;
                                if (vfs[svgPath]) return vfs[svgPath];
                            }
                        } catch(e) {}
                    }
                }
                return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>`;
            },
            getFileIconHtml: (filename) => {
                const packs = getPacks('icon_pack', 'default');
                const vfs = state.get().vfs;
                const ext = filename.split('.').pop().toLowerCase();
                
                for (const packId of packs) {
                    const packPath = `icon-packs/${packId}/main.json`;
                    if (vfs[packPath]) {
                        try {
                            const pack = JSON.parse(vfs[packPath]);
                            if (pack.fileIcons && pack.fileIcons[ext]) {
                                const svgPath = `icon-packs/${packId}/${pack.fileIcons[ext].replace('./', '')}`;
                                if (vfs[svgPath]) return vfs[svgPath];
                            }
                        } catch(e) {}
                    }
                }
                
                for (const packId of packs) {
                    const packPath = `icon-packs/${packId}/main.json`;
                    if (vfs[packPath]) {
                        try {
                            const pack = JSON.parse(vfs[packPath]);
                            if (pack.fileIcons && pack.fileIcons['default']) {
                                const svgPath = `icon-packs/${packId}/${pack.fileIcons['default'].replace('./', '')}`;
                                if (vfs[svgPath]) return vfs[svgPath];
                            }
                        } catch(e) {}
                    }
                }
                
                return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
            },
            getFolderIconHtml: (foldername, isOpen) => {
                const packs = getPacks('icon_pack', 'default');
                const vfs = state.get().vfs;
                const stateKey = isOpen ? 'open' : 'default';
                
                for (const packId of packs) {
                    const packPath = `icon-packs/${packId}/main.json`;
                    if (vfs[packPath]) {
                        try {
                            const pack = JSON.parse(vfs[packPath]);
                            if (pack.folderIcons && pack.folderIcons[stateKey]) {
                                const svgPath = `icon-packs/${packId}/${pack.folderIcons[stateKey].replace('./', '')}`;
                                if (vfs[svgPath]) return vfs[svgPath];
                            }
                        } catch(e) {}
                    }
                }

                if (isOpen) {
                    for (const packId of packs) {
                        const packPath = `icon-packs/${packId}/main.json`;
                        if (vfs[packPath]) {
                            try {
                                const pack = JSON.parse(vfs[packPath]);
                                if (pack.folderIcons && pack.folderIcons['default']) {
                                    const svgPath = `icon-packs/${packId}/${pack.folderIcons['default'].replace('./', '')}`;
                                    if (vfs[svgPath]) return vfs[svgPath];
                                }
                            } catch(e) {}
                        }
                    }
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

        this.applyTheme(getPacks('theme', 'dracula'));
    },

    applyTheme(themeInput) {
        let themes = [];
        if (Array.isArray(themeInput)) themes = themeInput;
        else if (typeof themeInput === 'string') {
            try { themes = JSON.parse(themeInput); if (!Array.isArray(themes)) themes = [themeInput]; } catch(e) { themes = [themeInput]; }
        }
        if (themes.length === 0) themes = ['dracula'];

        const vfs = state.get().vfs;
        const root = document.documentElement;

        if (window._fx_applied_theme_vars) {
            window._fx_applied_theme_vars.forEach(k => root.style.removeProperty(k));
        }
        window._fx_applied_theme_vars = [];

        for (let i = themes.length - 1; i >= 0; i--) {
            const themeId = themes[i];
            const themePath = `themes/${themeId}/theme.json`;
            if (vfs[themePath]) {
                try {
                    const data = JSON.parse(vfs[themePath]);
                    if (data.vars) {
                        Object.keys(data.vars).forEach(k => {
                            root.style.setProperty(k, data.vars[k]);
                            window._fx_applied_theme_vars.push(k);
                        });
                        if (data.vars['--bg']) document.body.style.backgroundColor = data.vars['--bg'];
                        if (data.vars['--text']) document.body.style.color = data.vars['--text'];
                    }
                } catch(e) {}
            }
        }
    }
};

fluxide.register({ id: 'theme_manager', init: () => ThemeManager.init() });