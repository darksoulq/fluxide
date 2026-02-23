const IDB = (() => {
    const DB_NAME = 'FluxideDB';
    const STORE_NAME = 'system';
    let db;
    const init = () => new Promise((resolve, reject) => {
        if (db) return resolve(db);
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore(STORE_NAME);
        req.onsuccess = e => { db = e.target.result; resolve(db); };
        req.onerror = e => reject(e);
    });
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
    binaryExts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'mp4', 'webm', 'mp3', 'wav', 'ogg', 'zip', 'wasm', 'woff', 'woff2', 'ttf', 'otf', 'eot'],
    async init() {
        const handle = await IDB.get('workspace_handle');
        if (handle) {
            this.dirHandle = handle;
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
        for (let i = 0; i < parts.length; i++) {
            try {
                if (i === parts.length - 1 && isFile) {
                    curr = await curr.getFileHandle(parts[i], { create });
                } else {
                    curr = await curr.getDirectoryHandle(parts[i], { create });
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
        } catch(e) {}
    },
    async remove(path) {
        try {
            const parts = path.split('/').filter(Boolean);
            const name = parts.pop();
            const dirPath = parts.join('/');
            const dirHandle = dirPath ? await this.getHandle(dirPath, false, false) : this.dirHandle;
            if (dirHandle) await dirHandle.removeEntry(name, { recursive: true });
        } catch(e) {}
    }
};
window.FSManager = FSManager;