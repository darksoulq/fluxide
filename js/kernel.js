const fluxide = (() => {
	const r = { plugins: new Map(), views: new Map(), hooks: {}, components: new Map(), settings: [], keybinds: [] };
	const m = {};
	const s = { activeView: 'ide', vfs: {}, settings: { theme: 'dracula', ui_scale: '1.0', dev_mode: 'false', word_wrap: 'false', code_folding: 'true', active_line: 'true', line_numbers: 'true', tab_size: '4', use_tabs: 'true', match_brackets: 'true', auto_close_brackets: 'true' }, workspace: null };

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

	const api = {
		state: { get: () => s, update: (fn) => fn(s) },
		fs: FSManager,
		on: (e, cb) => { if(!r.hooks[e]) r.hooks[e] = []; r.hooks[e].push(cb); },
		emit: (e, d) => { if(r.hooks[e]) r.hooks[e].forEach(cb => cb(d)); },
		expose: (id, obj) => { api[id] = obj; },
		exposeApi: (id, obj) => { api[id] = obj; },
		registerComponent: (slot, comp) => { if(!r.components.has(slot)) r.components.set(slot, new Map()); r.components.get(slot).set(comp.id, comp); },
		getComponents: (slot) => Array.from((r.components.get(slot) || new Map()).values()),
		registerSetting: (cat, st) => { r.settings.push({ category: cat, ...st }); },
		getSettings: () => r.settings,
		keybinds: {
			register: (id, key, action, description) => {
				const ex = r.keybinds.findIndex(k => k.id === id);
				if(ex > -1) r.keybinds[ex] = { id, key, action, description };
				else r.keybinds.push({ id, key, action, description });
			},
			getAll: () => r.keybinds
		},
		ui: {
			h,
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
				sortedViews.forEach(p => nav.appendChild(h('button', { class: 'fx-btn' + (s.activeView === p.view.id ? ' fx-btn-primary' : ''), style: { letterSpacing: '0.5px' }, onClick: () => api.ui.openView(p.view.id) }, p.view.label.toUpperCase())));
			},
			context: (e, items) => {
				e.preventDefault(); e.stopPropagation();
				const menu = document.getElementById('fx-ctx-menu');
				const overlay = document.getElementById('fx-ctx-overlay');
				
				menu.innerHTML = '';
				items.forEach(i => {
					if (i.sep) { menu.appendChild(h('div', {class: 'ctx-sep'})); return; }
					const leftWrap = h('div', { class: 'ctx-item-left' }, [ h('div', { class: 'ctx-item-icon', innerHTML: i.icon || '' }), h('span', {}, i.label) ]);
					const itemHtml = [ leftWrap ];
					if (i.key) itemHtml.push(h('span', {class: 'ctx-keybind'}, i.key));
					menu.appendChild(h('div', { class: 'ctx-item' + (i.danger ? ' danger' : ''), onClick: () => { if(i.action) i.action(); overlay.click(); } }, itemHtml));
				});
				
				menu.style.display = 'block'; overlay.style.display = 'block';
				let left = e.clientX; let top = e.clientY;
				if(left + menu.offsetWidth > window.innerWidth) left -= menu.offsetWidth;
				if(top + menu.offsetHeight > window.innerHeight) top -= menu.offsetHeight;
				menu.style.left = left + 'px'; menu.style.top = top + 'px';
				
				overlay.onclick = () => { menu.style.display = 'none'; overlay.style.display = 'none'; overlay.onclick = null; };
				overlay.oncontextmenu = (ev) => { ev.preventDefault(); overlay.click(); };
			},
			prompt: (title, placeholder = "") => {
				return new Promise(resolve => {
					api.ui.modal((win) => {
						win.appendChild(h('div', { class: 'fx-modal-body' }, [
							h('div', { style: { fontSize: '12px', fontWeight: 800, color: 'var(--text-dim)', marginBottom: '15px', letterSpacing: '1px' } }, title.toUpperCase()),
							h('input', { id: 'prompt-in', class: 'fx-input', placeholder: placeholder, onKeyDown: (e) => { if(e.key === 'Enter') document.getElementById('p-ok').click(); } }),
							h('div', { style: { marginTop: '25px', display: 'flex', justifyContent: 'flex-end', gap: '10px' } }, [
								h('button', { id: 'p-cancel', class: 'fx-btn', onClick: () => { resolve(null); api.ui.modal.close(); } }, 'Cancel'),
								h('button', { id: 'p-ok', class: 'fx-btn fx-btn-primary', onClick: () => { resolve(document.getElementById('prompt-in').value); api.ui.modal.close(); } }, 'Confirm')
							])
						]));
						setTimeout(() => document.getElementById('prompt-in').focus(), 50);
					});
				});
			},
			modal: Object.assign((render) => {
				const overlay = document.getElementById('fx-modal-overlay'); const win = document.getElementById('fx-modal-window');
				win.style.cssText = ''; win.innerHTML = ''; render(win); overlay.style.display = 'flex'; setTimeout(() => win.classList.add('open'), 10);
				overlay.onclick = (e) => { if (e.target === overlay) api.ui.modal.close(); };
			}, { 
				close: () => {
					const win = document.getElementById('fx-modal-window'); win.classList.remove('open');
					setTimeout(() => { document.getElementById('fx-modal-overlay').style.display = 'none'; document.getElementById('fx-modal-overlay').onclick = null; }, 200);
				} 
			})
		},
		register: (p) => {
			r.plugins.set(p.id, p);
			if(p.view) r.views.set(p.view.id, p);
			if(p.init) p.init(api);
		}
	};
	
	api.registerPlugin = api.register;
	window.Fluxide = api;
	window.api = api;

	const bootloader = {
		async boot() {
			const mountScreen = document.getElementById('fx-mount-screen');
			const btn = document.getElementById('fx-btn-new-mount');
			const status = await FSManager.init();
			if (status === true) { mountScreen.style.display = 'none'; await this.startServices(); } 
			else if (status === 'prompt') {
				btn.innerText = 'Resume Workspace';
				btn.onclick = async () => {
					const handle = await IDB.get('workspace_handle');
					if ((await handle.requestPermission({ mode: 'readwrite' })) === 'granted') {
						FSManager.dirHandle = handle; mountScreen.style.opacity = '0'; setTimeout(() => { mountScreen.style.display = 'none'; this.startServices(); }, 300);
					}
				};
			} else {
				btn.onclick = async () => { if (await FSManager.mount()) { mountScreen.style.opacity = '0'; setTimeout(() => { mountScreen.style.display = 'none'; this.startServices(); }, 300); } };
			}
		},

		async startServices() {
			const loadScreen = document.getElementById('fx-loading-screen');
			const isInit = await FSManager.exists('.fluxide/init.json');
			const hasIcons = await FSManager.exists('icon-packs/default.json');
			
			if (!isInit || !hasIcons) {
				loadScreen.style.display = 'flex';
				const text = document.getElementById('fx-loading-text');
				const bar = document.getElementById('fx-loading-bar');
				
				const defaultFilesToFetch = [
					'icon-packs/default.json',
					'themes/dracula.json',
					'themes/catppuccin.json',
					'themes/flat_dark.json',
					'sys/themes.js',
					'sys/settings.js',
					'sys/ide.js',
					'sys/docs/index.json',
					'sys/docs/kernel/state_events.md',
					'sys/docs/kernel/fs.md',
					'sys/docs/kernel/ui.md',
					'sys/docs/kernel/registry.md',
					'sys/docs/sys/theme.md',
					'sys/docs/sys/ide.md',
					'plugins/board/plugin.json',
					'plugins/board/src/main.js',
					'plugins/board/src/task_viewer.js',
					'plugins/board/docs/index.json',
					'plugins/board/docs/api_board.md',
					'plugins/board/docs/api_task.md',
					'plugins/board/docs/components.md',
					'plugins/board/docs/context_menus.md',
					'plugins/board/docs/theme.md',
					'plugins/graph/plugin.json',
					'plugins/graph/src/main.js',
					'plugins/graph/docs/index.json',
					'plugins/graph/docs/api_graph.md',
					'plugins/graph/docs/theme.md',
					'plugins/workspace_zip/plugin.json',
					'plugins/workspace_zip/src/main.js',
					'plugins/manager/plugin.json',
					'plugins/manager/src/main.js'
				];

				try {
					for(let i=0; i < defaultFilesToFetch.length; i++) {
						const path = defaultFilesToFetch[i];
						text.innerText = 'Downloading: ' + path;
						bar.style.width = ((i / defaultFilesToFetch.length) * 100) + '%';
						const res = await fetch('./vfs-defaults/' + path);
						if (!res.ok) throw new Error(res.status);
						await FSManager.write(path, await res.text());
					}
				} catch(err) {
					text.innerText = "Error: You MUST run this via a Local Web Server to fetch files.";
					text.style.color = "#ef4444";
					return;
				}

				text.innerText = 'Provisioning State...';
				const initWorkspace = {
					columns: [
						{ id: 'c1', title: 'BACKLOG', tasks: [] },
						{ id: 'c2', title: 'IN PROGRESS', tasks: [] },
						{ id: 'c3', title: 'DONE', tasks: [] }
					]
				};
				await FSManager.write('.fluxide/workspace.json', JSON.stringify(initWorkspace, null, '\t'));
				await FSManager.write('.fluxide/settings.json', JSON.stringify(s.settings, null, '\t'));
				await FSManager.write('.fluxide/init.json', JSON.stringify({initialized: true, timestamp: Date.now()}, null, '\t'));

				bar.style.width = '100%';
				text.innerText = 'Complete.';
				await new Promise(r => setTimeout(r, 400));
				loadScreen.style.opacity = '0';
				setTimeout(() => loadScreen.style.display = 'none', 300);
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
				if(txt) { tip.innerText = txt; tip.style.display = 'block'; tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px'; }
			});
			document.addEventListener('mouseout', () => tip.style.display = 'none');

			['sys/settings.js', 'sys/themes.js', 'sys/ide.js'].forEach(p => { if(s.vfs[p]) this.require(p); });
			
			const queue = [];
			Object.keys(s.vfs).forEach(path => {
				if (path.startsWith('plugins/') && path.endsWith('/plugin.json')) {
					try { queue.push({ meta: JSON.parse(s.vfs[path]), dirName: path.substring(0, path.lastIndexOf('/')) }); } catch(e) {}
				}
			});

			const sorted = [];
			const visited = new Set();
			const visit = (p) => {
				if (visited.has(p.meta.id)) return;
				(p.meta.deps || []).forEach(depId => { const dep = queue.find(q => q.meta.id === depId); if (dep) visit(dep); });
				visited.add(p.meta.id); sorted.push(p);
			};
			queue.forEach(visit);
			sorted.forEach(p => { if(p.meta.entry) this.require(p.meta.entry, p.dirName); });

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
			const wrapper = new Function('module', 'exports', 'require', 'Fluxide', 'api', 'fluxide', '__dirname', '__filename', content);
			wrapper(module, module.exports, (p) => this.require(p, dirName), api, api, api, dirName, target);
			return module.exports;
		}
	};

	return bootloader;
})();

window.onload = () => fluxide.boot();