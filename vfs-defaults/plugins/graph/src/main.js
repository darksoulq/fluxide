const { state, emit, on, expose } = fluxide;

fluxide.register({
    id: 'graph',
    view: { id: 'graph', label: 'Graph', nav: true, order: 2 },
    init() {
        expose('graph', {
            nodes: {},
            refresh: () => {
                if(state.get().activeView === 'graph') fluxide.ui.openView('graph');
            }
        });
        on('workspace:change', () => fluxide.graph.refresh());

        fluxide.settings.register('plugins.graph', {
            label: 'Graph Settings',
            defaults: { graph_bg: 'dots' }
        });

        on('settings:render:plugins.graph', ({container}) => {
            container.appendChild(h('h2', { style: { marginTop: 0, marginBottom: '24px', fontSize: '20px' } }, 'Graph Settings'));
            container.appendChild(fluxide.settings.createControl('Background Style', 'select', 'graph_bg', { options: [{value:'dots',label:'Dot Grid'},{value:'grid',label:'Lines Grid'},{value:'none',label:'None'}] }));
        });

        on('settings:change', ({key}) => {
            if(key === 'graph_bg' && state.get().activeView === 'graph') fluxide.graph.refresh();
        });
    },
    render(container) {
        this._container = container;
        container.innerHTML = '';
        
        const ws = state.get().workspace;
        let tasks = [];
        if (ws.columns) {
            ws.columns.forEach(col => {
                tasks.push(...col.tasks);
            });
        }

        const wrapper = h('div', { 
            style: { width: '100%', height: '100%', background: 'var(--bg)', position: 'relative', overflow: 'hidden' } 
        });

        const svg = h('svg', { style: { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 } });
        
        const defs = h('defs', {}, [
            h('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: '8', refY: '5', markerWidth: '6', markerHeight: '6', orient: 'auto' }, [
                h('path', { d: 'M 0 1 L 8 5 L 0 9 L 2 5 z', fill: 'var(--accent)' })
            ])
        ]);
        svg.appendChild(defs);

        const canvas = h('div', { style: { width: '100%', height: '100%', position: 'absolute', inset: 0, zIndex: 2 } });

        let isDraggingCanvas = false;
        let startX = 0, startY = 0;
        let panX = state.get().graphPanX || 0;
        let panY = state.get().graphPanY || 0;
        let zoom = state.get().graphZoom || 1;

        const updateBg = () => {
            const bg = state.get().settings.graph_bg || 'dots';
            if (bg === 'dots') {
                wrapper.style.backgroundImage = `radial-gradient(var(--border) 1px, transparent 1px)`;
                wrapper.style.backgroundSize = `${25 * zoom}px ${25 * zoom}px`;
                wrapper.style.backgroundPosition = `${panX}px ${panY}px`;
            } else if (bg === 'grid') {
                wrapper.style.backgroundImage = `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`;
                wrapper.style.backgroundSize = `${25 * zoom}px ${25 * zoom}px`;
                wrapper.style.backgroundPosition = `${panX}px ${panY}px`;
            } else {
                wrapper.style.backgroundImage = 'none';
            }
        };

        const updateTransform = () => {
            canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
            canvas.style.transformOrigin = '0 0';
            svg.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
            svg.style.transformOrigin = '0 0';
            updateBg();
        };
        updateTransform();

        wrapper.onmousedown = (e) => {
            if (e.target !== wrapper && e.target !== canvas) return;
            isDraggingCanvas = true;
            startX = e.clientX - panX;
            startY = e.clientY - panY;
            wrapper.style.cursor = 'grabbing';
        };

        window.addEventListener('mousemove', (e) => {
            if (isDraggingCanvas) {
                panX = e.clientX - startX;
                panY = e.clientY - startY;
                updateTransform();
            }
        });

        window.addEventListener('mouseup', () => {
            if (isDraggingCanvas) {
                isDraggingCanvas = false;
                wrapper.style.cursor = 'default';
                state.update(s => { s.graphPanX = panX; s.graphPanY = panY; s.graphZoom = zoom; });
            }
        });

        wrapper.onwheel = (e) => {
            e.preventDefault();
            const xs = (e.clientX - panX) / zoom;
            const ys = (e.clientY - panY) / zoom;
            const delta = -e.deltaY;
            zoom += delta * 0.001;
            zoom = Math.min(Math.max(0.125, zoom), 4);
            panX = e.clientX - xs * zoom;
            panY = e.clientY - ys * zoom;
            updateTransform();
        };

        const renderLines = () => {
            svg.querySelectorAll('path.link').forEach(p => p.remove());
            tasks.forEach(task => {
                const srcEl = canvas.querySelector(`[data-id="${task.id}"]`);
                if(!srcEl) return;
                
                // T2 (Dependent Task) - Arrow points TO this element
                const sx = parseFloat(srcEl.style.left);
                const sy = parseFloat(srcEl.style.top) + srcEl.offsetHeight / 2;

                (task.deps || []).forEach(depId => {
                    const tgtEl = canvas.querySelector(`[data-id="${depId}"]`);
                    if(!tgtEl) return;
                    
                    // T1 (Dependency) - Arrow originates FROM this element
                    const tx = parseFloat(tgtEl.style.left) + tgtEl.offsetWidth;
                    const ty = parseFloat(tgtEl.style.top) + tgtEl.offsetHeight / 2;

                    const dx = sx - tx;
                    const cOff = Math.max(Math.abs(dx) * 0.5, 40);
                    
                    const p1x = tx + cOff;
                    const p1y = ty;
                    const p2x = sx - cOff;
                    const p2y = sy;

                    // Draw from T1 to T2 with arrow at T2
                    const path = h('path', {
                        class: 'link',
                        d: `M ${tx} ${ty} C ${p1x} ${p1y}, ${p2x} ${p2y}, ${sx} ${sy}`,
                        fill: 'none',
                        stroke: 'var(--accent)',
                        'stroke-width': '2',
                        'marker-end': 'url(#arrow)'
                    });
                    svg.appendChild(path);
                });
            });
        };

        const nodePositions = state.get().graphNodes || {};

        tasks.forEach((task, i) => {
            const pos = nodePositions[task.id] || { x: (i%5)*250 + 100, y: Math.floor(i/5)*150 + 100 };
            
            const card = h('div', {
                dataset: { id: task.id },
                style: {
                    position: 'absolute',
                    left: pos.x + 'px',
                    top: pos.y + 'px',
                    width: '200px',
                    background: 'var(--surface-high)',
                    border: '1px solid var(--border-bright)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    cursor: 'grab',
                    userSelect: 'none',
                    boxShadow: 'var(--shadow)',
                    color: 'var(--text)'
                },
                onContextMenu: (e) => {
                    const col = state.get().workspace.columns.find(c => c.tasks.some(t => t.id === task.id));
                    context(e, [
                        { label: 'View Details', action: () => fluxide.task.openModal(task, col.id, 'view') }
                    ]);
                }
            }, [
                h('div', { style: { fontWeight: 700, fontSize: '13px', marginBottom: '6px' } }, task.title),
                h('div', { style: { fontSize: '10px', color: 'var(--text-dim)' } }, task.id)
            ]);

            card.onmousedown = (e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                card.style.cursor = 'grabbing';
                const sX = e.clientX;
                const sY = e.clientY;
                const oX = pos.x;
                const oY = pos.y;

                const onMove = (me) => {
                    pos.x = oX + (me.clientX - sX) / zoom;
                    pos.y = oY + (me.clientY - sY) / zoom;
                    card.style.left = pos.x + 'px';
                    card.style.top = pos.y + 'px';
                    renderLines();
                };

                const onUp = () => {
                    card.style.cursor = 'grab';
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                    state.update(s => {
                        if(!s.graphNodes) s.graphNodes = {};
                        s.graphNodes[task.id] = { x: pos.x, y: pos.y };
                    });
                };

                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
            };

            canvas.appendChild(card);
            nodePositions[task.id] = pos;
        });

        state.update(s => s.graphNodes = nodePositions);

        wrapper.appendChild(svg);
        wrapper.appendChild(canvas);
        container.appendChild(wrapper);

        setTimeout(renderLines, 50);
    }
});