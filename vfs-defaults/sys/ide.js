// darksoulq/fluxide/darksoulq-fluxide-6f73439658620ffb9d43ea294ca73f49b6c7d35b/vfs-defaults/sys/ide.js
const { h, prompt, context, modal } = fluxide.ui;
const { state, fs, keybinds, emit, on, expose, theme } = fluxide;

const IDE = {
	openTabs: [],
	activeTab: null,
	expandedDirs: new Set(['plugins', 'themes']),
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
    commands: [],

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
		this.openCommandPalette = this.openCommandPalette.bind(this);
		this.logToConsole = this.logToConsole.bind(this);
		this.toggleSearch = this.toggleSearch.bind(this);

		expose('ide', { 
			openFile: this.openFile, 
			closeTab: this.closeTab, 
			switchTab: this.openFile,
			listFiles: () => Object.keys(state.get().vfs),
			log: this.logToConsole,
			clearLogs: () => { if(this.consoleLogs) this.consoleLogs.innerHTML = ''; },
            commands: this.commands,
            registerCommand: (id, name, action) => this.commands.push({ id, name, action }),
			headerTools: [],
			treeContext: [],
			editorContext: [],
			addHeaderTool: (t) => { fluxide.ide.headerTools.push(t); if(this._container) this.render(this._container); },
			addTreeContext: (i) => fluxide.ide.treeContext.push(i),
			addEditorContext: (i) => fluxide.ide.editorContext.push(i)
		});

		keybinds.register('ide.save', 'Ctrl-S', async () => { 
			if(this.activeTab && this.cm) { 
				await fs.write(this.activeTab, this.cm.getValue());
				this.dirtyFiles.delete(this.activeTab);
				this.renderTabs();
				this.logToConsole(`Saved: ${this.activeTab}`, 'success');
			} 
		}, "Save Current File");
		
		keybinds.register('ide.closeTab', 'Ctrl-W', () => { if(this.activeTab) this.closeTab(this.activeTab); }, "Close Active Tab");
		keybinds.register('ide.quickOpen', 'Ctrl-P', () => { this.openQuickSearch(); }, "Quick Open File Search");
		keybinds.register('ide.commandPalette', 'Ctrl-Shift-P', () => { this.openCommandPalette(); }, "Command Palette");
		keybinds.register('ide.toggleConsole', 'Ctrl-`', () => { this.toggleConsole(); }, "Toggle Output Console");
		keybinds.register('ide.search', 'Ctrl-F', () => { this.toggleSearch(false); }, "Search within file");
		keybinds.register('ide.replace', 'Ctrl-H', () => { this.toggleSearch(true); }, "Replace within file");
		
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
			container.appendChild(fluxide.settings.createControl('Match Brackets', 'toggle', 'match_brackets'));
			container.appendChild(fluxide.settings.createControl('Auto Close Brackets', 'toggle', 'auto_close_brackets'));
		});

		on('workspace:change', () => { if(state.get().activeView === 'ide') this.renderTree(); });
		on('settings:change', () => { this.updateEditorSettings(); });
	},

	openCommandPalette() {
		modal(win => {
            const allCommands = fluxide.keybinds.getAll().map(k => ({ label: k.description || k.id, sub: k.id, key: k.key, action: k.action }));
            if (this.commands) {
                this.commands.forEach(c => allCommands.push({ label: c.name, sub: c.id, action: c.action }));
            }

			const inputContainer = h('div', { style: { display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 12px' } }, [
				h('div', { innerHTML: theme.getIcon('terminal'), style: { width: '16px', height: '16px', color: 'var(--text-dim)' } }),
				h('input', { class: 'fx-input', style: { border: 'none', background: 'transparent', boxShadow: 'none' }, placeholder: 'Search commands...' })
			]);
			const input = inputContainer.querySelector('input');
			const list = h('div', { style: { marginTop: '10px', maxHeight: '350px', overflowY: 'auto' } });
			
            let selectedIndex = 0;
            let currentFiltered = [];

			const renderList = (filter) => {
				list.innerHTML = '';
				const f = filter.toLowerCase();
				currentFiltered = allCommands.filter(c => c.label.toLowerCase().includes(f) || (c.sub && c.sub.toLowerCase().includes(f)));
                if(selectedIndex >= currentFiltered.length) selectedIndex = Math.max(0, currentFiltered.length - 1);

                currentFiltered.forEach((c, idx) => {
                    const isActive = idx === selectedIndex;
                    const item = h('div', {
                        class: 'ctx-item' + (isActive ? ' active' : ''),
                        style: { padding: '10px 14px', borderBottom: '1px solid var(--border)', gap: '12px', background: isActive ? 'var(--accent-glow)' : 'transparent', color: isActive ? 'var(--text)' : 'var(--text-dim)' },
                        onMouseOver: () => { selectedIndex = idx; renderList(input.value); },
                        onClick: () => { modal.close(); c.action(); }
                    }, [
                        h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column' } }, [
                            h('span', { style: { fontSize: '13px', fontWeight: isActive ? 600 : 500 } }, c.label),
                            h('span', { style: { fontSize: '10px', color: isActive ? 'rgba(255,255,255,0.7)' : 'var(--text-dark)', marginTop: '2px', fontFamily: 'var(--font-code)' } }, c.sub)
                        ]),
                        c.key ? h('div', { class: 'ctx-keybind', style: { color: isActive ? 'rgba(255,255,255,0.9)' : '' } }, c.key) : h('div', {})
                    ]);
                    list.appendChild(item);
                });
			};
			input.oninput = (e) => { selectedIndex = 0; renderList(e.target.value); };
            input.onkeydown = (e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); selectedIndex = Math.min(selectedIndex + 1, currentFiltered.length - 1); renderList(input.value); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); selectedIndex = Math.max(selectedIndex - 1, 0); renderList(input.value); }
                else if (e.key === 'Enter') { e.preventDefault(); if(currentFiltered[selectedIndex]) { modal.close(); currentFiltered[selectedIndex].action(); } }
            };

			win.appendChild(h('div', { class: 'fx-modal-body' }, [ h('h3', { style: { marginTop: 0, marginBottom: '20px', fontSize: '14px', color: 'var(--text-dim)' } }, 'Command Palette'), inputContainer, list ]));
			renderList('');
			setTimeout(() => input.focus(), 50);
		});
		const overlay = document.getElementById('fx-modal-overlay');
		overlay.onclick = (e) => { if (e.target === overlay) modal.close(); };
	},

	openFile(path) {
		if (!this.openTabs.includes(path)) this.openTabs.push(path);
		this.activeTab = path;
		this.closeSearch();
		if (state.get().activeView === 'ide') this.renderFull();
	},

	closeTab(path) {
		this.openTabs = this.openTabs.filter(t => t !== path);
		this.dirtyFiles.delete(path);
		if (this.activeTab === path) this.activeTab = this.openTabs[this.openTabs.length - 1] || null;
		this.closeSearch();
		this.renderFull();
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
		this.consoleLogs.appendChild(h('div', { class: 'log-line log-' + type }, [ h('span', { class: 'log-time' }, timeStr), h('span', { class: 'log-msg' }, msg) ]));
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
		this.editorContainer.style.fontSize = (s.font_size || '14') + 'px';
		
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

	render(container) {
		this._container = container;
		container.style.display = 'grid'; container.style.gridTemplateColumns = '280px 1fr'; container.style.height = '100%';
		container.innerHTML = '';

		this.treeEl = h('div', { id: 'ide-tree', style: { flex: 1, overflowY: 'auto', padding: '10px 10px 20px 10px' } });
		this.tabsEl = h('div', { id: 'ide-tabs', class: 'fx-tabs' });
		this.editorContainer = h('div', { id: 'ide-editor', class: 'editor-container', style: { flex: 1 } });
		this.statusBar = h('div', { style: { height: '22px', background: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 14px', fontSize: '10px', color: 'var(--text-dark)', fontFamily: 'var(--font-code)', userSelect: 'none' } });

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
				const files = await fs.scanWorkspace();
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

		const sidebar = h('div', { id: 'ide-sidebar', style: { background: 'var(--surface-low)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'none' } }, [
			h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)' } }, [ h('span', { style: { fontSize: '11px', fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '1px' } }, 'EXPLORER'), headerTools ]),
			this.treeEl
		]);

		const editorArea = h('div', { style: { display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--editor-bg)' } }, [
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
			}
			this.updateStatusBar();
			if(this.searchPanelEl && this.searchPanelEl.style.display !== 'none') this.runSearch();
		});

		this.cm.on('cursorActivity', () => this.updateStatusBar());
		
		on('ui:scale', () => { if(this.cm) this.cm.refresh(); });

		this.editorContainer.oncontextmenu = (e) => {
			const baseCtx = [
				{ label: 'Save File', key: 'Ctrl-S', icon: theme.getIcon('save'), action: async () => { if(this.activeTab) { await fs.write(this.activeTab, this.cm.getValue()); this.dirtyFiles.delete(this.activeTab); this.renderTabs(); this.logToConsole(`Saved: ${this.activeTab}`, 'success'); } } },
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
		setTimeout(() => this.cm.refresh(), 100);
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
			await fs.write(fullPath, type === 'folder' ? '' : '');
			if(parentPath) this.expandedDirs.add(parentPath); 
			this.logToConsole(`Created ${type}: ${fullPath}`, 'success');
			if(type === 'file') this.openFile(fullPath);
			else this.renderTree();
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
			if(e.target === this.treeEl) {
				context(e, [
					{ label: 'Create Plugin', icon: theme.getIcon('plugin'), action: () => this.promptNew('folder', 'plugins') },
					{ label: 'Create Theme', icon: theme.getIcon('newFile'), action: () => this.promptNew('file', 'themes') }
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
								const newName = await prompt("Rename", itemPath);
								if(newName && newName !== itemPath) {
									const content = state.get().vfs[itemPath];
									state.update(s => { delete s.vfs[itemPath]; s.vfs[newName] = content; });
									await fs.write(newName, content); await fs.remove(itemPath);
									this.logToConsole(`Renamed: ${itemPath} -> ${newName}`, 'info');
									if(this.openTabs.includes(itemPath)) {
										this.openTabs[this.openTabs.indexOf(itemPath)] = newName;
										if(this.activeTab === itemPath) this.activeTab = newName;
									}
									this.renderFull();
								}
							}});
							menu.push({ sep: true }, { label: 'Delete File', icon: theme.getIcon('trash'), danger: true, action: async () => {
								state.update(s => delete s.vfs[itemPath]); await fs.remove(itemPath);
								this.logToConsole(`Deleted File: ${itemPath}`, 'error');
								if(this.openTabs.includes(itemPath)) this.closeTab(itemPath);
								this.renderTree();
							}});
						} else {
							menu.push({ label: 'New File', icon: theme.getIcon('newFile'), action: () => this.promptNew('file', itemPath) });
							menu.push({ label: 'New Folder', icon: theme.getIcon('newFolder'), action: () => this.promptNew('folder', itemPath) });
							
							menu.push({ sep: true }, { label: 'Rename Folder', icon: theme.getIcon('pencil'), action: async () => {
								const newName = await prompt("Rename Folder", itemPath);
								if(newName && newName !== itemPath) {
									Object.keys(state.get().vfs).forEach(async p => {
										if(p.startsWith(itemPath + '/')) {
											const content = state.get().vfs[p];
											const targetPath = p.replace(itemPath + '/', newName + '/');
											state.update(s => { delete s.vfs[p]; s.vfs[targetPath] = content; });
											await fs.write(targetPath, content); await fs.remove(p);
											if(this.openTabs.includes(p)) { this.openTabs[this.openTabs.indexOf(p)] = targetPath; if(this.activeTab === p) this.activeTab = targetPath; }
										}
									});
									this.expandedDirs.delete(itemPath); this.expandedDirs.add(newName);
									this.logToConsole(`Renamed Folder: ${itemPath} -> ${newName}`, 'info');
									this.renderFull();
								}
							}});
							
							menu.push({ sep: true }, { label: 'Delete Folder', icon: theme.getIcon('trash'), danger: true, action: async () => {
								Object.keys(state.get().vfs).forEach(async p => {
									if(p.startsWith(itemPath + '/')) {
										state.update(s => delete s.vfs[p]); await fs.remove(p);
										if(this.openTabs.includes(p)) this.closeTab(p);
									}
								});
								this.logToConsole(`Deleted Folder: ${itemPath}`, 'error');
								this.renderTree();
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
										await fs.write(newPath, content); await fs.remove(itemPath);
										if(this.openTabs.includes(itemPath)) {
											this.openTabs[this.openTabs.indexOf(itemPath)] = newPath;
											if(this.activeTab === itemPath) this.activeTab = newPath;
										}
										this.logToConsole(`Moved File: ${itemPath} -> ${newPath}`, 'info');
									} else {
										const folderName = itemPath.split('/').pop();
										const newFolderPath = targetPath + '/' + folderName;
										Object.keys(state.get().vfs).forEach(async p => {
											if(p.startsWith(itemPath + '/')) {
												const content = state.get().vfs[p];
												const newP = p.replace(itemPath + '/', newFolderPath + '/');
												state.update(s => { delete s.vfs[p]; s.vfs[newP] = content; });
												await fs.write(newP, content); await fs.remove(p);
												if(this.openTabs.includes(p)) {
													this.openTabs[this.openTabs.indexOf(p)] = newP;
													if(this.activeTab === p) this.activeTab = newP;
												}
											}
										});
										this.expandedDirs.delete(itemPath); this.expandedDirs.add(newFolderPath);
										this.logToConsole(`Moved Folder: ${itemPath} -> ${newFolderPath}`, 'info');
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
						if(resolvedSections.length > 0) docsStructure.push({ pluginName, sections: resolvedSections });
					} catch(e) {}
				}
			});

			let activeDoc = docsStructure.length > 0 && docsStructure[0].sections[0].pages.length > 0 ? docsStructure[0].sections[0].pages[0].path : null;

			const renderDocs = () => {
				win.innerHTML = '';
				const sidebar = h('div', { style: { width: '220px', borderRight: '1px solid var(--border)', padding: '20px 10px', overflowY: 'auto', background: 'var(--surface-low)', flexShrink: 0 } });
				const content = h('div', { class: 'prose', style: { flex: 1, padding: '40px', overflowY: 'auto', background: 'var(--bg)' } });

				sidebar.appendChild(h('div', { style: { fontSize: '11px', fontWeight: 800, color: 'var(--text-dim)', marginBottom: '15px', paddingLeft: '10px', letterSpacing: '1px' } }, 'DOCUMENTATION'));

				docsStructure.forEach(g => {
					sidebar.appendChild(h('div', { style: { fontSize: '12px', fontWeight: 800, color: 'var(--text)', margin: '15px 0 5px 10px' } }, g.pluginName));
					g.sections.forEach(sec => {
						sidebar.appendChild(h('div', { style: { fontSize: '10px', fontWeight: 700, color: 'var(--text-dark)', margin: '10px 0 5px 10px', textTransform: 'uppercase' } }, sec.title));
						sec.pages.forEach(p => {
							sidebar.appendChild(h('div', {
								style: { padding: '8px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '13px', background: activeDoc === p.path ? 'var(--accent)' : 'transparent', color: activeDoc === p.path ? 'white' : 'var(--text-dim)', fontWeight: activeDoc === p.path ? 700 : 500 },
								onClick: () => { activeDoc = p.path; renderDocs(); }
							}, p.title));
						});
					});
				});

				if(activeDoc) content.innerHTML = fluxide.ui.markdown(vfs[activeDoc] || '*Document empty.*');

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