const { h, prompt, context, modal } = fluxide.ui;
const { state, emit, on, expose, theme } = fluxide;

const IDE = {
	openTabs: [],
	activeTab: null,
	expandedDirs: new Set(['plugins', 'themes', 'icon-packs']),
	dirtyFiles: new Set(),
	consoleVisible: false,
	cm: null,
	treeEl: null,
	tabsEl: null,
	editorContainer: null,
	statusBar: null,
	consoleLogs: null,
	consoleEl: null,
	_container: null,

	searchMarks: [],
	searchState: { q: '', r: '', case: false, word: false, cursor: null, matchCount: 0, current: 0, replaceOpen: false },

	init() {
		this.openFile = this.openFile.bind(this);
		this.closeTab = this.closeTab.bind(this);
		this.renderFull = this.renderFull.bind(this);
		this.renderTabs = this.renderTabs.bind(this);
		this.renderTree = this.renderTree.bind(this);
		this.openDocsModal = this.openDocsModal.bind(this);
		this.openQuickSearch = this.openQuickSearch.bind(this);
		this.logToConsole = this.logToConsole.bind(this);
		this.toggleSearch = this.toggleSearch.bind(this);
		this.openProjectCreationModal = this.openProjectCreationModal.bind(this);

		expose('ide', { 
			openFile: this.openFile, 
			closeTab: this.closeTab, 
			switchTab: this.openFile,
			getActiveTab: () => this.activeTab,
			getOpenTabs: () => [...this.openTabs],
			listFiles: () => Object.keys(state.get().vfs),
			log: this.logToConsole,
			clearLogs: () => { if(this.consoleLogs) this.consoleLogs.innerHTML = ''; },
			headerTools: [],
			treeContext: [],
			editorContext: [],
			addHeaderTool: (t) => { fluxide.ide.headerTools.push(t); if(this._container) this.render(this._container); },
			addTreeContext: (i) => fluxide.ide.treeContext.push(i),
			addEditorContext: (i) => fluxide.ide.editorContext.push(i)
		});

		fluxide.keybinds.register('ide.save', 'Ctrl-S', async () => { 
			if(this.activeTab && this.cm) { 
				await fluxide.fs.write(this.activeTab, this.cm.getValue());
				this.dirtyFiles.delete(this.activeTab);
				this.renderTabs();
				this.logToConsole(`Saved: ${this.activeTab}`, 'success');
				emit('ide:file_saved', this.activeTab);
			} 
		}, "Save Current File");
		
		fluxide.keybinds.register('ide.closeTab', 'Ctrl-W', () => { if(this.activeTab) this.closeTab(this.activeTab); }, "Close Active Tab");
		fluxide.keybinds.register('ide.quickOpen', 'Ctrl-P', () => { this.openQuickSearch(); }, "Quick Open File Search");
		fluxide.keybinds.register('ide.toggleConsole', 'Ctrl-`', () => { this.toggleConsole(); }, "Toggle Output Console");
		fluxide.keybinds.register('ide.search', 'Ctrl-F', () => { this.toggleSearch(false); }, "Search within file");
		fluxide.keybinds.register('ide.replace', 'Ctrl-H', () => { this.toggleSearch(true); }, "Replace within file");
		
		fluxide.settings.register('editor.general', {
			label: 'General',
			defaults: { word_wrap: 'false', code_folding: 'true', active_line: 'true', line_numbers: 'true', tab_size: '4', use_tabs: 'true', match_brackets: 'true', auto_close_brackets: 'true', font_size: '14' }
		});
		
		on('settings:render:editor.general', ({container}) => {
			container.appendChild(h('h2', { style: { marginTop: 0, marginBottom: '24px', fontSize: '20px' } }, 'Editor Settings'));
			container.appendChild(fluxide.settings.createControl('Font Size', 'number', 'font_size'));
			container.appendChild(fluxide.settings.createControl('Tab Size', 'number', 'tab_size'));
			container.appendChild(fluxide.settings.createControl('Word Wrap', 'toggle', 'word_wrap'));
			container.appendChild(fluxide.settings.createControl('Code Folding', 'toggle', 'code_folding'));
			container.appendChild(fluxide.settings.createControl('Active Line Highlight', 'toggle', 'active_line'));
			container.appendChild(fluxide.settings.createControl('Line Numbers', 'toggle', 'line_numbers'));
			container.appendChild(fluxide.settings.createControl('Use Tabs', 'toggle', 'use_tabs'));
			container.appendChild(fluxide.settings.createControl('Match Brackets', 'toggle', 'auto_close_brackets'));
			container.appendChild(fluxide.settings.createControl('Auto Close Brackets', 'toggle', 'auto_close_brackets'));
		});

		on('workspace:change', () => { if(state.get().activeView === 'ide') this.renderTree(); });
		on('settings:change', () => { this.updateEditorSettings(); });
	},

	openFile(path) {
		let isNew = false;
		if (!this.openTabs.includes(path)) {
			this.openTabs.push(path);
			isNew = true;
		}
		this.activeTab = path;
		this.closeSearch();
		if (state.get().activeView === 'ide') this.renderFull();
		if (isNew) emit('ide:file_opened', path);
		emit('ide:tab_switched', path);
	},

	closeTab(path) {
		this.openTabs = this.openTabs.filter(t => t !== path);
		this.dirtyFiles.delete(path);
		if (this.activeTab === path) {
			this.activeTab = this.openTabs[this.openTabs.length - 1] || null;
			emit('ide:tab_switched', this.activeTab);
		}
		this.closeSearch();
		this.renderFull();
		emit('ide:file_closed', path);
	},

	openQuickSearch() {
		modal(win => {
			const devMode = state.get().settings.dev_mode === 'true';
			const paths = Object.keys(state.get().vfs).filter(p => {
				if (p.endsWith('/.keep')) return false;
				const rootDir = p.split('/')[0];
				if (rootDir === 'sys' && !devMode) return false;
				return true;
			});
			const inputContainer = h('div', { style: { display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 12px' } }, [
				h('div', { innerHTML: theme.getIcon('search'), style: { width: '16px', height: '16px', color: 'var(--text-dim)' } }),
				h('input', { class: 'fx-input', style: { border: 'none', background: 'transparent', boxShadow: 'none' }, placeholder: 'Search files...' })
			]);
			const input = inputContainer.querySelector('input');
			const list = h('div', { style: { marginTop: '10px', maxHeight: '350px', overflowY: 'auto' } });
			
			const renderList = (filter) => {
				list.innerHTML = '';
				const f = filter.toLowerCase();
				paths.filter(p => p.toLowerCase().includes(f)).slice(0, 50).forEach(p => {
					list.appendChild(h('div', {
						class: 'ctx-item',
						style: { padding: '10px 14px', borderBottom: '1px solid var(--border)', gap: '12px' },
						onClick: () => { modal.close(); this.openFile(p); }
					}, [ h('div', { style: { width: '16px', height: '16px', display: 'flex', alignItems: 'center' }, innerHTML: theme.getFileIconHtml(p) }), h('div', {}, p) ]));
				});
			};
			input.oninput = (e) => renderList(e.target.value);
			win.appendChild(h('div', { class: 'fx-modal-body' }, [ h('h3', { style: { marginTop: 0, marginBottom: '20px', fontSize: '14px', color: 'var(--text-dim)' } }, 'Quick Open (Ctrl-P)'), inputContainer, list ]));
			renderList('');
			setTimeout(() => input.focus(), 50);
		});
		const overlay = document.getElementById('fx-modal-overlay');
		overlay.onclick = (e) => { if (e.target === overlay) modal.close(); };
	},

	logToConsole(msg, type = 'info') {
		if(!this.consoleLogs) return;
		const d = new Date();
		const timeStr = `[${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}]`;
        const msgSpan = h('span', { class: 'log-msg' });
        if (typeof msg === 'string') msgSpan.innerText = msg;
        else if (msg instanceof HTMLElement) msgSpan.appendChild(msg);

		this.consoleLogs.appendChild(h('div', { class: 'log-line log-' + type }, [ h('span', { class: 'log-time' }, timeStr), msgSpan ]));
		this.consoleLogs.scrollTop = this.consoleLogs.scrollHeight;
	},

	toggleConsole() {
		this.consoleVisible = !this.consoleVisible;
		if(this.consoleEl) this.consoleEl.style.height = this.consoleVisible ? '200px' : '0px';
		if(this.cm) setTimeout(() => this.cm.refresh(), 210);
	},

	buildSearchPanel() {
		this.searchPanelEl = h('div', { class: 'fx-search-panel', style: { display: 'none' } });
		
		this.sInput = h('input', { class: 'fx-search-input', placeholder: 'Find' });
		this.rInput = h('input', { class: 'fx-search-input', placeholder: 'Replace' });
		
		const btnCase = h('button', { class: 'fx-search-opt', innerHTML: theme.getIcon('matchCase'), title: 'Match Case', onClick: () => { this.searchState.case = !this.searchState.case; btnCase.className = 'fx-search-opt' + (this.searchState.case?' active':''); this.runSearch(); } });
		const btnWord = h('button', { class: 'fx-search-opt', innerHTML: theme.getIcon('matchWord'), title: 'Match Whole Word', onClick: () => { this.searchState.word = !this.searchState.word; btnWord.className = 'fx-search-opt' + (this.searchState.word?' active':''); this.runSearch(); } });
		
		this.sCount = h('span', { class: 'fx-search-count' }, '0 of 0');
		
		this.rRow = h('div', { class: 'fx-search-row fx-replace-row', style: { display: 'none' } }, [
			h('div', { class: 'fx-search-input-wrap', style: { marginLeft: '26px' } }, [ this.rInput ]),
			h('button', { class: 'fx-icon-btn', style: { width: '24px', height: '24px' }, title: 'Replace', innerHTML: theme.getIcon('replace'), onClick: () => this.doReplace(false) }),
			h('button', { class: 'fx-btn', style: { height: '24px', fontSize: '10px', padding: '0 8px' }, title: 'Replace All', onClick: () => this.doReplace(true) }, 'ALL')
		]);

		const toggleR = h('button', { class: 'fx-icon-btn', style: { width: '20px', height: '20px' }, innerHTML: theme.getIcon('chevronRight'), onClick: () => {
			this.searchState.replaceOpen = !this.searchState.replaceOpen;
			this.rRow.style.display = this.searchState.replaceOpen ? 'flex' : 'none';
			toggleR.innerHTML = theme.getIcon(this.searchState.replaceOpen ? 'chevronDown' : 'chevronRight');
		}});

		const sRow = h('div', { class: 'fx-search-row' }, [
			toggleR,
			h('div', { class: 'fx-search-input-wrap' }, [ this.sInput, btnCase, btnWord ]),
			this.sCount,
			h('button', { class: 'fx-icon-btn', style: { width: '20px', height: '20px' }, innerHTML: theme.getIcon('arrowUp'), onClick: () => this.findNext(true) }),
			h('button', { class: 'fx-icon-btn', style: { width: '20px', height: '20px' }, innerHTML: theme.getIcon('arrowDown'), onClick: () => this.findNext(false) }),
			h('button', { class: 'fx-icon-btn', style: { width: '20px', height: '20px' }, innerHTML: theme.getIcon('close'), onClick: () => this.closeSearch() })
		]);

		this.sInput.oninput = () => this.runSearch();
		this.sInput.onkeydown = (e) => { if(e.key === 'Enter') { e.preventDefault(); this.findNext(e.shiftKey); } else if(e.key === 'Escape') this.closeSearch(); };
		this.rInput.onkeydown = (e) => { if(e.key === 'Enter') { e.preventDefault(); this.doReplace(e.shiftKey); } else if(e.key === 'Escape') this.closeSearch(); };

		this.searchPanelEl.appendChild(sRow);
		this.searchPanelEl.appendChild(this.rRow);
		this.editorContainer.appendChild(this.searchPanelEl);
	},

	toggleSearch(replaceMode) {
		if(!this.cm || !this.activeTab) return;
		if(!this.searchPanelEl) this.buildSearchPanel();
		this.searchPanelEl.style.display = 'flex';
		this.searchState.replaceOpen = replaceMode;
		this.rRow.style.display = replaceMode ? 'flex' : 'none';
		this.searchPanelEl.querySelector('.fx-search-row button').innerHTML = theme.getIcon(replaceMode ? 'chevronDown' : 'chevronRight');
		const sel = this.cm.getSelection();
		if(sel && !sel.includes('\n')) this.sInput.value = sel;
		this.sInput.focus();
		this.sInput.select();
		this.runSearch();
	},

	closeSearch() {
		if(this.searchPanelEl) this.searchPanelEl.style.display = 'none';
		this.clearMarks();
		if(this.cm) this.cm.focus();
	},

	clearMarks() {
		this.searchMarks.forEach(m => m.clear());
		this.searchMarks = [];
		if(this.sCount) this.sCount.innerText = '0 of 0';
	},

	getSearchQuery() {
		const q = this.sInput.value;
		if(!q) return null;
		const flags = this.searchState.case ? "g" : "gi";
		const str = this.searchState.word ? `\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b` : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		return new RegExp(str, flags);
	},

	runSearch() {
		this.clearMarks();
		if(!this.cm) return;
		const query = this.getSearchQuery();
		if(!query) return;

		const cur = this.cm.getSearchCursor(query);
		while(cur.findNext()) {
			this.searchMarks.push(this.cm.markText(cur.from(), cur.to(), { className: 'fx-search-match' }));
		}
		this.searchState.matchCount = this.searchMarks.length;
		this.searchState.cursor = this.cm.getSearchCursor(query, this.cm.getCursor());
		this.findNext(false);
	},

	findNext(reverse) {
		if(!this.cm || this.searchState.matchCount === 0) return;
		const query = this.getSearchQuery();
		if(!query) return;

		if(!this.searchState.cursor) this.searchState.cursor = this.cm.getSearchCursor(query, this.cm.getCursor());
		let found = reverse ? this.searchState.cursor.findPrevious() : this.searchState.cursor.findNext();
		
		if(!found) {
			this.searchState.cursor = this.cm.getSearchCursor(query, reverse ? CodeMirror.Pos(this.cm.lastLine()) : CodeMirror.Pos(this.cm.firstLine(), 0));
			found = reverse ? this.searchState.cursor.findPrevious() : this.searchState.cursor.findNext();
		}

		if(found) {
			this.cm.setSelection(this.searchState.cursor.from(), this.searchState.cursor.to());
			this.cm.scrollIntoView({from: this.searchState.cursor.from(), to: this.searchState.cursor.to()}, 100);
			
			let c = 0;
			const posCur = this.cm.getSearchCursor(query, CodeMirror.Pos(this.cm.firstLine(), 0));
			while(posCur.findNext()) {
				c++;
				if(posCur.from().line === this.searchState.cursor.from().line && posCur.from().ch === this.searchState.cursor.from().ch) break;
			}
			this.sCount.innerText = `${c} of ${this.searchState.matchCount}`;
		}
	},

	doReplace(all) {
		if(!this.cm || this.searchState.matchCount === 0) return;
		const query = this.getSearchQuery();
		if(!query) return;
		const rep = this.rInput.value;

		if(all) {
			this.cm.operation(() => {
				const cur = this.cm.getSearchCursor(query);
				while(cur.findNext()) cur.replace(rep);
			});
			this.runSearch();
		} else {
			if(this.searchState.cursor) {
				const sel = this.cm.getSelection();
				if(sel.length > 0 && sel.toLowerCase() === this.sInput.value.toLowerCase()) {
					this.searchState.cursor.replace(rep);
					this.runSearch();
				} else {
					this.findNext(false);
				}
			} else {
				this.findNext(false);
			}
		}
	},

	updateEditorSettings() {
		if(!this.cm) return;
		const s = state.get().settings;
		this.cm.setOption('lineWrapping', s.word_wrap === 'true');
		this.cm.setOption('styleActiveLine', s.active_line === 'true');
		this.cm.setOption('lineNumbers', s.line_numbers !== 'false');
		this.cm.setOption('foldGutter', s.code_folding !== 'false');
		this.cm.setOption('tabSize', parseInt(s.tab_size || '4'));
		this.cm.setOption('indentWithTabs', s.use_tabs !== 'false');
		this.cm.setOption('matchBrackets', s.match_brackets !== 'false');
		this.cm.setOption('autoCloseBrackets', s.auto_close_brackets !== 'false');
		this.editorContainer.style.setProperty('--editor-font-size', (s.font_size || '14') + 'px');
		
		let gutters = [];
		if(s.line_numbers !== 'false') gutters.push("CodeMirror-linenumbers");
		if(s.code_folding !== 'false') gutters.push("CodeMirror-foldgutter");
		this.cm.setOption('gutters', gutters);
		this.cm.refresh();
	},

	updateStatusBar() {
		if(!this.cm || !this.statusBar) return;
		const pos = this.cm.getCursor();
		const mode = this.cm.getOption('mode') || 'text';
		const lines = this.cm.lineCount();
		this.statusBar.innerHTML = `Ln ${pos.line + 1}, Col ${pos.ch + 1} &nbsp;&nbsp;|&nbsp;&nbsp; ${lines} Lines &nbsp;&nbsp;|&nbsp;&nbsp; ${typeof mode === 'string' ? mode : mode.name}`;
	},

	openProjectCreationModal(type) {
		modal(win => {
			const isPlugin = type === 'plugin';
			const isTheme = type === 'theme';
			
			const fId = h('input', { class: 'fx-input', placeholder: 'e.g. my_project' });
			const fName = h('input', { class: 'fx-input', placeholder: 'e.g. My Project' });
			const fVersion = h('input', { class: 'fx-input', value: '1.0.0' });
			const fAuthor = h('input', { class: 'fx-input', placeholder: 'Author' });
			const fDesc = h('textarea', { class: 'fx-input', style: { minHeight: '60px', resize: 'vertical', fontFamily: 'var(--font)' }, placeholder: 'Description...' });
			const fEntry = isPlugin ? h('input', { class: 'fx-input', value: './src/main.js' }) : null;

			const formRow = (label, input) => h('div', { style: { marginBottom: '15px' } }, [
				h('label', { style: { display: 'block', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '5px', fontWeight: 600 } }, label),
				input
			]);

			win.appendChild(h('div', { class: 'fx-modal-body', style: { width: '400px' } }, [
				h('h3', { style: { marginTop: 0, marginBottom: '20px', color: 'var(--text)' } }, `Create ${type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`),
				formRow('ID (Folder Name)', fId),
				formRow('Display Name', fName),
				formRow('Version', fVersion),
				formRow('Author', fAuthor),
				formRow('Description', fDesc),
				isPlugin ? formRow('Entry File', fEntry) : null,
				h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' } }, [
					h('button', { class: 'fx-btn', onClick: () => modal.close() }, 'Cancel'),
					h('button', { class: 'fx-btn fx-btn-primary', onClick: async () => {
						const id = fId.value.trim();
						if(!id) return;
						const basePath = (isPlugin ? 'plugins' : (isTheme ? 'themes' : 'icon-packs')) + '/' + id;
						const metaName = isPlugin ? 'plugin.json' : (isTheme ? 'theme.json' : 'main.json');
						
						const meta = {
							id,
							name: fName.value.trim() || id,
							version: fVersion.value.trim() || '1.0.0',
							author: fAuthor.value.trim() || 'Anonymous',
							description: fDesc.value.trim() || ''
						};

						if (isPlugin) {
							meta.entry = fEntry.value.trim() || './src/main.js';
						} else if (isTheme) {
							meta.vars = {
								"--bg": "#0f1014", "--surface": "#15161b", "--surface-low": "#0a0a0c",
								"--surface-high": "#1c1e26", "--surface-hover": "#232530", "--border": "#2a2d3e",
								"--border-bright": "#3b3f54", "--text": "#f8f8f2", "--text-dim": "#a6accd",
								"--text-dark": "#5c6370", "--accent": "#82aaff", "--accent-glow": "rgba(130, 170, 255, 0.15)",
								"--danger": "#ff5370", "--danger-border": "rgba(255, 83, 112, 0.3)",
								"--editor-bg": "#0f1014", "--radius-sm": "4px", "--radius-md": "8px",
								"--shadow": "0 4px 6px rgba(0,0,0,0.3)", "--font": "-apple-system, BlinkMacSystemFont, sans-serif",
								"--font-code": "monospace"
							};
						} else {
							meta.icons = { "terminal": "./icons/terminal.svg", "search": "./icons/search.svg", "replace": "./icons/replace.svg", "matchCase": "./icons/matchCase.svg", "matchWord": "./icons/matchWord.svg", "arrowUp": "./icons/arrowUp.svg", "arrowDown": "./icons/arrowDown.svg", "close": "./icons/close.svg", "chevronRight": "./icons/chevronRight.svg", "chevronDown": "./icons/chevronDown.svg", "refresh": "./icons/refresh.svg", "collapseAll": "./icons/collapseAll.svg", "docs": "./icons/docs.svg", "save": "./icons/save.svg", "pencil": "./icons/pencil.svg", "trash": "./icons/trash.svg", "newFile": "./icons/newFile.svg", "newFolder": "./icons/newFolder.svg", "plugin": "./icons/plugin.svg" };
							meta.fileIcons = { "default": "./icons/file.svg", "js": "./icons/file-js.svg", "json": "./icons/file-json.svg", "md": "./icons/file-md.svg", "css": "./icons/file-css.svg", "html": "./icons/file-html.svg" };
							meta.folderIcons = { "default": "./icons/folder.svg", "open": "./icons/folder-open.svg" };
						}

						state.update(s => s.vfs[`${basePath}/${metaName}`] = JSON.stringify(meta, null, 4));
						await fluxide.fs.write(`${basePath}/${metaName}`, JSON.stringify(meta, null, 4));

						if (isPlugin && meta.entry) {
							const entryContent = `const { h } = fluxide.ui;\nconst { state, on, expose } = fluxide;\n\nfluxide.register({\n    id: '${id}',\n    init() {\n        console.log('${meta.name} initialized!');\n    }\n});\n`;
							const cleanEntry = meta.entry.startsWith('./') ? meta.entry.substring(2) : meta.entry;
							state.update(s => s.vfs[`${basePath}/${cleanEntry}`] = entryContent);
							await fluxide.fs.write(`${basePath}/${cleanEntry}`, entryContent);
							this.openFile(`${basePath}/${cleanEntry}`);
						} else if (!isPlugin && !isTheme) {
							state.update(s => s.vfs[`${basePath}/icons/.keep`] = '');
							await fluxide.fs.write(`${basePath}/icons/.keep`, '');
							this.openFile(`${basePath}/${metaName}`);
						} else {
							this.openFile(`${basePath}/${metaName}`);
						}

						this.expandedDirs.add(isPlugin ? 'plugins' : (isTheme ? 'themes' : 'icon-packs'));
						this.expandedDirs.add(basePath);
						
						this.renderTree();
						this.logToConsole(`Created ${type}: ${id}`, 'success');
						emit('ide:project_created', { type, id });
						modal.close();
					}}, 'Create')
				])
			]));
			setTimeout(() => fId.focus(), 50);
		});
	},

	render(container) {
		this._container = container;
		container.style.display = 'grid'; container.style.gridTemplateColumns = '280px 1fr'; container.style.height = '100%';
		container.innerHTML = '';

		this.treeEl = h('div', { id: 'ide-tree', style: { flex: 1, overflowY: 'auto', padding: '10px 10px 20px 10px', transition: 'background-color 0.3s' } });
		this.tabsEl = h('div', { id: 'ide-tabs', class: 'fx-tabs' });
		this.editorContainer = h('div', { id: 'ide-editor', class: 'editor-container', style: { flex: 1, transition: 'background-color 0.3s' } });
		this.statusBar = h('div', { style: { height: '22px', background: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 14px', fontSize: '10px', color: 'var(--text-dark)', fontFamily: 'var(--font-code)', userSelect: 'none', transition: 'background-color 0.3s, border-color 0.3s' } });

		this.consoleLogs = h('div', { class: 'fx-console-body' });
		this.consoleEl = h('div', { class: 'fx-console', style: { height: this.consoleVisible ? '200px' : '0px' } }, [
			h('div', { class: 'fx-console-header' }, [
				h('span', {}, 'OUTPUT TERMINAL'),
				h('div', { style: { display: 'flex', gap: '8px' } }, [ h('button', { class: 'fx-icon-btn', onClick: () => { this.consoleLogs.innerHTML = ''; } }, 'Clear'), h('button', { class: 'fx-icon-btn', innerHTML: '×', onClick: () => this.toggleConsole() }) ])
			]),
			this.consoleLogs
		]);

		const baseHeaderTools = [
			h('button', { class: 'fx-icon-btn', title: 'Refresh File System', innerHTML: theme.getIcon('refresh'), onClick: async () => {
				const files = await fluxide.fs.scanWorkspace();
				state.update(s => s.vfs = files);
				emit('workspace:change');
				if(this.activeTab && files[this.activeTab] !== undefined) {
					this.cm.setValue(files[this.activeTab]);
					this.dirtyFiles.delete(this.activeTab);
					this.renderTabs();
				} else if(this.activeTab && files[this.activeTab] === undefined) {
					this.closeTab(this.activeTab);
				}
				this.logToConsole('Synced external changes.', 'success');
			}}),
			h('button', { class: 'fx-icon-btn', title: 'Collapse All', innerHTML: theme.getIcon('collapseAll'), onClick: () => { this.expandedDirs.clear(); this.renderTree(); } }),
			h('button', { class: 'fx-icon-btn', title: 'Toggle Output (Ctrl-`)', innerHTML: theme.getIcon('terminal'), onClick: () => this.toggleConsole() }),
			h('button', { class: 'fx-icon-btn', title: 'Documentation', innerHTML: theme.getIcon('docs'), onClick: () => this.openDocsModal() })
		];

		const extendedHeaderTools = fluxide.ide.headerTools.map(fn => fn(this)).filter(Boolean);

		const headerTools = h('div', { style: { display: 'flex', gap: '4px', alignItems: 'center' } }, [...extendedHeaderTools, ...baseHeaderTools]);

		const sidebar = h('div', { id: 'ide-sidebar', style: { background: 'var(--surface-low)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'none', transition: 'background-color 0.3s, border-color 0.3s' } }, [
			h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)', transition: 'border-color 0.3s' } }, [ h('span', { style: { fontSize: '11px', fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '1px' } }, 'EXPLORER'), headerTools ]),
			this.treeEl
		]);

		const editorArea = h('div', { style: { display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--editor-bg)', transition: 'background-color 0.3s' } }, [
			this.tabsEl, this.editorContainer, this.statusBar, this.consoleEl
		]);

		container.appendChild(sidebar); container.appendChild(editorArea);

		this.cm = CodeMirror(this.editorContainer, {
			value: "", mode: "javascript", theme: "dracula",
			lineNumbers: true, autoCloseBrackets: true, matchBrackets: true,
			indentUnit: 4, tabSize: 4, indentWithTabs: true, readOnly: 'nocursor',
			foldGutter: true, gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"]
		});

		this.updateEditorSettings();

		this.cm.on('change', (cm, change) => {
			if(this.activeTab && change.origin !== 'setValue') {
				state.update(s => s.vfs[this.activeTab] = cm.getValue());
				this.dirtyFiles.add(this.activeTab);
				this.renderTabs();
				emit('ide:file_changed', { path: this.activeTab, content: cm.getValue() });
			}
			this.updateStatusBar();
			if(this.searchPanelEl && this.searchPanelEl.style.display !== 'none') this.runSearch();
		});

		this.cm.on('cursorActivity', () => this.updateStatusBar());
		
		on('ui:scale', () => { if(this.cm) this.cm.refresh(); });

		this.editorContainer.oncontextmenu = (e) => {
			const baseCtx = [
				{ label: 'Save File', key: 'Ctrl-S', icon: theme.getIcon('save'), action: async () => { if(this.activeTab) { await fluxide.fs.write(this.activeTab, this.cm.getValue()); this.dirtyFiles.delete(this.activeTab); this.renderTabs(); this.logToConsole(`Saved: ${this.activeTab}`, 'success'); emit('ide:file_saved', this.activeTab); } } },
				{ sep: true }, 
				{ label: 'Quick Open', key: 'Ctrl-P', icon: theme.getIcon('search'), action: () => this.openQuickSearch() },
				{ sep: true },
				{ label: 'Reload Kernel', action: () => location.reload() }
			];
			const extCtx = fluxide.ide.editorContext.map(fn => fn(this.activeTab, this)).filter(Boolean);
			if(extCtx.length) { baseCtx.push({ sep: true }); baseCtx.push(...extCtx.flat()); }
			context(e, baseCtx);
		};

		this.renderFull();
		
		setTimeout(() => { 
            if(this.cm) this.cm.refresh(); 
            const errs = state.get().startupErrors;
            if (errs && errs.length > 0) {
                errs.forEach(err => {
                    const link = h('span', { style: { color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', marginLeft: '10px' }, onClick: () => {
                        this.openFile(err.path);
                        setTimeout(() => {
                            if(this.cm) {
                                this.cm.setCursor({line: err.line - 1, ch: err.ch});
                                this.cm.focus();
                                this.cm.scrollIntoView({line: err.line - 1, ch: err.ch}, 100);
                            }
                        }, 100);
                    }}, `Jump to ${err.path}:${err.line}`);
                    
                    const wrap = h('span', {}, [ h('span', {}, err.error), link ]);
                    this.logToConsole(wrap, 'error');
                });
                state.get().startupErrors = [];
                if (!this.consoleVisible) this.toggleConsole();
            }
        }, 100);

		if(this.consoleLogs && this.consoleLogs.children.length === 0) this.logToConsole('Fluxide IDE mounted successfully.', 'success');
	},

	renderFull() {
		this.renderTree(); this.renderTabs();
		if(this.activeTab) {
			const content = state.get().vfs[this.activeTab] || "";
			const ext = this.activeTab.split('.').pop();
			const mode = ext === 'json' ? 'application/json' : ext === 'md' ? 'text/markdown' : ext === 'css' ? 'text/css' : 'text/javascript';

			this.cm.setOption('mode', mode);
			this.cm.setOption('readOnly', false);
			if(this.cm.getValue() !== content) {
				this.cm.setValue(content);
				this.dirtyFiles.delete(this.activeTab);
				this.renderTabs();
			}
			this.updateStatusBar();
		} else {
			this.cm.setValue("");
			this.cm.setOption('readOnly', 'nocursor');
			if(this.statusBar) this.statusBar.innerHTML = '';
		}
	},

	renderTabs() {
		this.tabsEl.innerHTML = '';
		this.openTabs.forEach(path => {
			const name = path.split('/').pop();
			const isDirty = this.dirtyFiles.has(path);
			
			const actions = h('div', { class: 'fx-tab-actions' }, [
				isDirty ? h('div', { class: 'fx-tab-dirty' }) : null,
				h('span', { class: 'fx-tab-close', onClick: (e) => { e.stopPropagation(); this.closeTab(path); } }, '×')
			]);

			const tab = h('div', { 
				class: 'fx-tab' + (this.activeTab === path ? ' active' : ''),
				onClick: () => { this.activeTab = path; this.renderFull(); },
				onContextMenu: (e) => {
					context(e, [
						{ label: 'Close Tab', key: 'Ctrl-W', action: () => this.closeTab(path) },
						{ label: 'Close Other Tabs', action: () => { this.openTabs = [path]; this.activeTab = path; this.renderFull(); } },
						{ label: 'Close All Tabs', action: () => { this.openTabs = []; this.activeTab = null; this.renderFull(); } }
					]);
				}
			}, [ h('div', { style: { width: '14px', height: '14px', display: 'flex', alignItems: 'center' }, innerHTML: theme.getFileIconHtml(path) }), h('span', { style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, name), actions ]);
			this.tabsEl.appendChild(tab);
		});
	},

	async promptNew(type, parentPath) {
		const name = await prompt(type === 'file' ? "New File Name" : "New Folder Name");
		if(name) {
			const newPath = parentPath ? (parentPath + '/' + name) : name;
			const fullPath = type === 'folder' ? newPath + '/.keep' : newPath;
			state.update(s => s.vfs[fullPath] = type === 'folder' ? '' : ''); 
			await fluxide.fs.write(fullPath, type === 'folder' ? '' : '');
			if(parentPath) this.expandedDirs.add(parentPath); 
			this.logToConsole(`Created ${type}: ${fullPath}`, 'success');
			if(type === 'file') {
				this.openFile(fullPath);
				emit('ide:file_created', fullPath);
			} else {
				this.renderTree();
				emit('ide:folder_created', fullPath);
			}
		}
	},

	renderTree() {
		const paths = Object.keys(state.get().vfs).sort();
		const root = {};
		
		paths.forEach(p => {
			const rootDir = p.split('/')[0];
			const devMode = state.get().settings.dev_mode === 'true';
			let allowed = false;
			if (rootDir === 'plugins' || rootDir === 'themes' || rootDir === 'icon-packs') allowed = true;
			if (rootDir === 'sys' && devMode) allowed = true;
			if (!allowed) return;

			const parts = p.split('/');
			let curr = root;
			for (let i = 0; i < parts.length; i++) {
				if (i === parts.length - 1) curr[parts[i]] = p;
				else { if(!curr[parts[i]]) curr[parts[i]] = {}; curr = curr[parts[i]]; }
			}
		});

		this.treeEl.innerHTML = '';
		
		this.treeEl.oncontextmenu = (e) => {
			if(e.target === this.treeEl || e.target.closest('#ide-sidebar') === e.target) {
				context(e, [
					{ label: 'Create Plugin', icon: theme.getIcon('plugin'), action: () => this.openProjectCreationModal('plugin') },
					{ label: 'Create Theme', icon: theme.getIcon('newFolder'), action: () => this.openProjectCreationModal('theme') },
					{ label: 'Create Icon Pack', icon: theme.getIcon('newFolder'), action: () => this.openProjectCreationModal('icon_pack') }
				]);
			}
		};
		
		const buildDOM = (node, container, fullPathPrefix, depth) => {
			const keys = Object.keys(node).filter(k => k !== '.keep').sort((a,b) => {
				const aIsFolder = typeof node[a] === 'object';
				const bIsFolder = typeof node[b] === 'object';
				if(aIsFolder && !bIsFolder) return -1;
				if(!aIsFolder && bIsFolder) return 1;
				return a.localeCompare(b);
			});

			keys.forEach(key => {
				const isFile = typeof node[key] === 'string';
				const itemPath = isFile ? node[key] : (fullPathPrefix + key);
				const isExpanded = this.expandedDirs.has(itemPath);
				
				let iconHtml = '';
				let arrowHtml = '';
				if (!isFile) {
					arrowHtml = h('div', { style: { width: '12px', height: '12px', display: 'flex', alignItems: 'center', opacity: 0.5 }, innerHTML: isExpanded ? theme.getIcon('chevronDown') : theme.getIcon('chevronRight') });
					iconHtml = h('div', { class: 'tree-icon', innerHTML: theme.getFolderIconHtml(key, isExpanded) });
				} else {
					arrowHtml = h('div', { style: { width: '12px' } }); 
					iconHtml = h('div', { class: 'tree-icon', innerHTML: theme.getFileIconHtml(key) });
				}
				
				const guides = [];
				for(let g=0; g<depth; g++) { guides.push(h('div', { class: 'indent-guide', style: { left: (g * 14 + 16) + 'px' } })); }

				const el = h('div', { 
					class: 'tree-node' + (this.activeTab === itemPath ? ' active' : '') + (!isFile ? ' folder' : ''),
					dataset: { path: itemPath },
					style: { paddingLeft: (depth * 14 + 10) + 'px' },
					onContextMenu: (e) => {
						const menu = [];
						if(isFile) {
							menu.push({ label: 'Rename File', icon: theme.getIcon('pencil'), action: async () => {
								const currentName = itemPath.split('/').pop();
								const newBaseName = await prompt("Rename File", currentName);
								if(newBaseName && newBaseName !== currentName) {
									const parentPath = itemPath.includes('/') ? itemPath.substring(0, itemPath.lastIndexOf('/')) : '';
									const newPath = parentPath ? (parentPath + '/' + newBaseName) : newBaseName;
									
									const content = state.get().vfs[itemPath];
									state.update(s => { delete s.vfs[itemPath]; s.vfs[newPath] = content; });
									await fluxide.fs.write(newPath, content); await fluxide.fs.remove(itemPath);
									this.logToConsole(`Renamed: ${itemPath} -> ${newPath}`, 'info');
									if(this.openTabs.includes(itemPath)) {
										this.openTabs[this.openTabs.indexOf(itemPath)] = newPath;
										if(this.activeTab === itemPath) {
											this.activeTab = newPath;
											emit('ide:tab_switched', newPath);
										}
									}
									this.renderFull();
									emit('ide:file_renamed', { oldPath: itemPath, newPath });
								}
							}});
							menu.push({ sep: true }, { label: 'Delete File', icon: theme.getIcon('trash'), danger: true, action: async () => {
								state.update(s => delete s.vfs[itemPath]); await fluxide.fs.remove(itemPath);
								this.logToConsole(`Deleted File: ${itemPath}`, 'error');
								if(this.openTabs.includes(itemPath)) this.closeTab(itemPath);
								this.renderTree();
								emit('ide:file_deleted', itemPath);
							}});
						} else {
							menu.push({ label: 'New File', icon: theme.getIcon('newFile'), action: () => this.promptNew('file', itemPath) });
							menu.push({ label: 'New Folder', icon: theme.getIcon('newFolder'), action: () => this.promptNew('folder', itemPath) });
							
							menu.push({ sep: true }, { label: 'Rename Folder', icon: theme.getIcon('pencil'), action: async () => {
								const currentName = itemPath.split('/').pop();
								const newBaseName = await prompt("Rename Folder", currentName);
								if(newBaseName && newBaseName !== currentName) {
									const parentPath = itemPath.includes('/') ? itemPath.substring(0, itemPath.lastIndexOf('/')) : '';
									const newPath = parentPath ? (parentPath + '/' + newBaseName) : newBaseName;
									
									Object.keys(state.get().vfs).forEach(async p => {
										if(p.startsWith(itemPath + '/')) {
											const content = state.get().vfs[p];
											const targetPath = p.replace(itemPath + '/', newPath + '/');
											state.update(s => { delete s.vfs[p]; s.vfs[targetPath] = content; });
											await fluxide.fs.write(targetPath, content); await fluxide.fs.remove(p);
											if(this.openTabs.includes(p)) { 
												this.openTabs[this.openTabs.indexOf(p)] = targetPath; 
												if(this.activeTab === p) {
													this.activeTab = targetPath; 
													emit('ide:tab_switched', targetPath);
												}
											}
										}
									});
									this.expandedDirs.delete(itemPath); this.expandedDirs.add(newPath);
									this.logToConsole(`Renamed Folder: ${itemPath} -> ${newPath}`, 'info');
									this.renderFull();
									emit('ide:folder_renamed', { oldPath: itemPath, newPath });
								}
							}});
							
							menu.push({ sep: true }, { label: 'Delete Folder', icon: theme.getIcon('trash'), danger: true, action: async () => {
								Object.keys(state.get().vfs).forEach(async p => {
									if(p.startsWith(itemPath + '/')) {
										state.update(s => delete s.vfs[p]); await fluxide.fs.remove(p);
										if(this.openTabs.includes(p)) this.closeTab(p);
									}
								});
								this.logToConsole(`Deleted Folder: ${itemPath}`, 'error');
								this.renderTree();
								emit('ide:folder_deleted', itemPath);
							}});
						}
						
						const extTreeCtx = fluxide.ide.treeContext.map(fn => fn(itemPath, isFile, this)).filter(Boolean);
						if(extTreeCtx.length) { menu.push({ sep: true }); menu.push(...extTreeCtx.flat()); }

						context(e, menu);
					}
				}, [...guides, arrowHtml, iconHtml, h('span', { class: 'tree-name' }, key)]);

				el.onmousedown = (e) => {
					if (e.button !== 0) return;
					e.stopPropagation();
					let startX = e.clientX, startY = e.clientY, isDragging = false;
					let ghost = null;
					
					const moveHandler = (me) => {
						if (!isDragging && (Math.abs(me.clientX - startX) > 5 || Math.abs(me.clientY - startY) > 5)) {
							isDragging = true;
							ghost = el.cloneNode(true);
							ghost.style.position = 'fixed'; ghost.style.pointerEvents = 'none'; ghost.style.zIndex = '9999';
							ghost.style.opacity = '0.9'; ghost.style.background = 'var(--surface-high)';
							ghost.style.border = '1px solid var(--border-bright)'; ghost.style.boxShadow = 'var(--shadow)'; ghost.style.padding = '4px 8px';
							document.body.appendChild(ghost);
						}
						if (isDragging && ghost) { ghost.style.left = me.clientX + 10 + 'px'; ghost.style.top = me.clientY + 10 + 'px'; }
					};
					
					const upHandler = async (ue) => {
						window.removeEventListener('mousemove', moveHandler); window.removeEventListener('mouseup', upHandler);
						if (isDragging) {
							if (ghost) { ghost.remove(); ghost = null; }
							const targetNode = document.elementFromPoint(ue.clientX, ue.clientY)?.closest('.tree-node.folder');
							if (targetNode) {
								const targetPath = targetNode.dataset.path;
								if (targetPath && targetPath !== itemPath && !targetPath.startsWith(itemPath + '/')) {
									if (isFile) {
										const fileName = itemPath.split('/').pop();
										const newPath = targetPath + '/' + fileName;
										const content = state.get().vfs[itemPath];
										state.update(s => { delete s.vfs[itemPath]; s.vfs[newPath] = content; });
										await fluxide.fs.write(newPath, content); await fluxide.fs.remove(itemPath);
										if(this.openTabs.includes(itemPath)) {
											this.openTabs[this.openTabs.indexOf(itemPath)] = newPath;
											if(this.activeTab === itemPath) {
												this.activeTab = newPath;
												emit('ide:tab_switched', newPath);
											}
										}
										this.logToConsole(`Moved File: ${itemPath} -> ${newPath}`, 'info');
										emit('ide:item_moved', { oldPath: itemPath, newPath, isFile: true });
									} else {
										const folderName = itemPath.split('/').pop();
										const newFolderPath = targetPath + '/' + folderName;
										Object.keys(state.get().vfs).forEach(async p => {
											if(p.startsWith(itemPath + '/')) {
												const content = state.get().vfs[p];
												const newP = p.replace(itemPath + '/', newFolderPath + '/');
												state.update(s => { delete s.vfs[p]; s.vfs[newP] = content; });
												await fluxide.fs.write(newP, content); await fluxide.fs.remove(p);
												if(this.openTabs.includes(p)) {
													this.openTabs[this.openTabs.indexOf(p)] = newP;
													if(this.activeTab === p) {
														this.activeTab = newP;
														emit('ide:tab_switched', newP);
													}
												}
											}
										});
										this.expandedDirs.delete(itemPath); this.expandedDirs.add(newFolderPath);
										this.logToConsole(`Moved Folder: ${itemPath} -> ${newFolderPath}`, 'info');
										emit('ide:item_moved', { oldPath: itemPath, newPath: newFolderPath, isFile: false });
									}
									this.renderFull();
								}
							}
						} else {
							if(isFile) this.openFile(itemPath);
							else { this.expandedDirs.has(itemPath) ? this.expandedDirs.delete(itemPath) : this.expandedDirs.add(itemPath); this.renderTree(); }
						}
					};
					window.addEventListener('mousemove', moveHandler); window.addEventListener('mouseup', upHandler);
				};

				container.appendChild(el);
				if(!isFile && isExpanded) {
					const childrenContainer = h('div', { class: 'tree-children' });
					buildDOM(node[key], childrenContainer, itemPath + '/', depth + 1);
					container.appendChild(childrenContainer);
				}
			});
		};
		buildDOM(root, this.treeEl, '', 0);
	},

	openDocsModal() {
		modal(win => {
			const vfs = state.get().vfs;
			let docsStructure = [];
			
			Object.keys(vfs).forEach(p => {
				if(p.endsWith('docs/index.json')) {
					try {
						const dir = p.replace('/index.json', '');
						const data = JSON.parse(vfs[p]);
						const pluginName = data.name || dir.split('/')[0].toUpperCase();
						const sections = data.sections || [];
						const resolvedSections = sections.map(sec => ({
							title: sec.title,
							pages: (sec.pages || []).map(page => ({
								path: dir + '/' + page.file,
								title: page.title
							})).filter(page => vfs[page.path])
						})).filter(sec => sec.pages.length > 0);
						if(resolvedSections.length > 0) docsStructure.push({ pluginName, sections: resolvedSections, isSystem: dir.startsWith('sys') });
					} catch(e) {}
				}
			});

			docsStructure.sort((a, b) => {
			    if (a.isSystem && !b.isSystem) return -1;
			    if (!a.isSystem && b.isSystem) return 1;
			    return a.pluginName.localeCompare(b.pluginName);
			});

			let activeDoc = docsStructure.length > 0 && docsStructure[0].sections[0].pages.length > 0 ? docsStructure[0].sections[0].pages[0].path : null;

			const expandedPlugins = new Set();
			const expandedSections = new Set();

			docsStructure.forEach(g => {
			    g.sections.forEach(sec => {
			        if (sec.pages.some(p => p.path === activeDoc) || g.isSystem) {
			            expandedPlugins.add(g.pluginName);
			            expandedSections.add(g.pluginName + '|' + sec.title);
			        }
			    });
			});

			const renderDocs = () => {
				win.innerHTML = '';
				const sidebar = h('div', { style: { width: '240px', borderRight: '1px solid var(--border)', padding: '20px 10px', overflowY: 'auto', background: 'var(--surface-low)', flexShrink: 0 } });
				const content = h('div', { class: 'prose', style: { flex: 1, padding: '40px', overflowY: 'auto', background: 'var(--bg)' } });

				sidebar.appendChild(h('div', { style: { fontSize: '11px', fontWeight: 800, color: 'var(--text-dim)', marginBottom: '15px', paddingLeft: '10px', letterSpacing: '1px' } }, 'DOCUMENTATION'));

				docsStructure.forEach(g => {
				    const isPluginExpanded = expandedPlugins.has(g.pluginName);
					sidebar.appendChild(h('div', { 
					    style: { fontSize: '12px', fontWeight: 800, color: 'var(--text)', margin: '15px 0 5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', userSelect: 'none' },
					    onClick: () => {
					        if (isPluginExpanded) expandedPlugins.delete(g.pluginName);
					        else expandedPlugins.add(g.pluginName);
					        renderDocs();
					    }
					}, [
					    h('span', { style: { width: '16px', fontSize: '10px', color: 'var(--text-dim)', transition: 'transform 0.2s', transform: isPluginExpanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' } }, '▶'),
					    g.pluginName
					]));
					
					if (isPluginExpanded) {
    					g.sections.forEach(sec => {
    					    const secKey = g.pluginName + '|' + sec.title;
    					    const isSecExpanded = expandedSections.has(secKey);
    						sidebar.appendChild(h('div', { 
    						    style: { fontSize: '10px', fontWeight: 700, color: 'var(--text-dark)', margin: '10px 0 5px 16px', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', userSelect: 'none' },
    						    onClick: () => {
    						        if (isSecExpanded) expandedSections.delete(secKey);
    						        else expandedSections.add(secKey);
    						        renderDocs();
    						    }
    						}, [
    						    h('span', { style: { width: '14px', fontSize: '8px', color: 'var(--text-dim)', transition: 'transform 0.2s', transform: isSecExpanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' } }, '▶'),
    						    sec.title
    						]));
    						
    						if (isSecExpanded) {
        						sec.pages.forEach(p => {
        							sidebar.appendChild(h('div', {
        								style: { padding: '8px 12px 8px 30px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '13px', background: activeDoc === p.path ? 'var(--accent)' : 'transparent', color: activeDoc === p.path ? 'white' : 'var(--text-dim)', fontWeight: activeDoc === p.path ? 700 : 500 },
        								onClick: () => { activeDoc = p.path; renderDocs(); }
        							}, p.title));
        						});
    						}
    					});
					}
				});

				if(activeDoc) content.innerHTML = fluxide.ui.markdown(state.get().vfs[activeDoc] || '*Document empty.*');

				const container = h('div', { style: { display: 'flex', height: '75vh', minHeight: '500px', width: '100%' } }, [ sidebar, content ]);
				const closeBtn = h('button', { class: 'fx-btn fx-btn-primary', style: { position: 'absolute', top: '20px', right: '30px', zIndex: 10 }, onClick: () => modal.close() }, 'Close');
				win.style.padding = '0';
				win.style.position = 'relative';
				win.appendChild(closeBtn);
				win.appendChild(container);
			};
			renderDocs();
		});
	}
};

fluxide.register({ id: 'ide', view: { id: 'ide', label: 'IDE', nav: true, order: -1 }, init: () => IDE.init(), render: (c) => IDE.render(c) });