const { h, prompt, context } = fluxide.ui;
const { state, emit, on, expose, theme, getComponents } = fluxide;
require('./task_viewer.js');

fluxide.register({
    id: 'board',
    view: { id: 'board', label: 'Board', nav: true, order: 1 },
    init() {
        theme.registerVariables('board', {
            '--board-canvas-bg': 'transparent',
            '--board-col-bg': 'var(--surface-low)',
            '--board-col-border': 'var(--border)',
            '--board-card-bg': 'var(--card-bg)',
            '--board-card-border': 'var(--border)',
            '--board-card-hover': 'var(--accent)',
            '--board-add-col-bg': 'rgba(255,255,255,0.02)',
            '--board-add-col-border': 'var(--border-bright)'
        });

        expose('board', {
            getColumns: () => state.get().workspace.columns || [],
            getColumn: (id) => fluxide.board.getColumns().find(c => c.id === id),
            addColumn: (title) => {
                state.update(s => { if(!s.workspace.columns) s.workspace.columns = []; s.workspace.columns.push({ id: 'col_'+Date.now(), title: title.toUpperCase(), tasks: [] }); });
                emit('workspace:change');
            },
            removeColumn: (id) => {
                state.update(s => { s.workspace.columns = s.workspace.columns.filter(c => c.id !== id); });
                emit('workspace:change');
            },
            addTask: (colId, task) => {
                state.update(s => { const c = s.workspace.columns.find(x => x.id === colId); if(c) c.tasks.push(task); });
                emit('workspace:change');
            },
            removeTask: (colId, taskId) => {
                state.update(s => { const c = s.workspace.columns.find(x => x.id === colId); if(c) c.tasks = c.tasks.filter(t => t.id !== taskId); });
                emit('workspace:change');
            },
            moveTask: (taskId, fromColId, toColId, targetIndex = -1) => {
                state.update(s => {
                    const fromCol = s.workspace.columns.find(c => c.id === fromColId);
                    const toCol = s.workspace.columns.find(c => c.id === toColId);
                    if(!fromCol || !toCol) return;
                    const taskIdx = fromCol.tasks.findIndex(t => t.id === taskId);
                    if(taskIdx > -1) {
                        const [t] = fromCol.tasks.splice(taskIdx, 1);
                        if(targetIndex === -1) toCol.tasks.push(t);
                        else toCol.tasks.splice(targetIndex, 0, t);
                    }
                });
                emit('workspace:change');
            },
            moveColumn: (colId, targetIndex) => {
                state.update(s => {
                    const cols = s.workspace.columns;
                    const srcIdx = cols.findIndex(c => c.id === colId);
                    if(srcIdx > -1) {
                        const [moved] = cols.splice(srcIdx, 1);
                        cols.splice(targetIndex, 0, moved);
                    }
                });
                emit('workspace:change');
            },
            cardContext: [],
            colContext: [],
            addCardContext: (fn) => fluxide.board.cardContext.push(fn),
            addColContext: (fn) => fluxide.board.colContext.push(fn)
        });

        on('workspace:change', () => { if (this._container && state.get().activeView === 'board') this.render(this._container); });
    },
    render(container) {
        this._container = container; container.innerHTML = '';
        if(!state.get().workspace.columns) { state.update(s => s.workspace.columns = []); }
        
        const root = h('div', { class: 'fx-board-canvas', style: { padding: '30px', display: 'flex', gap: '24px', overflowX: 'auto', height: '100%', alignItems: 'flex-start', background: 'var(--board-canvas-bg)' } });
        const ws = state.get().workspace;

        ws.columns.forEach((col, colIdx) => {
            const list = h('div', { class: 'fx-task-list', dataset: { col: col.id }, style: { padding: '15px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '120px' } });

            col.tasks.forEach((task, taskIdx) => {
                const todos = task.todos || []; 
                const completed = todos.filter(t => t.done).length;
                const tagsHtml = (task.tags || []).map(t => h('span', { style: { fontSize: '8px', fontWeight: 800, background: 'var(--tag-bg)', padding: '4px 6px', borderRadius: '4px', color: 'var(--accent)' } }, t.toUpperCase()));
                
                const cardContent = [
                    h('div', { style: { fontWeight: 700, fontSize: '14px', marginBottom: '8px' } }, task.title),
                    h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: todos.length ? '10px' : '0' } }, tagsHtml)
                ];
                
                if(todos.length > 0) {
                    cardContent.push(h('div', { style: { fontSize: '10px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' } }, `✓ ${completed}/${todos.length}`));
                }

                getComponents('board-task-card-content').forEach(comp => { const el = comp.render(task); if (el) cardContent.push(el); });

                const card = h('div', {
                    class: 'fx-task-card',
                    dataset: { taskId: task.id },
                    style: { background: 'var(--board-card-bg)', border: '1px solid var(--board-card-border)', borderRadius: 'var(--radius-md)', padding: '16px', cursor: 'pointer', transition: 'border-color 0.15s' },
                    onMouseOver: (e) => e.currentTarget.style.borderColor = 'var(--board-card-hover)',
                    onMouseOut: (e) => e.currentTarget.style.borderColor = 'var(--board-card-border)',
                    onContextMenu: (e) => {
                        const baseCtx = [
                            { label: 'View Details', action: () => fluxide.task.openModal(task, col.id, 'view') },
                            { label: 'Edit Task', action: () => fluxide.task.openModal(task, col.id, 'edit') },
                            { sep: true },
                            { label: 'Delete Task', danger: true, action: () => fluxide.board.removeTask(col.id, task.id) }
                        ];
                        const extCtx = fluxide.board.cardContext.map(fn => fn(task, col.id)).filter(Boolean);
                        if(extCtx.length) { baseCtx.push({ sep: true }); baseCtx.push(...extCtx.flat()); }
                        context(e, baseCtx);
                    }
                }, cardContent);
                
                card.onmousedown = (e) => {
                    if(e.button !== 0) return;
                    e.stopPropagation(); e.preventDefault();
                    let startX = e.clientX, startY = e.clientY, isDragging = false, ghost = null;
                    
                    const moveHandler = (me) => {
                        if(!isDragging && (Math.abs(me.clientX - startX) > 5 || Math.abs(me.clientY - startY) > 5)) {
                            isDragging = true;
                            ghost = card.cloneNode(true);
                            ghost.style.position = 'fixed'; ghost.style.pointerEvents = 'none'; ghost.style.zIndex = '9999';
                            ghost.style.width = card.offsetWidth + 'px'; ghost.style.opacity = '0.8'; ghost.style.transform = 'rotate(3deg)';
                            ghost.style.boxShadow = '0 20px 40px -10px rgba(0,0,0,0.5)'; ghost.style.borderColor = 'var(--accent)';
                            document.body.appendChild(ghost);
                            card.style.opacity = '0.3';
                        }
                        if(isDragging) { ghost.style.left = me.clientX - (card.offsetWidth/2) + 'px'; ghost.style.top = me.clientY - 20 + 'px'; }
                    };
                    
                    const upHandler = (ue) => {
                        window.removeEventListener('mousemove', moveHandler); window.removeEventListener('mouseup', upHandler);
                        if(ghost) { ghost.remove(); ghost = null; }
                        card.style.opacity = '1';
                        
                        if(isDragging) {
                            const elUnder = document.elementFromPoint(ue.clientX, ue.clientY);
                            const targetList = elUnder ? elUnder.closest('.fx-task-list') : null;
                            if(targetList) {
                                const targetColId = targetList.dataset.col;
                                if(targetColId && targetColId !== col.id) {
                                    fluxide.board.moveTask(task.id, col.id, targetColId);
                                } else if (targetColId === col.id) {
                                    const targetCard = elUnder.closest('.fx-task-card');
                                    if (targetCard && targetCard.dataset.taskId !== task.id) {
                                        const targetIdx = col.tasks.findIndex(t => t.id === targetCard.dataset.taskId);
                                        fluxide.board.moveTask(task.id, col.id, col.id, targetIdx);
                                    }
                                }
                            }
                        } else { fluxide.task.openModal(task, col.id, 'view'); }
                    };
                    window.addEventListener('mousemove', moveHandler); window.addEventListener('mouseup', upHandler);
                };
                list.appendChild(card);
            });

            const colHeader = h('div', { class: 'fx-board-header', style: { padding: '18px 20px', borderBottom: '1px solid var(--board-col-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'grab' },
            onContextMenu: (e) => {
                const baseCtx = [
                    { label: 'Add Task', action: () => fluxide.task.openModal(null, col.id, 'create') },
                    { label: 'Rename Column', action: async () => { const n = await prompt("Rename Column", col.title); if(n) { state.update(s => s.workspace.columns.find(c=>c.id===col.id).title = n.toUpperCase()); emit('workspace:change'); } } },
                    { sep: true },
                    { label: 'Delete Column', danger: true, action: () => fluxide.board.removeColumn(col.id) }
                ];
                const extCtx = fluxide.board.colContext.map(fn => fn(col)).filter(Boolean);
                if(extCtx.length) { baseCtx.push({ sep: true }); baseCtx.push(...extCtx.flat()); }
                context(e, baseCtx);
            }
            }, [
                h('span', { class: 'fx-board-title', style: { fontWeight: 900, fontSize: '11px', letterSpacing: '1.5px', color: 'var(--text-dim)' } }, col.title),
                h('button', { class: 'add-task fx-icon-btn', style: { padding: '4px' }, onClick: () => fluxide.task.openModal(null, col.id, 'create'), innerHTML: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>' })
            ]);

            const colEl = h('div', { class: 'fx-board-col', dataset: { colId: col.id }, style: { width: '320px', flexShrink: 0, background: 'var(--board-col-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--board-col-border)', display: 'flex', flexDirection: 'column', maxHeight: '100%' } }, [ colHeader, list ]);
            
            colHeader.onmousedown = (e) => {
                if(e.button !== 0 || e.target.closest('button')) return;
                e.stopPropagation(); e.preventDefault();
                let startX = e.clientX, startY = e.clientY, isDragging = false, ghost = null;
                
                const moveHandler = (me) => {
                    if(!isDragging && (Math.abs(me.clientX - startX) > 5 || Math.abs(me.clientY - startY) > 5)) {
                        isDragging = true;
                        ghost = colEl.cloneNode(true);
                        ghost.style.position = 'fixed'; ghost.style.pointerEvents = 'none'; ghost.style.zIndex = '9999';
                        ghost.style.width = '320px'; ghost.style.opacity = '0.5'; ghost.style.transform = 'rotate(2deg)';
                        document.body.appendChild(ghost);
                        colEl.style.opacity = '0.3';
                    }
                    if(isDragging) { ghost.style.left = me.clientX - 160 + 'px'; ghost.style.top = me.clientY - 20 + 'px'; }
                };
                
                const upHandler = (ue) => {
                    window.removeEventListener('mousemove', moveHandler); window.removeEventListener('mouseup', upHandler);
                    if(ghost) { ghost.remove(); ghost = null; }
                    colEl.style.opacity = '1';
                    
                    if(isDragging) {
                        const elUnder = document.elementFromPoint(ue.clientX, ue.clientY);
                        const targetColEl = elUnder ? elUnder.closest('.fx-board-col') : null;
                        if(targetColEl) {
                            const targetColId = targetColEl.dataset.colId;
                            if(targetColId && targetColId !== col.id) {
                                const targetIdx = state.get().workspace.columns.findIndex(c => c.id === targetColId);
                                fluxide.board.moveColumn(col.id, targetIdx);
                            }
                        }
                    }
                };
                window.addEventListener('mousemove', moveHandler); window.addEventListener('mouseup', upHandler);
            };

            root.appendChild(colEl);
        });

        const addCol = h('div', { 
            style: { width: '320px', flexShrink: 0, background: 'var(--board-add-col-bg)', border: '1px dashed var(--board-add-col-border)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', height: '100px', color: 'var(--text-dim)', fontWeight: 700, transition: 'border-color 0.2s' },
            onMouseOver: (e) => e.currentTarget.style.borderColor = 'var(--accent)',
            onMouseOut: (e) => e.currentTarget.style.borderColor = 'var(--board-add-col-border)',
            onClick: async () => {
                const name = await prompt("Column Name", "e.g. Q&A");
                if(name) { fluxide.board.addColumn(name); }
            }
        }, '+ New Column');
        
        root.appendChild(addCol); container.appendChild(root);
    }
});