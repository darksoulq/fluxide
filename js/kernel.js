window._fx_is_writing = false;
window._fx_reload_queued = false;
const _origReload = window.location.reload;
window.location.reload = function(...args) {
    if (window._fx_write_locks > 0) return;
    _origReload.apply(window.location, args);
};

const fluxide = (() => {
	const r = { plugins: new Map(), views: new Map(), hooks: {}, components: new Map(), settings: [], keybinds: [], loadedPlugins: new Map() };
	const m = {};
	const s = { activeView: 'ide', vfs: {}, settings: { theme: 'dracula', icon_pack: 'default', ui_scale: '1.0', dev_mode: 'false', word_wrap: 'false', code_folding: 'true', active_line: 'true', line_numbers: 'true', tab_size: '4', use_tabs: 'true', match_brackets: 'true', auto_close_brackets: 'true', spark_enabled: 'false', disabled_plugins: [] }, workspace: null, startupErrors: [] };

	const resolvePath = (baseDir, target) => {
		if (!target.startsWith('.')) return target;
		const baseParts = baseDir ? baseDir.split('/').filter(Boolean) : [];
		const targetParts = target.split('/');
		for (const part of targetParts) {
			if (part === '.' || part === '') continue;
			if (part === '..') baseParts.pop();
			else baseParts.push(part);
		}
		return baseParts.join('/');
	};

	const formatCombo = (e) => {
		let keys = [];
		if(e.ctrlKey) keys.push('Ctrl');
		if(e.shiftKey) keys.push('Shift');
		if(e.altKey) keys.push('Alt');
		if(e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Alt' && e.key !== 'Meta') {
			let k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
			keys.push(k);
		}
		return keys.join('-');
	};

	const semverSatisfies = (v, req) => {
		if (!req || req === '*') return true;
		const rClean = req.replace(/^[~^>=<]+/, '');
		const [v1, v2, v3] = (v || '1.0.0').split('.').map(Number);
		const [r1, r2, r3] = rClean.split('.').map(Number);
		if (req.startsWith('^')) return v1 === r1 && (v2 > r2 || (v2 === r2 && v3 >= r3));
		if (req.startsWith('~')) return v1 === r1 && v2 === r2 && v3 >= r3;
		if (req.startsWith('>=')) return v1 > r1 || (v1 === r1 && (v2 > r2 || (v2 === r2 && v3 >= r3)));
		return v === rClean;
	};

	const api = {
		state: { get: () => s, update: (fn) => fn(s) },
		fs: FSManager,
        lockReload: () => { window._fx_write_locks++; },
        unlockReload: () => { setTimeout(() => { window._fx_write_locks = Math.max(0, window._fx_write_locks - 1); }, 1500); },
        forceReload: () => { window._fx_write_locks = 0; _origReload.apply(window.location); },
		on: (e, cb) => { if(!r.hooks[e]) r.hooks[e] = []; r.hooks[e].push(cb); },
		off: (e, cb) => { if(r.hooks[e]) r.hooks[e] = r.hooks[e].filter(f => f !== cb); },
		emit: (e, d) => { if(r.hooks[e]) r.hooks[e].forEach(cb => cb(d)); },
		emitAsync: async (e, d) => { if(r.hooks[e]) { for (const cb of r.hooks[e]) await cb(d); } },
		expose: (id, obj) => { api[id] = obj; },
		exposeApi: (id, obj) => { api[id] = obj; },
		registerComponent: (slot, comp) => { if(!r.components.has(slot)) r.components.set(slot, new Map()); r.components.get(slot).set(comp.id, comp); },
		getComponents: (slot) => Array.from((r.components.get(slot) || new Map()).values()),
		registerSetting: (cat, st) => { r.settings.push({ category: cat, ...st }); },
		getSettings: () => r.settings,
        requireReload: (msg = "A reload is required to apply changes.") => {
            if (document.getElementById('fx-reload-banner')) return;
            const banner = document.createElement('div');
            banner.id = 'fx-reload-banner';
            banner.style.cssText = 'position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: var(--surface-high); border: 1px solid var(--border); padding: 12px 24px; border-radius: var(--radius-md); z-index: 9999; display: flex; align-items: center; gap: 16px; box-shadow: var(--shadow); font-family: var(--font);';
            banner.innerHTML = `<span style="color: var(--text); font-size: 13px; font-weight: 600;">${msg}</span><button class="fx-btn fx-btn-primary" onclick="window.fluxide.forceReload()">Reload Now</button>`;
            document.body.appendChild(banner);
        },
		plugins: {
			has: (id) => r.loadedPlugins.has(id),
			get: (id) => r.loadedPlugins.get(id),
			enable: async (id) => {
				let dp = s.settings.disabled_plugins || [];
				dp = dp.filter(x => x !== id);
				api.state.update(st => st.settings.disabled_plugins = dp);
				await FSManager.write('.fluxide/settings.json', JSON.stringify(s.settings, null, '\t'));
			},
			disable: async (id) => {
				let dp = s.settings.disabled_plugins || [];
				if (!dp.includes(id)) dp.push(id);
				api.state.update(st => st.settings.disabled_plugins = dp);
				await FSManager.write('.fluxide/settings.json', JSON.stringify(s.settings, null, '\t'));
				const p = r.plugins.get(id);
				if (p && p.onDisable) await p.onDisable(api);
			},
			uninstall: async (id) => {
				const p = r.plugins.get(id);
				if (p && p.onUninstall) {
					const proceed = await p.onUninstall(api);
					if (proceed === false) return false;
				}
				if (p && p.unmount) p.unmount(api);
				const prefix = `plugins/${id}/`;
				for (const path of Object.keys(s.vfs)) {
					if (path.startsWith(prefix)) {
						delete s.vfs[path];
						await FSManager.remove(path);
					}
				}
				r.plugins.delete(id);
				r.loadedPlugins.delete(id);
				if (p && p.view) {
					r.views.delete(p.view.id);
					if (s.activeView === p.view.id) api.ui.openView('ide');
					else api.ui.openView(s.activeView);
				}
				return true;
			},
			reload: async (id) => {
				const p = r.plugins.get(id);
				if (p && p.unmount) p.unmount(api);
				if (p && p.view) r.views.delete(p.view.id);
				r.plugins.delete(id);
				const prefix = `plugins/${id}/`;
				Object.keys(m).forEach(k => { if(k.startsWith(prefix)) delete m[k]; });
				const metaContent = s.vfs[`plugins/${id}/plugin.json`];
				if (!metaContent) return false;
				try {
					const meta = JSON.parse(metaContent);
					if(meta.entry) {
						bootloader.require(meta.entry, `plugins/${id}`);
						r.loadedPlugins.set(id, meta);
						if (s.activeView === (p && p.view && p.view.id)) api.ui.openView(s.activeView);
						else api.ui.openView(s.activeView);
						return true;
					}
				} catch(e) { return false; }
				return false;
			}
		},
		keybinds: {
			register: (id, key, action, description) => {
				const ex = r.keybinds.findIndex(k => k.id === id);
				if(ex > -1) r.keybinds[ex] = { id, key, action, description };
				else r.keybinds.push({ id, key, action, description });
			},
			getAll: () => r.keybinds
		},
		ui: {
			h: window.h || ((tag, props = {}, children = []) => {
                const el = document.createElement(tag);
                for (let k in props) {
                    if (k === 'style' && typeof props[k] === 'object') Object.assign(el.style, props[k]);
                    else if (k.startsWith('on') && typeof props[k] === 'function') el.addEventListener(k.substring(2).toLowerCase(), props[k]);
                    else if (k === 'class') el.className = props[k];
                    else el[k] = props[k];
                }
                if (props.innerHTML) el.innerHTML = props.innerHTML;
                else if (Array.isArray(children)) children.forEach(c => { if(c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
                else if (children) el.appendChild(typeof children === 'string' ? document.createTextNode(children) : children);
                return el;
            }),
			markdown: (t) => {
				if(!window.marked) return t;
				window.marked.setOptions({
					highlight: (code, lang) => {
						if (window.hljs && lang && window.hljs.getLanguage(lang)) {
							try { return window.hljs.highlight(code, { language: lang }).value; } catch(e) {}
						}
						return code;
					}
				});
				return window.marked.parse(t);
			},
			openView: (id) => {
				const prev = r.views.get(s.activeView); if(prev && prev.unmount) prev.unmount();
				s.activeView = id; const viewport = document.getElementById('fx-viewport');
				viewport.style.cssText = ''; viewport.className = ''; viewport.innerHTML = '';
				const plugin = r.views.get(id); if(plugin && plugin.render) plugin.render(viewport, api);
				
				const nav = document.getElementById('fx-nav'); nav.innerHTML = '';
				const sortedViews = Array.from(r.views.values()).filter(p => p.view.nav).sort((a,b) => (a.view.order || 0) - (b.view.order || 0));
				sortedViews.forEach(p => nav.appendChild(api.ui.h('button', { class: 'fx-btn' + (s.activeView === p.view.id ? ' fx-btn-primary' : ''), style: { letterSpacing: '0.5px' }, onClick: () => api.ui.openView(p.view.id) }, p.view.label.toUpperCase())));
			},
			context: (e, items) => {
				e.preventDefault(); e.stopPropagation();
				const menu = document.getElementById('fx-ctx-menu');
				const overlay = document.getElementById('fx-ctx-overlay');
				
				menu.innerHTML = '';
				items.forEach(i => {
					if (i.sep) { menu.appendChild(api.ui.h('div', {class: 'ctx-sep'})); return; }
					const leftWrap = api.ui.h('div', { class: 'ctx-item-left' }, [ api.ui.h('div', { class: 'ctx-item-icon', innerHTML: i.icon || '' }), api.ui.h('span', {}, i.label) ]);
					const itemHtml = [ leftWrap ];
					if (i.key) itemHtml.push(api.ui.h('span', {class: 'ctx-keybind'}, i.key));
					menu.appendChild(api.ui.h('div', { class: 'ctx-item' + (i.danger ? ' danger' : ''), onClick: () => { if(i.action) i.action(); overlay.click(); } }, itemHtml));
				});
				
				menu.style.display = 'block'; overlay.style.display = 'block';
				const scale = parseFloat(s.settings.ui_scale || '1.0');
				let left = e.clientX / scale; let top = e.clientY / scale;
				if(left + (menu.offsetWidth/scale) > (window.innerWidth/scale)) left -= (menu.offsetWidth/scale);
				if(top + (menu.offsetHeight/scale) > (window.innerHeight/scale)) top -= (menu.offsetHeight/scale);
				menu.style.left = left + 'px'; menu.style.top = top + 'px';
				
				overlay.onclick = () => { menu.style.display = 'none'; overlay.style.display = 'none'; overlay.onclick = null; };
				overlay.oncontextmenu = (ev) => { ev.preventDefault(); overlay.click(); };
			},
			prompt: (title, placeholder = "") => {
				return new Promise(resolve => {
					api.ui.modal((win) => {
						win.appendChild(api.ui.h('div', { class: 'fx-modal-body' }, [
							api.ui.h('div', { style: { fontSize: '12px', fontWeight: 800, color: 'var(--text-dim)', marginBottom: '15px', letterSpacing: '1px' } }, title.toUpperCase()),
							api.ui.h('input', { id: 'prompt-in', class: 'fx-input', placeholder: placeholder, onKeyDown: (e) => { if(e.key === 'Enter') document.getElementById('p-ok').click(); } }),
							api.ui.h('div', { style: { marginTop: '25px', display: 'flex', justifyContent: 'flex-end', gap: '10px' } }, [
								api.ui.h('button', { id: 'p-cancel', class: 'fx-btn', onClick: () => { resolve(null); api.ui.modal.close(); } }, 'Cancel'),
								api.ui.h('button', { id: 'p-ok', class: 'fx-btn fx-btn-primary', onClick: () => { resolve(document.getElementById('prompt-in').value); api.ui.modal.close(); } }, 'Confirm')
							])
						]));
						setTimeout(() => document.getElementById('prompt-in').focus(), 50);
					});
				});
			}
		},
		register: (p) => {
			r.plugins.set(p.id, p);
			if(p.view) r.views.set(p.view.id, p);
			if(p.init) p.init(api);
		}
	};

	let _modal = Object.assign((render) => {
		const overlay = document.getElementById('fx-modal-overlay'); const win = document.getElementById('fx-modal-window');
		win.style.cssText = ''; win.innerHTML = ''; render(win); overlay.style.display = 'flex'; setTimeout(() => win.classList.add('open'), 10);
		overlay.onclick = (e) => { if (e.target === overlay) { api.emit('settings:cancel'); api.ui.modal.close(); } };
	}, { 
		close: () => {
			const win = document.getElementById('fx-modal-window'); win.classList.remove('open');
			setTimeout(() => { document.getElementById('fx-modal-overlay').style.display = 'none'; document.getElementById('fx-modal-overlay').onclick = null; }, 200);
		} 
	});

	Object.defineProperty(api.ui, 'modal', {
		get: () => _modal,
		set: (v) => { if (v && typeof v === 'function' && !v.close) v.close = _modal.close; _modal = v; },
		enumerable: true, configurable: true
	});

	api.registerPlugin = api.register;
	window.Fluxide = api;
	window.api = api;

	const bootloader = {
		async boot() {
			const mountScreen = document.getElementById('fx-mount-screen');
			const btn = document.getElementById('fx-btn-new-mount');
			const status = await FSManager.init();
			
            if (status === true) { 
                mountScreen.style.display = 'none'; 
                await this.startServices(); 
            } else if (status === 'prompt') {
                mountScreen.style.display = 'none';
                const overlay = document.createElement('div');
                overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;color:var(--text);font-family:var(--font);font-size:18px;font-weight:600;cursor:pointer;backdrop-filter:blur(5px); transition: 0.3s;';
                overlay.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;gap:16px;"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg><span>Click anywhere to resume workspace</span></div>';
                document.body.appendChild(overlay);
                overlay.onclick = async () => {
                    const handle = await IDB.get('workspace_handle');
                    if ((await handle.requestPermission({ mode: 'readwrite' })) === 'granted') {
                        FSManager.dirHandle = handle;
                        FSManager.dirCache.clear();
                        overlay.style.opacity = '0';
                        setTimeout(() => { overlay.remove(); this.startServices(); }, 300);
                    }
                };
			} else {
				btn.onclick = async () => { 
                    if (await FSManager.mount()) { 
                        mountScreen.style.opacity = '0'; 
                        setTimeout(() => { mountScreen.style.display = 'none'; this.startServices(); }, 300); 
                    } 
                };
			}
		},

		async startServices() {
			const loadScreen = document.getElementById('fx-loading-screen');
			const isInit = await FSManager.exists('.fluxide/init.json');
			
			if (!isInit) {
				loadScreen.style.display = 'flex';
				const text = document.getElementById('fx-loading-text');
				const bar = document.getElementById('fx-loading-bar');
				
				const defaultFilesToFetch = [
					'icon-packs/default/main.json',
					'icon-packs/default/icons/terminal.svg',
					'icon-packs/default/icons/search.svg',
					'icon-packs/default/icons/replace.svg',
					'icon-packs/default/icons/matchCase.svg',
					'icon-packs/default/icons/matchWord.svg',
					'icon-packs/default/icons/arrowUp.svg',
					'icon-packs/default/icons/arrowDown.svg',
					'icon-packs/default/icons/close.svg',
					'icon-packs/default/icons/chevronRight.svg',
					'icon-packs/default/icons/chevronDown.svg',
					'icon-packs/default/icons/refresh.svg',
					'icon-packs/default/icons/collapseAll.svg',
					'icon-packs/default/icons/docs.svg',
					'icon-packs/default/icons/save.svg',
					'icon-packs/default/icons/pencil.svg',
					'icon-packs/default/icons/trash.svg',
					'icon-packs/default/icons/newFile.svg',
					'icon-packs/default/icons/newFolder.svg',
					'icon-packs/default/icons/plugin.svg',
					'icon-packs/default/icons/file.svg',
					'icon-packs/default/icons/file-js.svg',
					'icon-packs/default/icons/file-json.svg',
					'icon-packs/default/icons/file-md.svg',
					'icon-packs/default/icons/file-css.svg',
					'icon-packs/default/icons/file-html.svg',
					'icon-packs/default/icons/folder.svg',
					'icon-packs/default/icons/folder-open.svg',
					'themes/dracula/theme.json',
					'themes/catppuccin/theme.json',
					'themes/flat_dark/theme.json',
					'sys/themes.js',
					'sys/settings.js',
					'sys/ide.js',
					'sys/spark.js',
					'sys/docs/index.json',
					'sys/docs/kernel/state_events.md',
					'sys/docs/kernel/registry.md',
					'sys/docs/kernel/fs.md',
					'sys/docs/ui/ui.md',
					'sys/docs/ui/theme.md',
					'sys/docs/ui/settings.md',
					'sys/docs/ui/keybinds.md',
					'sys/docs/ide/ide.md',
					'plugins/workspace_zip/plugin.json',
					'plugins/workspace_zip/src/main.js',
					'plugins/manager/plugin.json',
					'plugins/manager/src/main.js'
				];

                const fetchedData = {};
                const totalSteps = defaultFilesToFetch.length * 2;
                let stepCount = 0;

				try {
					for(let i=0; i < defaultFilesToFetch.length; i++) {
						const path = defaultFilesToFetch[i];
						if (await FSManager.exists(path)) { stepCount += 2; continue; }
						text.innerText = 'Downloading: ' + path;
						bar.style.width = ((stepCount / totalSteps) * 100) + '%';
						const res = await fetch('./vfs-defaults/' + path + '?t=' + Date.now());
						if (!res.ok) throw new Error(res.status);
                        fetchedData[path] = await res.text();
                        stepCount++;
					}
				} catch(err) {
					text.innerText = "Error: You MUST run this via a Local Web Server to fetch files.";
					text.style.color = "#ef4444";
					return;
				}

				text.innerText = 'Writing files to workspace...';

                const initWorkspace = { columns: [ { id: 'c1', title: 'BACKLOG', tasks: [] }, { id: 'c2', title: 'IN PROGRESS', tasks: [] }, { id: 'c3', title: 'DONE', tasks: [] } ] };
                fetchedData['.fluxide/workspace.json'] = JSON.stringify(initWorkspace, null, '\t');
                fetchedData['.fluxide/settings.json'] = JSON.stringify(s.settings, null, '\t');
                fetchedData['.fluxide/init.json'] = JSON.stringify({initialized: true, timestamp: Date.now()}, null, '\t');

                const entries = Object.entries(fetchedData);
                for (let i = 0; i < entries.length; i++) {
                    const [p, c] = entries[i];
                    await FSManager.write(p, c);
                    stepCount++;
                    bar.style.width = ((stepCount / totalSteps) * 100) + '%';
                }

                bar.style.width = '100%';
				text.innerText = 'Complete. Reloading system...';
				await new Promise(r => setTimeout(r, 400));
                api.forceReload();
                return;
			}

			s.vfs = await FSManager.scanWorkspace();
			const wsStr = await FSManager.read('.fluxide/workspace.json'); if(wsStr) s.workspace = JSON.parse(wsStr);
			const setStr = await FSManager.read('.fluxide/settings.json'); if(setStr) s.settings = { ...s.settings, ...JSON.parse(setStr) };

			api.on('workspace:change', () => FSManager.write('.fluxide/workspace.json', JSON.stringify(s.workspace, null, '\t')));
			api.on('settings:change', () => FSManager.write('.fluxide/settings.json', JSON.stringify(s.settings, null, '\t')));

			window.addEventListener('keydown', (e) => {
				const combo = formatCombo(e);
				r.keybinds.forEach(kb => { if(combo === kb.key) { e.preventDefault(); kb.action(); } });
			});

			const tip = document.getElementById('fx-tooltip');
			document.addEventListener('mouseover', (e) => {
				const txt = e.target.getAttribute('data-tooltip');
				if(txt) { 
					tip.innerText = txt; tip.style.display = 'block'; 
					const scale = parseFloat(s.settings.ui_scale || '1.0');
					tip.style.left = (e.clientX / scale) + 10 + 'px'; 
					tip.style.top = (e.clientY / scale) + 10 + 'px'; 
				}
			});
			document.addEventListener('mouseout', () => tip.style.display = 'none');

			['sys/settings.js', 'sys/themes.js', 'sys/ide.js', 'sys/spark.js'].forEach(p => { 
                if(s.vfs[p]) {
                    try { this.require(p); } catch(e) {}
                }
            });
			
			const queue = [];
            const dp = s.settings.disabled_plugins || [];
			Object.keys(s.vfs).forEach(path => {
				if (path.startsWith('plugins/') && path.endsWith('/plugin.json')) {
                    const parts = path.split('/');
                    if(parts.length !== 3) return;
                    const pid = parts[1];
                    if(dp.includes(pid)) return;
					try {
                        const meta = JSON.parse(s.vfs[path]);
                        if(!meta.name || !meta.version || !meta.entry || !meta.entry.startsWith('./')) return;
                        queue.push({ meta, dirName: path.substring(0, path.lastIndexOf('/')) });
                    } catch(e) {}
				}
			});

			const sorted = [];
			const visited = new Set();
			const visiting = new Set();
			const failedPlugins = new Set();

			const visit = (p) => {
				if (visited.has(p.meta.id)) return !failedPlugins.has(p.meta.id);
				if (visiting.has(p.meta.id)) { failedPlugins.add(p.meta.id); return false; }
				visiting.add(p.meta.id);
				let depsMet = true;
				(p.meta.deps || []).forEach(d => {
					const dId = typeof d === 'string' ? d : d.id;
					const dType = typeof d === 'string' ? 'hard' : (d.type || 'hard');
					const dVer = typeof d === 'string' ? '*' : (d.version || '*');
					const depNode = queue.find(q => q.meta.id === dId);
					if (depNode) {
						if (semverSatisfies(depNode.meta.version, dVer)) {
							const ok = visit(depNode);
							if (!ok && dType === 'hard') depsMet = false;
						} else if (dType === 'hard') depsMet = false;
					} else if (dType === 'hard') depsMet = false;
				});
				visiting.delete(p.meta.id);
				visited.add(p.meta.id);
				if (!depsMet) { failedPlugins.add(p.meta.id); return false; }
				sorted.push(p);
				return true;
			};
			queue.forEach(visit);

			sorted.forEach(p => { 
				if(p.meta.entry) {
                    try {
					    this.require(p.meta.entry, p.dirName); 
					    r.loadedPlugins.set(p.meta.id, p.meta);
                    } catch(e) {}
				}
			});

			api.ui.openView(s.activeView);
		},

		require(path, currentDir = '') {
			let target = resolvePath(currentDir, path);
			if (!target.endsWith('.js') && !target.endsWith('.json')) target += '.js';
			if (m[target]) return m[target].exports;
			const content = s.vfs[target];
			if (content === undefined) throw new Error(target);
			if (target.endsWith('.json')) { const exp = JSON.parse(content); m[target] = { exports: exp }; return exp; }
			const module = { exports: {} }; m[target] = module;
			const dirName = target.includes('/') ? target.substring(0, target.lastIndexOf('/')) : '';
			
            try {
                const wrapper = new Function('module', 'exports', 'require', 'Fluxide', 'api', 'fluxide', '__dirname', '__filename', content + '\n//# sourceURL=' + target);
			    wrapper(module, module.exports, (p) => this.require(p, dirName), api, api, api, dirName, target);
            } catch (e) {
                let line = 1, ch = 0;
                const lines = (e.stack || '').split('\n');
                const targetLine = lines.find(l => l.includes(target) || l.includes('<anonymous>'));
                if (targetLine) {
                    const match = targetLine.match(/:(\d+):(\d+)/);
                    if (match) { line = Math.max(1, parseInt(match[1]) - 2); ch = parseInt(match[2]); }
                }
                if (!s.startupErrors) s.startupErrors = [];
                s.startupErrors.push({ path: target, error: e.toString(), line, ch });
                throw e;
            }
			return module.exports;
		}
	};

	return bootloader;
})();

window.onload = () => fluxide.boot();