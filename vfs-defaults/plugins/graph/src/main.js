const { h, context } = fluxide.ui;
const { state, emit, on, expose, theme } = fluxide;

fluxide.register({
    id: 'graph',
    view: { id: 'graph', label: 'Graph', nav: true, order: 2 },
    init() {
        theme.registerVariables('graph', {
            '--graph-bg': 'var(--bg)',
            '--graph-node-bg': 'var(--surface-high)',
            '--graph-node-border': 'var(--border-bright)',
            '--graph-node-text': 'var(--text)',
            '--graph-node-active': 'var(--accent)',
            '--graph-link': 'var(--border)',
            '--graph-link-active': 'var(--accent)',
            '--graph-node-radius': '50%',
            '--graph-node-size': '10px'
        });

        expose('graph', {
            instance: null,
            nodes: [],
            links: [],
            simulation: null,
            config: {
                strength: -150,
                distance: 100,
                radius: 5
            },
            refresh: () => {
                const ws = state.get().workspace;
                const nodes = [];
                const links = [];
                
                if (ws.columns) {
                    ws.columns.forEach(col => {
                        nodes.push({ id: col.id, label: col.title, type: 'column', val: 15 });
                        col.tasks.forEach(task => {
                            nodes.push({ id: task.id, label: task.title, type: 'task', val: 10 });
                            links.push({ source: col.id, target: task.id, type: 'ownership' });
                            
                            if (task.deps) {
                                task.deps.forEach(depId => {
                                    links.push({ source: task.id, target: depId, type: 'dependency' });
                                });
                            }
                        });
                    });
                }
                fluxide.graph.nodes = nodes;
                fluxide.graph.links = links;
                if (fluxide.graph.instance) fluxide.graph.updateData();
            },
            updateData: () => {
                if (!fluxide.graph.instance) return;
                fluxide.graph.instance.graphData({
                    nodes: fluxide.graph.nodes,
                    links: fluxide.graph.links
                });
            },
            focusNode: (id) => {
                const node = fluxide.graph.nodes.find(n => n.id === id);
                if (node && fluxide.graph.instance) {
                    fluxide.graph.instance.centerAt(node.x, node.y, 1000);
                    fluxide.graph.instance.zoom(3, 1000);
                }
            },
            nodeContext: [],
            addNodeContext: (fn) => fluxide.graph.nodeContext.push(fn)
        });

        on('workspace:change', () => fluxide.graph.refresh());
    },
    async render(container) {
        this._container = container;
        container.innerHTML = '';
        
        const wrapper = h('div', { 
            id: 'fx-graph-canvas', 
            style: { width: '100%', height: '100%', background: 'var(--graph-bg)' } 
        });
        container.appendChild(wrapper);

        if (!window.ForceGraph) {
            await new Promise(res => {
                const s = document.createElement('script');
                s.src = 'https://unpkg.com/force-graph';
                s.onload = res;
                document.head.appendChild(s);
            });
        }

        fluxide.graph.refresh();

        const graph = ForceGraph()(wrapper)
            .graphData({ nodes: fluxide.graph.nodes, links: fluxide.graph.links })
            .nodeRelSize(fluxide.graph.config.radius)
            .nodeId('id')
            .nodeLabel('label')
            .nodeColor(n => {
                const styles = getComputedStyle(document.documentElement);
                return n.type === 'column' 
                    ? styles.getPropertyValue('--graph-node-active').trim() 
                    : styles.getPropertyValue('--graph-node-border').trim();
            })
            .linkColor(() => getComputedStyle(document.documentElement).getPropertyValue('--graph-link').trim())
            .linkDirectionalArrowLength(3)
            .linkDirectionalArrowRelPos(1)
            .onNodeClick(node => {
                if (node.type === 'task') {
                    const col = state.get().workspace.columns.find(c => c.tasks.some(t => t.id === node.id));
                    const task = col.tasks.find(t => t.id === node.id);
                    fluxide.task.openModal(task, col.id, 'view');
                }
            })
            .onNodeRightClick((node, e) => {
                const baseCtx = [
                    { label: `Focus: ${node.label}`, action: () => fluxide.graph.focusNode(node.id) }
                ];
                const extCtx = fluxide.graph.nodeContext.map(fn => fn(node)).filter(Boolean);
                context(e, [...baseCtx, ...extCtx.flat()]);
            })
            .cooldownTicks(100)
            .width(wrapper.offsetWidth)
            .height(wrapper.offsetHeight);

        graph.d3Force('charge').strength(fluxide.graph.config.strength);
        graph.d3Force('link').distance(fluxide.graph.config.distance);

        fluxide.graph.instance = graph;

        const observer = new ResizeObserver(() => {
            graph.width(wrapper.offsetWidth).height(wrapper.offsetHeight);
        });
        observer.observe(wrapper);
    }
});