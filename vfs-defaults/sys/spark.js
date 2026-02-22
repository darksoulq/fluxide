const { h } = fluxide.ui;
const { state, expose, on } = fluxide;

const proxyApi = (obj, apiName) => {
    if (!obj || typeof obj !== 'object') return;
    Object.getOwnPropertyNames(obj).forEach(k => {
        try {
            if (typeof obj[k] === 'function' && !obj[k].__spark_proxied) {
                if (apiName === 'ui' && (k === 'h' || k === 'markdown' || k === 'modal')) return;
                if (apiName === 'state' && k === 'get') return;
                const orig = obj[k];
                obj[k] = function(...args) {
                    if (fluxide.state.get().settings.spark_enabled !== 'true' || !Spark.recording) return orig.apply(this, args);
                    const stack = new Error().stack || '';
                    let caller = 'unknown';
                    const lines = stack.split('\n');
                    for (let i = 2; i < lines.length; i++) {
                        const m = lines[i].match(/(?:plugins|sys)\/([^\/:]+)/);
                        if (m && m[1] !== 'spark.js' && m[1] !== 'spark') {
                            caller = m[1].replace('.js', '');
                            break;
                        }
                    }
                    const t0 = performance.now();
                    try {
                        const res = orig.apply(this, args);
                        if (res instanceof Promise) {
                            return res.finally(() => Spark.recordCall(caller, 'API', `${apiName}.${k}`, performance.now() - t0));
                        } else {
                            Spark.recordCall(caller, 'API', `${apiName}.${k}`, performance.now() - t0);
                            return res;
                        }
                    } catch(err) {
                        Spark.recordCall(caller, 'API', `${apiName}.${k}`, performance.now() - t0);
                        throw err;
                    }
                };
                obj[k].__spark_proxied = true;
            }
        } catch(e) {}
    });
};

