const { h, modal } = fluxide.ui;
const { state, emit, expose, getComponents } = fluxide;

fluxide.register({
    id: 'task_viewer',
    init() {
        fluxide.registerComponent('board-task-card-content', {
            id: 'priority-tag',
            render: (task) => h('div', { style: { fontSize: '9px', fontWeight: 800, marginTop: '4px', color: task.priority === 'high' ? '#ff5555' : 'var(--text-dim)' } }, (task.priority || 'medium').toUpperCase() + ' PRIORITY')
        });

        expose('task', {
            openModal: (task, colId, mode) => {
                modal((win) => {
                    const isNew = mode === 'create';
                    if (mode === 'view') {
                        const header = h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' } }, [
                            h('div', {}, [
                                h('h2', { style: { margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--text)' } }, task.title),
                                h('div', { style: { fontSize: '11px', color: 'var(--text-dim)', marginTop: '6px', fontWeight: 600 } }, `ID: ${task.id} • ${(task.priority || 'medium').toUpperCase()} PRIORITY`)
                            ]),
                            h('button', { class: 'fx-btn fx-btn-primary', onClick: () => fluxide.task.openModal(task, colId, 'edit') }, 'Edit Task')
                        ]);

                        const tagsRow = h('div', { class: 'fx-form-row' }, [
                            h('div', { class: 'fx-form-group' }, [
                                h('h3', { style: { fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', margin: '0 0 10px 0' } }, 'Tags'),
                                h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', minHeight: '24px' } }, (task.tags||[]).length ? task.tags.map(t => h('span', { class: 'fx-badge' }, t)) : [h('span', { style: { fontSize: '12px', color: 'var(--text-dark)' } }, 'No tags')])
                            ]),
                            h('div', { class: 'fx-form-group' }, [
                                h('h3', { style: { fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', margin: '0 0 10px 0' } }, 'Dependencies'),
                            h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', minHeight: '24px' } }, (task.deps||[]).length ? task.deps.map(d => h('span', { class: 'fx-badge' }, d)) : [h('span', { style: { fontSize: '12px', color: 'var(--text-dark)' } }, 'No dependencies')])
                            ])
                        ]);

                        const descSection = h('div', { style: { marginTop: '25px' } }, [
                            h('h3', { style: { fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', margin: '0 0 10px 0' } }, 'Description'),
                            h('div', { class: 'prose', style: { background: 'var(--surface-low)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', minHeight: '120px' }, innerHTML: fluxide.ui.markdown(task.desc || '*No description provided.*') })
                        ]);

                        const todoListContainer = h('div', { id: 'todo-list', style: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' } });
                        const todoInput = h('input', { id: 'new-todo-input', class: 'fx-input', placeholder: 'Add new to-do...', style: { flex: 1 } });
                        
                        const todos = task.todos || [];
                        const renderTodos = () => {
                            todoListContainer.innerHTML = '';
                            if(todos.length === 0) todoListContainer.appendChild(h('span', { style: { fontSize: '12px', color: 'var(--text-dark)' } }, 'No todos yet.'));
                            todos.forEach((td, idx) => {
                                const row = h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--surface-low)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' } }, [
                                    h('input', { type: 'checkbox', class: 'fx-checkbox', checked: td.done ? true : undefined, onChange: (e) => {
                                        state.update(s => { const t = s.workspace.columns.find(x => x.id === colId).tasks.find(x => x.id === task.id); if(t && t.todos) t.todos[idx].done = e.target.checked; });
                                        emit('workspace:change'); td.done = e.target.checked; renderTodos();
                                    }}),
                                    h('span', { style: { flex: 1, fontSize: '13px', textDecoration: td.done ? 'line-through' : 'none', color: td.done ? 'var(--text-dim)' : 'inherit' } }, td.text),
                                    h('button', { class: 'fx-btn fx-btn-danger', style: { padding: '2px 6px', fontSize: '10px' }, onClick: () => {
                                        state.update(s => { const t = s.workspace.columns.find(x => x.id === colId).tasks.find(x => x.id === task.id); if(t && t.todos) t.todos.splice(idx, 1); });
                                        emit('workspace:change'); todos.splice(idx, 1); renderTodos();
                                    }}, 'X')
                                ]);
                                todoListContainer.appendChild(row);
                            });
                        };
                        renderTodos();

                        const handleAddTodo = () => {
                            const val = todoInput.value.trim();
                            if(val) {
                                const newTd = { id: 'td_'+Date.now(), text: val, done: false };
                                state.update(s => { const t = s.workspace.columns.find(x => x.id === colId).tasks.find(x => x.id === task.id); if(!t.todos) t.todos = []; t.todos.push(newTd); });
                                emit('workspace:change'); todos.push(newTd); todoInput.value = ''; renderTodos();
                            }
                        };
                        const todoAddBtn = h('button', { id: 'add-todo-btn', class: 'fx-btn', onClick: handleAddTodo }, 'Add');
                        todoInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') handleAddTodo(); });

                        const todoSection = h('div', { style: { marginTop: '25px' } }, [
                            h('h3', { style: { fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', margin: '0 0 10px 0' } }, 'Todos'),
                            todoListContainer,
                            h('div', { style: { display: 'flex', gap: '8px' } }, [ todoInput, todoAddBtn ])
                        ]);

                        const customSections = getComponents('task-view-section').map(c => c.render(task, colId)).filter(Boolean);

                        const footer = h('div', { style: { marginTop: '30px', display: 'flex', justifyContent: 'flex-end' } }, [ h('button', { class: 'fx-btn', onClick: () => modal.close() }, 'Close') ]);

                        win.appendChild(h('div', { class: 'fx-modal-body' }, [ header, tagsRow, descSection, todoSection, ...customSections, footer ]));

                    } else {
                        const header = h('h2', { style: { marginTop: 0, marginBottom: '5px' } }, isNew ? 'Create New Task' : 'Edit Task');
                        const idInfo = !isNew ? h('div', { style: { fontSize: '10px', color: 'var(--text-dim)', marginBottom: '20px' } }, `ID: ${task.id}`) : h('div', { style: { marginBottom: '20px' } });
                        
                        const titleInput = h('input', { id: 't-title', class: 'fx-input', value: isNew ? '' : task.title, placeholder: 'Feature headline...' });
                        if (!isNew) { titleInput.setAttribute('readonly', ''); Object.assign(titleInput.style, { opacity: '0.6', cursor: 'not-allowed' }); }
                        
                        const titleSection = h('div', { style: { marginBottom: '15px' } }, [ h('label', { class: 'fx-form-label' }, 'Task Title'), titleInput ]);

                        const priSelect = h('select', { id: 't-pri', class: 'fx-select' }, [
                            h('option', { value: 'low', selected: (!isNew && task.priority==='low') ? true : undefined }, 'Low'),
                            h('option', { value: 'medium', selected: ((!isNew && task.priority==='medium') || isNew) ? true : undefined }, 'Medium'),
                            h('option', { value: 'high', selected: (!isNew && task.priority==='high') ? true : undefined }, 'High')
                        ]);

                        const tagsInput = h('input', { type: 'text', class: 'fx-capsule-input', id: 't-tags-input', placeholder: 'Add tag + Enter' });
                        const tagsWrapper = h('div', { class: 'fx-capsule-wrapper', id: 'tags-wrapper' }, [ tagsInput ]);

                        const depsInput = h('input', { type: 'text', class: 'fx-capsule-input', id: 't-deps-input', placeholder: 'Task ID + Enter' });
                        const depsWrapper = h('div', { class: 'fx-capsule-wrapper', id: 'deps-wrapper' }, [ depsInput ]);

                        const propsRow = h('div', { class: 'fx-form-row' }, [
                            h('div', { class: 'fx-form-group' }, [ h('label', { class: 'fx-form-label' }, 'Priority'), priSelect ]),
                            h('div', { class: 'fx-form-group' }, [ h('label', { class: 'fx-form-label' }, 'Tags'), tagsWrapper ]),
                            h('div', { class: 'fx-form-group' }, [ h('label', { class: 'fx-form-label' }, 'Dependencies'), depsWrapper ])
                        ]);

                        let editTags = isNew ? [] : [...(task.tags || [])];
                        let editDeps = isNew ? [] : [...(task.deps || [])];

                        const renderCapsules = (arr, wrapper, input) => {
                            wrapper.querySelectorAll('.fx-capsule').forEach(el => el.remove());
                            arr.forEach((item, index) => wrapper.insertBefore(h('div', { class: 'fx-capsule' }, [ h('span', {}, item), h('span', { class: 'fx-capsule-remove', onClick: (e) => { e.stopPropagation(); arr.splice(index, 1); renderCapsules(arr, wrapper, input); } }, '×') ]), input));
                        };

                        const setupCapsules = (arr, wrapper, input) => {
                            wrapper.onclick = () => input.focus();
                            input.onkeydown = (e) => {
                                if (e.key === 'Enter') { e.preventDefault(); const val = input.value.trim(); if (val && !arr.includes(val)) { arr.push(val); input.value = ''; renderCapsules(arr, wrapper, input); } } 
                                else if (e.key === 'Backspace' && input.value === '' && arr.length > 0) { arr.pop(); renderCapsules(arr, wrapper, input); }
                            };
                            renderCapsules(arr, wrapper, input);
                        };
                        setupCapsules(editTags, tagsWrapper, tagsInput); setupCapsules(editDeps, depsWrapper, depsInput);

                        const descTextarea = h('textarea', { id: 't-desc', class: 'fx-textarea', placeholder: 'Markdown supported...' }, !isNew ? (task.desc || '') : '');
                        const descEdit = h('div', { id: 't-desc-edit' }, [ descTextarea ]);
                        const descPreview = h('div', { id: 't-desc-preview', class: 'prose', style: { display: 'none', height: '180px', overflowY: 'auto', padding: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' } });

                        let previewMode = false;
                        const descToggle = h('button', { class: 'fx-btn', onClick: (e) => {
                            previewMode = !previewMode; e.target.innerText = previewMode ? 'Edit Mode' : 'Preview Mode';
                            if (previewMode) { descEdit.style.display = 'none'; descPreview.style.display = 'block'; descPreview.innerHTML = fluxide.ui.markdown(descTextarea.value || "*No description provided.*"); } 
                            else { descEdit.style.display = 'block'; descPreview.style.display = 'none'; }
                        }}, 'Preview Mode');
                        
                        const descHeader = h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' } }, [ h('label', { class: 'fx-form-label', style: { margin: 0 } }, 'Description'), descToggle ]);

                        const customEditSections = getComponents('task-edit-section').map(c => c.render(task, colId)).filter(Boolean);

                        const footer = h('div', { style: { marginTop: '25px', display: 'flex', justifyContent: 'flex-end', gap: '10px' } }, [
                            h('button', { class: 'fx-btn', onClick: () => modal.close() }, 'Cancel'),
                            h('button', { class: 'fx-btn fx-btn-primary', onClick: () => {
                                const title = titleInput.value; if(isNew && !title) return;
                                const newDesc = descTextarea.value; const newPri = priSelect.value;
                                
                                const finalTask = {
                                    id: isNew ? 't' + Date.now().toString().slice(-5) : task.id,
                                    title, priority: newPri, tags: editTags, deps: editDeps, desc: newDesc,
                                    todos: isNew ? [] : task.todos
                                };

                                if (isNew) {
                                    fluxide.board.addTask(colId, finalTask);
                                } else {
                                    state.update(s => {
                                        const c = s.workspace.columns.find(x => x.id === colId);
                                        const tIdx = c.tasks.findIndex(x => x.id === task.id);
                                        if(tIdx > -1) c.tasks[tIdx] = { ...c.tasks[tIdx], ...finalTask };
                                    });
                                    emit('workspace:change');
                                }
                                modal.close(); 
                            }}, isNew ? 'Create Task' : 'Save Changes')
                        ]);

                        win.appendChild(h('div', { class: 'fx-modal-body' }, [ header, idInfo, titleSection, propsRow, descHeader, descEdit, descPreview, ...customEditSections, footer ]));
                    }
                });
            }
        });
    }
});