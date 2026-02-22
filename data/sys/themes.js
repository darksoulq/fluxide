const { state, expose, emit } = fluxide;

fluxide.register({
	id: 'theme_engine',
	init() {
		const themes = {};
		let activePluginVars = {};
		const iconPacks = {};
		const extIcons = { 'js': 'js', 'json': 'json', 'md': 'md' };
		const nameIcons = {};

		Object.keys(state.get().vfs).forEach(k => {
			if (k.startsWith('themes/') && k.endsWith('.json')) {
				try { const t = JSON.parse(state.get().vfs[k]); themes[t.name.toLowerCase()] = t.vars; } catch(e) {}
			}
			if (k.startsWith('icon-packs/') && k.endsWith('.json')) {
				try {
					const pack = JSON.parse(state.get().vfs[k]);
					const id = k.replace('icon-packs/', '').replace('.json', '');
					iconPacks[id] = pack;
				} catch(e) {}
			}
		});

		if(!iconPacks['default']) iconPacks['default'] = { name: "Fallback", icons: { file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>' } };

		expose('theme', {
			getThemes: () => Object.keys(themes),
			registerVariables: (pluginId, vars) => {
				activePluginVars = { ...activePluginVars, ...vars };
				apply(state.get().settings.theme || 'dracula');
			},
			registerIconPack: (id, name, iconsObj) => { iconPacks[id] = { name, icons: iconsObj }; },
			registerFileIcon: (ext, iconId) => { extIcons[ext] = iconId; },
			registerNameIcon: (name, iconId) => { nameIcons[name] = iconId; },
			getIcon: (id) => {
				const activeId = state.get().settings.icon_pack || 'default';
				const pack = iconPacks[activeId] || iconPacks['default'];
				return pack.icons[id] || iconPacks['default'].icons[id] || iconPacks['default'].icons['file'] || '';
			},
			getFileIconHtml: (filename) => {
				const name = filename.split('/').pop();
				if (nameIcons[name]) return fluxide.theme.getIcon(nameIcons[name]);
				const ext = name.split('.').pop();
				if (extIcons[ext]) return fluxide.theme.getIcon(extIcons[ext]);
				return fluxide.theme.getIcon('file');
			},
			getFolderIconHtml: (foldername, isOpen) => {
				if (nameIcons[foldername]) {
				    const id = nameIcons[foldername] + (isOpen ? 'Open' : '');
				    const activeId = state.get().settings.icon_pack || 'default';
				    const pack = iconPacks[activeId] || iconPacks['default'];
				    if (pack.icons[id] || iconPacks['default'].icons[id]) return fluxide.theme.getIcon(id);
				}
				return fluxide.theme.getIcon(isOpen ? 'folderOpen' : 'folderClosed');
			},
			injectCSS: (id, css) => {
				let el = document.getElementById('fx-css-' + id);
				if(!el) { el = document.createElement('style'); el.id = 'fx-css-' + id; document.head.appendChild(el); }
				el.innerHTML = css;
			}
		});

        fluxide.settings.register('themes', {
            label: 'Themes & Icons',
            defaults: { theme: 'dracula', icon_pack: 'default' }
        });

        fluxide.on('settings:render:themes', ({container}) => {
            const h = fluxide.ui.h;
            container.appendChild(h('h2', { style: { marginTop: 0, marginBottom: '24px', fontSize: '20px' } }, 'Themes & Icons'));
            container.appendChild(fluxide.settings.createControl('System Theme', 'select', 'theme', { options: Object.keys(themes).map(k => ({ value: k, label: k.toUpperCase() })) }));
            container.appendChild(fluxide.settings.createControl('Icon Pack', 'select', 'icon_pack', { options: Object.keys(iconPacks).map(k => ({ value: k, label: iconPacks[k].name })) }));
        });

        fluxide.on('settings:change', ({key}) => {
            if (key === 'theme') apply(state.get().settings.theme || 'dracula');
            if (key === 'icon_pack') emit('workspace:change');
        });

		const apply = (id) => {
			const t = themes[id] || themes['dracula'] || {};
			const combined = { ...t, ...activePluginVars };
			const root = document.documentElement;
			for (let [k,v] of Object.entries(combined)) root.style.setProperty(k, v);
		};
		apply(state.get().settings.theme || 'dracula');
	}
});