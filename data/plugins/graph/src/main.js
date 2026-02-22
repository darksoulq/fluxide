// darksoulq/fluxide/darksoulq-fluxide-6f73439658620ffb9d43ea294ca73f49b6c7d35b/vfs-defaults/plugins/graph/src/main.js
const { h, context } = fluxide.ui;
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
            h('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: '10', refY: '5', markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse' }, [
                h('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'var(--accent)' })
            ])
        ]);
        svg.appendChild(defs);

        const canvas = h('div', { style: { width: '100%', height: '100%', position: 'absolute', inset: 0, zIndex: 2 } });

        let isDraggingCanvas = false;
        let startX = 0, startY = 0;
        let panX = state.get().graphPanX || 0;
        let panY = state.get().graphPanY || 0;
        let zoom = state.get().graphZoom || 1;

        const updateTransform = () => {
            canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
            svg.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
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
            isDraggingCanvas = false;
            wrapper.style.cursor = 'default';
            state.update(s => { s.graphPanX = panX; s.graphPanY = panY; s.graphZoom = zoom; });
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
                const sr = srcEl.getBoundingClientRect();
                const cw = canvas.getBoundingClientRect();
                
                const sx = (sr.left - cw.left) / zoom + sr.width / 2;
                const sy = (sr.top - cw.top) / zoom + sr.height / 2;

                (task.deps || []).forEach(depId => {
                    const tgtEl = canvas.querySelector(`[data-id="${depId}"]`);
                    if(!tgtEl) return;
                    const tr = tgtEl.getBoundingClientRect();
                    const tx = (tr.left - cw.left) / zoom + tr.width / 2;
                    const ty = (tr.top - cw.top) / zoom + tr.height / 2;

                    const dx = tx - sx;
                    const dy = ty - sy;
                    
                    const p1x = sx + dx * 0.2;
                    const p1y = sy;
                    const p2x = sx + dx * 0.8;
                    const p2y = ty;

                    const path = h('path', {
                        class: 'link',
                        d: `M ${sx} ${sy} C ${p1x} ${p1y}, ${p2x} ${p2y}, ${tx} ${ty}`,
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