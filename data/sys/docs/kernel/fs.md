# File System API

The Kernel exposes a direct wrapper to the browser's Native File System Access API. Operations bypass standard browser caches, reading and writing directly to the user's mounted physical folder.

### `fluxide.fs.write(path, content)`

Writes a string payload to the specified path. It automatically traverses the path and creates any non-existent intermediary directories before saving the file.

```javascript
await fluxide.fs.write('data/config.json', '{"status": "ok"}');
```

### `fluxide.fs.read(path)`

Retrieves the text content of a file at the specified path. Returns `null` if the file or path does not exist.

```javascript
const text = await fluxide.fs.read('data/config.json');
```

### `fluxide.fs.remove(path)`

Permanently deletes a file or a directory structure from the local disk.

```javascript
await fluxide.fs.remove('data/config.json');
```

### `fluxide.fs.exists(path)`

Checks for the physical presence of a file or folder. Returns a boolean.

```javascript
const hasData = await fluxide.fs.exists('data/config.json');
```

### `fluxide.fs.scanWorkspace()`

Recursively maps the entire mounted physical directory into a flat object dictionary. The keys are the relative paths, and the values are the file contents. It inherently ignores `.git` and `node_modules` directories to preserve memory.

```javascript
const map = await fluxide.fs.scanWorkspace();
```