const IDB = {
	async getDB() { return new Promise((resolve, reject) => { const req = indexedDB.open('FluxideDB', 1); req.onupgradeneeded = () => req.result.createObjectStore('config'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); },
	async get(key) { const db = await this.getDB(); return new Promise(resolve => { const req = db.transaction('config').objectStore('config').get(key); req.onsuccess = () => resolve(req.result); }); },
	async set(key, val) { const db = await this.getDB(); return new Promise(resolve => { const req = db.transaction('config', 'readwrite').objectStore('config').put(val, key); req.onsuccess = () => resolve(); }); }
};

const FSManager = {
	dirHandle: null,

	async init() {
		if(!window.showDirectoryPicker) return false;
		try {
			const handle = await IDB.get('workspace_handle');
			if (handle) {
				if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') { this.dirHandle = handle; return true; }
				return 'prompt';
			}
		} catch(e) {}
		return false;
	},

	async mount() { try { const handle = await window.showDirectoryPicker({ mode: 'readwrite' }); await IDB.set('workspace_handle', handle); this.dirHandle = handle; return true; } catch(e) { return false; } },

	async write(path, content) {
		if(!this.dirHandle) return;
		try {
			const parts = path.split('/'); let curr = this.dirHandle;
			for(let i=0; i<parts.length-1; i++) if(parts[i]) curr = await curr.getDirectoryHandle(parts[i], {create: true});
			const fileHandle = await curr.getFileHandle(parts[parts.length-1], {create: true});
			const writable = await fileHandle.createWritable();
			await writable.write(content); await writable.close();
		} catch(e) {}
	},

	async read(path) {
		 if(!this.dirHandle) return null;
		 try {
			 const parts = path.split('/'); let curr = this.dirHandle;
			 for(let i=0; i<parts.length-1; i++) if(parts[i]) curr = await curr.getDirectoryHandle(parts[i]);
			 const fileHandle = await curr.getFileHandle(parts[parts.length-1]);
			 const file = await fileHandle.getFile(); return await file.text();
		 } catch(e) { return null; }
	},

	async remove(path) {
		if(!this.dirHandle) return;
		try {
			const parts = path.split('/'); let curr = this.dirHandle;
			for(let i=0; i<parts.length-1; i++) if(parts[i]) curr = await curr.getDirectoryHandle(parts[i]);
			await curr.removeEntry(parts[parts.length-1]);
		} catch(e) {}
	},

	async exists(path) { return (await this.read(path)) !== null; },

	async scanWorkspace(dirHandle = this.dirHandle, prefix = '') {
		const files = {};
		for await (const entry of dirHandle.values()) {
			if (entry.name.startsWith('.git') || entry.name === 'node_modules') continue;
			if (entry.kind === 'file') {
				 const file = await entry.getFile(); files[prefix + entry.name] = await file.text();
			} else if (entry.kind === 'directory') {
				 Object.assign(files, await this.scanWorkspace(entry, prefix + entry.name + '/'));
			}
		}
		return files;
	}
};