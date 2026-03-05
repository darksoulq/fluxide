const IDB = (() => {
    const DB_NAME = 'FluxideDB';
    const STORE_NAME = 'system';
    let db;
    let initPromise;
    const init = () => {
        if (db) return Promise.resolve(db);
        if (initPromise) return initPromise;
        initPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 2);
            req.onupgradeneeded = e => {
                if (!e.target.result.objectStoreNames.contains(STORE_NAME)) {
                    e.target.result.createObjectStore(STORE_NAME);
                }
            };
            req.onsuccess = e => { db = e.target.result; resolve(db); };
            req.onerror = e => reject(e);
        });
        return initPromise;
    };
    return {
        async get(key) {
            await init();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const req = tx.objectStore(STORE_NAME).get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        },
        async set(key, val) {
            await init();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const req = tx.objectStore(STORE_NAME).put(val, key);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
    };
})();
window.IDB = IDB;

const FSManager = {
    dirHandle: null,
    dirCache: new Map(),
    binaryExts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'mp4', 'webm', 'mp3', 'wav', 'ogg', 'zip', 'wasm', 'woff', 'woff2', 'ttf', 'otf', 'eot'],
    _lock() { if(window.fluxide && window.fluxide.lockReload) window.fluxide.lockReload(); },
    _unlock() { if(window.fluxide && window.fluxide.unlockReload) window.fluxide.unlockReload(); },
    async init() {
        const handle = await IDB.get('workspace_handle');
        if (handle) {
            this.dirHandle = handle;
            this.dirCache.clear();
            try {
                const perm = await handle.queryPermission({ mode: 'readwrite' });
                if (perm === 'granted') {
                    await handle.values().next();
                    return true;
                }
                return 'prompt';
            } catch (e) {
                return 'prompt';
            }
        }
        return false;
    },
    async mount() {
        try {
            this.dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            this.dirCache.clear();
            await IDB.set('workspace_handle', this.dirHandle);
            return true;
        } catch (e) { return false; }
    },
    isBinary(path) {
        const ext = path.split('.').pop().toLowerCase();
        return this.binaryExts.includes(ext);
    },
    async scanWorkspace() {
        const files = {};
        const scan = async (handle, path) => {
            for await (const entry of handle.values()) {
                const fullPath = path ? `${path}/${entry.name}` : entry.name;
                if (entry.kind === 'file') {
                    try {
                        const file = await entry.getFile();
                        if (this.isBinary(fullPath)) {
                            files[fullPath] = file;
                        } else {
                            files[fullPath] = await file.text();
                        }
                    } catch(e) {}
                } else if (entry.kind === 'directory') {
                    this.dirCache.set(fullPath, entry);
                    await scan(entry, fullPath);
                }
            }
        };
        if (this.dirHandle) await scan(this.dirHandle, '');
        return files;
    },
    async getHandle(path, create = false, isFile = true) {
        const parts = path.split('/').filter(Boolean);
        let curr = this.dirHandle;
        if (!curr) return null;
        let currentPath = '';
        for (let i = 0; i < parts.length; i++) {
            const isLast = (i === parts.length - 1);
            currentPath += (currentPath ? '/' : '') + parts[i];
            try {
                if (isLast && isFile) {
                    curr = await curr.getFileHandle(parts[i], { create });
                } else {
                    if (this.dirCache.has(currentPath)) {
                        curr = this.dirCache.get(currentPath);
                    } else {
                        curr = await curr.getDirectoryHandle(parts[i], { create });
                        this.dirCache.set(currentPath, curr);
                    }
                }
            } catch (e) {
                if (!create) return null;
                throw e;
            }
        }
        return curr;
    },
    async exists(path) {
        try { return (await this.getHandle(path, false, !path.endsWith('/.keep'))) !== null; } catch (e) { return false; }
    },
    async read(path) {
        try {
            const handle = await this.getHandle(path);
            if (!handle) return null;
            const file = await handle.getFile();
            return this.isBinary(path) ? file : await file.text();
        } catch(e) { return null; }
    },
    async write(path, content) {
        this._lock();
        try {
            if (path.endsWith('/.keep')) {
                const dirPath = path.substring(0, path.lastIndexOf('/'));
                if (dirPath) await this.getHandle(dirPath, true, false);
                return;
            }
            const handle = await this.getHandle(path, true);
            if (!handle) return;
            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
        } catch(e) {} finally {
            this._unlock();
        }
    },
    async remove(path) {
        this._lock();
        try {
            const parts = path.split('/').filter(Boolean);
            const name = parts.pop();
            const dirPath = parts.join('/');
            this.dirCache.delete(path);
            for (const key of this.dirCache.keys()) {
                if (key.startsWith(path + '/')) this.dirCache.delete(key);
            }
            const dirHandle = dirPath ? await this.getHandle(dirPath, false, false) : this.dirHandle;
            if (dirHandle) await dirHandle.removeEntry(name, { recursive: true });
        } catch(e) {} finally {
            this._unlock();
        }
    }
};
window.FSManager = FSManager;