const Spark = {
    active: false,
    recording: false,
    renderGraphs: true,
    activeTab: 'telemetry',
    filterPlugin: 'all',
    contentEl: null,
    _container: null,
    fpsCanvas: null,
    memCanvas: null,
    currentFpsEl: null,
    currentMemEl: null,
    data: { fps: [], mem: [] },
    stats: { total: 0, calls: 0, plugins: {} },
    expandedNodes: new Set(['root']),
    origOn: null,
    origExpose: null,
    lastTime: 0,
    frames: 0,
    rafId: null,

    formatBytes(bytes) {
        if(bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    resetStats() {
        this.stats = { total: 0, calls: 0, plugins: {} };
    },

    recordCall(plugin, type, name, dur) {
        if (!this.recording) return;
        this.stats.total += dur;
        this.stats.calls++;
        
        if (!this.stats.plugins[plugin]) this.stats.plugins[plugin] = { total: 0, calls: 0, types: {} };
        const pObj = this.stats.plugins[plugin];
        pObj.total += dur;
        pObj.calls++;
        
        if (!pObj.types[type]) pObj.types[type] = { total: 0, calls: 0, items: {} };
        const tObj = pObj.types[type];
        tObj.total += dur;
        tObj.calls++;
        
        if (!tObj.items[name]) tObj.items[name] = { total: 0, max: 0, calls: 0 };
        const iObj = tObj.items[name];
        iObj.total += dur;
        iObj.calls++;
        if (dur > iObj.max) iObj.max = dur;
    },

    init() {
        fluxide.settings.register('system.profiler', {
            label: 'Profiler',
            defaults: { spark_enabled: 'false' }
        });

        on('settings:render:system.profiler', ({container}) => {
            container.appendChild(h('h2', { style: { marginTop: 0, marginBottom: '24px', fontSize: '20px', color: 'var(--text)' } }, 'Performance Profiler'));
            container.appendChild(fluxide.settings.createControl('Enable Spark Profiler', 'toggle', 'spark_enabled'));
            container.appendChild(h('p', { style: { fontSize: '13px', color: 'var(--text-dim)', marginTop: '16px', lineHeight: '1.6' } }, 'Enables real-time performance telemetry, advanced API wrapping, and event profiling. Reload required for clean unhook.'));
        });

        this.origOn = fluxide.on;
        fluxide.on = function(e, cb) {
            const stack = new Error().stack || '';
            let caller = 'unknown';
            const lines = stack.split('\n');
            for (let i = 1; i < lines.length; i++) {
                const m = lines[i].match(/(?:plugins|sys)\/([^\/:]+)/);
                if (m && m[1] !== 'spark.js' && m[1] !== 'spark') {
                    caller = m[1].replace('.js', '');
                    break;
                }
            }
            const wrapped = function(...args) {
                if (fluxide.state.get().settings.spark_enabled !== 'true' || !Spark.recording) return cb.apply(this, args);
                const t0 = performance.now();
                try {
                    const res = cb.apply(this, args);
                    if (res instanceof Promise) {
                        return res.finally(() => Spark.recordCall(caller, 'Event Hook', e, performance.now() - t0));
                    } else {
                        Spark.recordCall(caller, 'Event Hook', e, performance.now() - t0);
                        return res;
                    }
                } catch(err) {
                    Spark.recordCall(caller, 'Event Hook', e, performance.now() - t0);
                    throw err;
                }
            };
            wrapped.__orig = cb;
            Spark.origOn.call(fluxide, e, wrapped);
        };

        this.origExpose = fluxide.expose;
        fluxide.expose = function(id, obj) {
            Spark.origExpose.call(fluxide, id, obj);
            proxyApi(obj, id);
        };

        ['fs', 'ui', 'plugins', 'keybinds', 'settings', 'theme'].forEach(k => proxyApi(fluxide[k], k));

        on('settings:change', ({key, val}) => {
            if (key === 'spark_enabled') {
                if (val === 'false' && state.get().activeView === 'spark') {
                    fluxide.ui.openView('ide');
                } else {
                    fluxide.ui.openView(state.get().activeView);
                }
            }
        });
    },

    loop() {
        if (!this.active || state.get().settings.spark_enabled !== 'true') {
            if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
            return;
        }
        const now = performance.now();
        this.frames++;
        
        if (now - this.lastTime >= 1000) {
            const fps = this.frames;
            let memUsed = 0;
            if (performance.memory) memUsed = performance.memory.usedJSHeapSize;

            this.data.fps.push(fps);
            this.data.mem.push(memUsed);

            if (this.data.fps.length > 60) this.data.fps.shift();
            if (this.data.mem.length > 60) this.data.mem.shift();

            if (this.activeTab === 'telemetry') {
                if (this.currentFpsEl) this.currentFpsEl.innerText = fps + ' FPS';
                if (this.currentMemEl) this.currentMemEl.innerText = this.formatBytes(memUsed);
                
                if (this.renderGraphs) {
                    this.drawChart(this.fpsCanvas, this.data.fps, '#10b981', 144);
                    const maxMem = Math.max(...this.data.mem, 1024 * 1024 * 50);
                    this.drawChart(this.memCanvas, this.data.mem, '#bd93f9', maxMem * 1.2);
                } else {
                    if(this.fpsCanvas) { const ctx = this.fpsCanvas.getContext('2d'); ctx.clearRect(0,0,this.fpsCanvas.width,this.fpsCanvas.height); }
                    if(this.memCanvas) { const ctx = this.memCanvas.getContext('2d'); ctx.clearRect(0,0,this.memCanvas.width,this.memCanvas.height); }
                }
            }

            this.frames = 0;
            this.lastTime = now;
        }
        this.rafId = requestAnimationFrame(() => this.loop());
    },

    drawChart(canvas, data, color, maxVal) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        
        ctx.clearRect(0, 0, w, h);
        if (data.length === 0) return;

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        data.forEach((val, i) => {
            const x = (i / Math.max(1, 59)) * w;
            const y = h - ((val / maxVal) * h);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        
        ctx.stroke();

        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.fillStyle = color.replace(')', ', 0.2)').replace('rgb', 'rgba').replace('#10b981', 'rgba(16, 185, 129, 0.2)').replace('#bd93f9', 'rgba(189, 147, 249, 0.2)');
        ctx.fill();
    },

    renderTelemetry() {
        this.fpsCanvas = h('canvas', { width: 600, height: 150, style: { width: '100%', height: '150px', background: 'var(--surface-high)', borderRadius: '6px' } });
        this.memCanvas = h('canvas', { width: 600, height: 150, style: { width: '100%', height: '150px', background: 'var(--surface-high)', borderRadius: '6px' } });

        this.currentFpsEl = h('div', { style: { fontSize: '32px', fontWeight: 800, fontFamily: 'var(--font-code)', color: 'var(--accent)', marginBottom: '12px' } }, '--');
        this.currentMemEl = h('div', { style: { fontSize: '32px', fontWeight: 800, fontFamily: 'var(--font-code)', color: 'var(--accent)', marginBottom: '12px' } }, '--');
        const domVal = h('div', { style: { fontSize: '32px', fontWeight: 800, fontFamily: 'var(--font-code)', color: 'var(--text)' } }, document.getElementsByTagName('*').length.toString());

        const makeCard = (title, body) => h('div', { style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px', display: 'flex', flexDirection: 'column' } }, [
            h('div', { style: { fontSize: '13px', fontWeight: 700, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' } }, title),
            body
        ]);

        this.contentEl.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '24px' } }, [
            makeCard('Framerate (FPS)', h('div', {}, [this.currentFpsEl, this.fpsCanvas])),
            makeCard('JS Heap Memory', h('div', {}, [this.currentMemEl, this.memCanvas]))
        ]));
        
        this.contentEl.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' } }, [
            makeCard('DOM Elements', domVal),
            makeCard('Tracked APIs & Hooks', h('div', { style: { fontSize: '32px', fontWeight: 800, fontFamily: 'var(--font-code)', color: 'var(--text)' } }, this.stats.calls.toString()))
        ]));
    },

    buildTreeNode(id, title, totalTime, calls, parentTotalTime, childrenFactory) {
        const isExpanded = this.expandedNodes.has(id);
        const percent = parentTotalTime ? ((totalTime / parentTotalTime) * 100).toFixed(2) : (100).toFixed(2);
        
        const head = h('div', { 
            style: { display: 'flex', alignItems: 'center', cursor: childrenFactory ? 'pointer' : 'default', padding: '6px 8px', borderBottom: '1px solid var(--surface-high)', borderRadius: '4px' },
            onMouseOver: (e) => e.currentTarget.style.background = 'var(--surface-high)',
            onMouseOut: (e) => e.currentTarget.style.background = 'transparent',
            onClick: () => {
                if (!childrenFactory) return;
                if (isExpanded) this.expandedNodes.delete(id);
                else this.expandedNodes.add(id);
                this.renderContent();
            }
        }, [
            h('span', { style: { width: '16px', display: 'inline-block', color: 'var(--text-dim)', fontSize: '10px' } }, childrenFactory ? (isExpanded ? '▼' : '▶') : ' '),
            h('span', { style: { fontWeight: 600, color: 'var(--text)', marginRight: '12px', fontSize: '13px' } }, title),
            h('span', { style: { color: percent > 50 ? 'var(--danger)' : (percent > 20 ? '#fbbf24' : 'var(--accent)'), fontFamily: 'var(--font-code)', fontSize: '12px', marginRight: '12px', width: '60px', textAlign: 'right' } }, `${percent}%`),
            h('span', { style: { color: 'var(--text-dim)', fontFamily: 'var(--font-code)', fontSize: '12px' } }, `${totalTime.toFixed(2)}ms (${calls} calls)`)
        ]);

        const body = h('div', { style: { paddingLeft: '24px', display: isExpanded ? 'block' : 'none', borderLeft: '1px solid var(--surface-high)', marginLeft: '6px' } });
        if (isExpanded && childrenFactory) {
            childrenFactory().forEach(c => body.appendChild(c));
        }

        return h('div', {}, [head, body]);
    },

    renderCallTree() {
        if (this.stats.total === 0) {
            this.contentEl.appendChild(h('div', { style: { color: 'var(--text-dim)', padding: '20px', textAlign: 'center', fontSize: '15px' } }, 'No profiling data recorded yet. Enable "Record Data" and interact with the UI.'));
            return;
        }

        const filterWrap = h('div', { style: { marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' } }, [
            h('span', { style: { color: 'var(--text)', fontSize: '14px', fontWeight: 600 } }, 'Filter Plugin:'),
            h('select', { class: 'fx-select', style: { width: '250px', marginBottom: 0 }, onChange: (e) => { this.filterPlugin = e.target.value; this.renderContent(); } }, [
                h('option', { value: 'all', selected: this.filterPlugin === 'all' }, 'All Plugins'),
                ...Object.keys(this.stats.plugins).map(p => h('option', { value: p, selected: this.filterPlugin === p }, p))
            ])
        ]);
        this.contentEl.appendChild(filterWrap);

        const treeContainer = h('div', { style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', overflowX: 'auto' } });
        
        let displayTotal = 0;
        let displayCalls = 0;
        let pKeys = Object.keys(this.stats.plugins);
        if (this.filterPlugin !== 'all') {
            pKeys = pKeys.filter(p => p === this.filterPlugin);
            pKeys.forEach(p => { displayTotal += this.stats.plugins[p].total; displayCalls += this.stats.plugins[p].calls; });
        } else {
            displayTotal = this.stats.total;
            displayCalls = this.stats.calls;
        }

        if (displayTotal === 0) {
            treeContainer.appendChild(h('div', { style: { color: 'var(--text-dim)', padding: '10px' } }, 'No time recorded for selection.'));
            this.contentEl.appendChild(treeContainer);
            return;
        }

        const root = this.buildTreeNode('root', 'System Total', displayTotal, displayCalls, displayTotal, () => {
            return pKeys.sort((a,b) => this.stats.plugins[b].total - this.stats.plugins[a].total).map(p => {
                const pData = this.stats.plugins[p];
                return this.buildTreeNode(`root-${p}`, p, pData.total, pData.calls, displayTotal, () => {
                    return Object.keys(pData.types).sort((a,b) => pData.types[b].total - pData.types[a].total).map(t => {
                        const tData = pData.types[t];
                        return this.buildTreeNode(`root-${p}-${t}`, t, tData.total, tData.calls, pData.total, () => {
                            return Object.keys(tData.items).sort((a,b) => tData.items[b].total - tData.items[a].total).map(i => {
                                const iData = tData.items[i];
                                return this.buildTreeNode(`root-${p}-${t}-${i}`, i, iData.total, iData.calls, tData.total, null);
                            });
                        });
                    });
                });
            });
        });

        if (!this.expandedNodes.has('root')) this.expandedNodes.add('root');
        treeContainer.appendChild(root);
        this.contentEl.appendChild(treeContainer);
    },

    renderContent() {
        if (!this.contentEl) return;
        this.contentEl.innerHTML = '';
        if (this.activeTab === 'telemetry') this.renderTelemetry();
        else if (this.activeTab === 'calltree') this.renderCallTree();
    },

    render(container) {
        this.active = true;
        this._container = container;
        container.innerHTML = '';
        container.style.background = 'var(--bg)';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        
        const tabBtn = (id, label) => h('button', {
            style: { 
                padding: '16px 24px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: '0.2s',
                background: this.activeTab === id ? 'var(--surface)' : 'transparent',
                color: this.activeTab === id ? 'var(--text)' : 'var(--text-dim)',
                borderBottom: this.activeTab === id ? '2px solid var(--accent)' : '2px solid transparent'
            },
            onClick: () => { 
                this.activeTab = id; 
                this.render(this._container); 
            }
        }, label);

        const toggles = h('div', { style: { display: 'flex', gap: '20px', alignItems: 'center', marginLeft: 'auto', paddingRight: '24px' } }, [
            h('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text)', fontSize: '13px', cursor: 'pointer', margin: 0 } }, [
                h('input', { type: 'checkbox', checked: this.recording, onChange: (e) => { this.recording = e.target.checked; } }),
                'Record Data'
            ]),
            h('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text)', fontSize: '13px', cursor: 'pointer', margin: 0 } }, [
                h('input', { type: 'checkbox', checked: this.renderGraphs, onChange: (e) => { this.renderGraphs = e.target.checked; if(!this.renderGraphs) { this.renderContent(); } } }),
                'Render Graphs'
            ]),
            h('button', { class: 'fx-btn', style: { padding: '6px 16px', fontSize: '12px' }, onClick: () => { this.resetStats(); this.renderContent(); } }, 'Reset Stats')
        ]);

        const header = h('div', { style: { background: 'var(--surface-low)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', paddingLeft: '16px' } }, [
            tabBtn('telemetry', 'Telemetry Overview'),
            tabBtn('calltree', 'Call Tree Profiler'),
            toggles
        ]);

        this.contentEl = h('div', { style: { flex: 1, padding: '32px', overflowY: 'auto', boxSizing: 'border-box' } });
        
        container.appendChild(header);
        container.appendChild(this.contentEl);

        this.renderContent();

        this.frames = 0;
        this.lastTime = performance.now();
        if (!this.rafId && state.get().settings.spark_enabled === 'true') {
            this.rafId = requestAnimationFrame(() => this.loop());
        }
    },

    unmount() {
        this.active = false;
        if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
        this.contentEl = null;
        this.fpsCanvas = null;
        this.memCanvas = null;
        this.currentFpsEl = null;
        this.currentMemEl = null;
        this._container = null;
    }
};

fluxide.register({
    id: 'spark',
    view: { 
        id: 'spark', 
        label: 'Spark', 
        get nav() { return fluxide.state.get().settings.spark_enabled === 'true'; }, 
        order: 99 
    },
    init: () => Spark.init(),
    render: (c) => Spark.render(c),
    unmount: () => Spark.unmount()
});