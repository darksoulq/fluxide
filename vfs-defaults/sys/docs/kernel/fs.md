# File System (VFS)

The `fluxide.fs` object (backed by `FSManager`) acts as the bridge between Fluxide's in-memory state and the user's physical OS Directory Handle.

**Important:** The VFS state (`fluxide.state.get().vfs`) is an in-memory cache of the files. You *must* use `fluxide.fs` methods if you want changes to persist to the user's hard drive!

### `await fluxide.fs.read(path)`
Reads a file from the disk. Returns a string for text files, or a `File` object for binaries. Returns `null` if it doesn't exist.

### `await fluxide.fs.write(path, content)`
Writes data to the physical disk. Automatically creates intermediate folders. To create an empty folder, write a file ending with `/.keep`.
```javascript
// Writes to disk
await fluxide.fs.write('plugins/my_plug/data.json', '{}');

// Update in-memory state simultaneously!
fluxide.state.update(s => s.vfs['plugins/my_plug/data.json'] = '{}');
```

### `await fluxide.fs.remove(path)`
Deletes a file or directory (recursively) from the disk.

### `await fluxide.fs.exists(path)`
Returns a boolean indicating if the path exists on disk.

### `fluxide.fs.isBinary(path)`
Returns a boolean. Internally checks against extensions: png, jpg, mp4, zip, wasm, ttf, etc.

### `await fluxide.fs.scanWorkspace()`
Rescans the entire mounted directory from the disk and returns an object mapping paths to their contents. Use this to refresh the VFS state.