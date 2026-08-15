---
title: "03 · Files, properly"
sidebar_label: "03 · Files, properly"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [File System API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API), [`Window.showOpenFilePicker()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker), [`FileSystemFileHandle.createWritable()`](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createWritable), [`FileSystemWritableFileStream`](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemWritableFileStream), [`FileSystemHandle.requestPermission()`](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/requestPermission), [`StorageManager.getDirectory()`](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/getDirectory), [`FileSystemSyncAccessHandle`](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemSyncAccessHandle). Documentation-validated; **no timings and no console output**. ⚠️ MDN marks parts of this API **experimental with limited browser support** — feature-detect and read the compatibility tables.

The hack this replaces is the round trip. `<input type="file">` reads a file; `<a download>` writes
a *new* one. The user opens `budget.csv`, edits it in your app, saves — and gets
`budget (3).csv` in their Downloads folder. The web could read a file and it could produce a file,
but it could never **edit the file the user opened**.

## Opening, and what you get back

```js
const [handle] = await window.showOpenFilePicker({
  types: [{ description: 'CSV', accept: { 'text/csv': ['.csv'] } }],
  excludeAcceptAllOption: true,
  multiple: false,
});

const file = await handle.getFile();      // a File — i.e. a Blob snapshot
const text = await file.text();
```

The picker returns **handles**, not paths. A `FileSystemFileHandle` is a capability: it is the
user's grant to touch one particular file, and it never exposes where on disk that file lives
(`getFile()` gives you a `File`, which is a `Blob` with a name — see
[Phase 11 · 12 · `Blob`, `File` and object URLs](../../phase-11-network-storage/12-blob-file-filereader/README.md)).
All three pickers —
`showOpenFilePicker`, `showSaveFilePicker`, `showDirectoryPicker` — require a **secure context**
and a **user gesture**, and 🔴 **reject with `AbortError` when the user cancels**, which is a
normal outcome and not an error to report.

## Writing back to the same file

```js
const writable = await handle.createWritable();
await writable.write(newContents);
await writable.close();                    // 🔴 the file changes HERE, not on write()
```

🔴 **Nothing reaches the real file until `close()`.** MDN is explicit: changes made through the
stream *"won't be reflected in the file represented by the file handle until the stream has been
closed"*, because the data is written to a temporary file that replaces the original on close.
Which is excellent news — a crash mid-write leaves the user's file intact — and a trap: forget
`close()` and the save silently does nothing.

| Option / call | What it does |
|---|---|
| `createWritable({ keepExistingData: true })` | copy the existing contents into the temp file first — required for a partial or in-place edit |
| `write({ type: 'seek', position })` | move the cursor |
| `write({ type: 'write', position, data })` | write at a position |
| `write({ type: 'truncate', size })` | resize |
| `createWritable({ mode: 'exclusive' })` | only one writer; a second throws `NoModificationAllowedError` |

⚠️ **The default `mode: 'siloed'` lets several tabs open writers at once**, each with its own swap
file, and the last flush wins. Two tabs of your editor on one document is exactly the situation
[15 · Cross-tab coordination](../15-cross-tab-coordination/README.md) exists for — a Web Lock, or
`ifAvailable` to say "already open in another tab".

The other exceptions worth knowing: `NotAllowedError` when the `readwrite` permission is not
granted, `NotFoundError` when the entry has gone, and `AbortError` from an implementation-defined
malware or safe-browsing check.

## Permissions, and the session boundary

A handle is **structured-cloneable**, so it can be stored in IndexedDB and a "recent files" list
survives a reload. What does not automatically survive is the *permission*.

```js
async function ensureWritable(handle) {
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return (await handle.requestPermission(opts)) === 'granted';   // 🔴 needs a gesture
}
```

`queryPermission()` asks without prompting; `requestPermission()` prompts, and MDN is specific that
it **requires transient user activation** — it throws `SecurityError` without one, in a cross-origin
context, or where activation cannot be consumed (a Web Worker). Both return `'granted'`,
`'denied'` or `'prompt'`.

🔴 **Design for the re-grant.** Restore the handle on load, show the file in the UI, and ask for
permission on the user's first save click — not on startup, where there is no gesture and the call
throws.

## The origin private file system — storage, not files

```js
const root = await navigator.storage.getDirectory();
const handle = await root.getFileHandle('draft.txt', { create: true });
```

OPFS is a filesystem the **origin** owns: no picker, no permission prompt, and nothing the user can
browse to. It is a storage back end that happens to have a file-shaped API — the right home for a
WASM database, a large local cache, or a scratch file too big to sit in memory.

Its distinguishing feature is in a worker:

```js
// inside a worker
const access = await handle.createSyncAccessHandle();
const size = access.getSize();
access.write(bytes, { at: size });
access.flush();
access.close();
```

`FileSystemSyncAccessHandle` is **synchronous** — `read`, `write`, `getSize`, `flush`, `close`, no
promises — which is what makes it usable as the storage layer under compiled code that expects
POSIX-style file I/O. It is workers-only, for the obvious reason: synchronous I/O on the main
thread is exactly the long task [14 · Yielding to the main thread](../14-yielding-to-the-main-thread.md)
is about.

## Choosing

| The user's intent | Use |
|---|---|
| "Upload this to you" | `<input type="file">` — no new API needed |
| "Give me a copy" | `<a download>` with a `Blob` URL |
| "Let me edit *my* file, repeatedly" | **File System Access** — a handle, `createWritable`, `close` |
| "Remember what I was working on" | the handle in IndexedDB + a permission re-grant on the next save |
| App-owned data the user never sees | **OPFS**, and a sync access handle in a worker |

🔴 **Feature-detect and keep the round trip.** `if ('showOpenFilePicker' in window)` picks the
native path; everything else gets file-input-in, download-out, which still works everywhere. That
is the same shape as the clipboard and share fallbacks — capability check, working alternative, no
browser sniffing ([12 · Feature detection](../12-feature-detection/README.md)).

## Gotchas

**Symptom: `AbortError` in the logs every time someone opens the picker and changes their mind.**
Cause — cancelling rejects.
Fix — catch `AbortError` and return quietly.

**Symptom: `write()` resolved but the file on disk is unchanged.**
Cause — the stream was never closed; writes land in a temporary file until `close()`.
Fix — always `await writable.close()`, in a `finally`.

**Symptom: saving truncates the file to just the new part.**
Cause — a fresh writable starts empty.
Fix — `createWritable({ keepExistingData: true })` for partial writes.

**Symptom: a restored handle throws on save after a reload.**
Cause — the handle persisted; the `readwrite` permission did not.
Fix — `queryPermission`, then `requestPermission` **inside a click**.

**Symptom: `SecurityError` from `requestPermission()`.**
Cause — called without transient activation, cross-origin, or from a worker.
Fix — call it from a real user gesture on the main thread.

**Symptom: two tabs of the editor overwrite each other.**
Cause — the default `siloed` writer mode; last flush wins.
Fix — coordinate with a Web Lock, or open the writer with `mode: 'exclusive'` and handle
`NoModificationAllowedError`.

**Symptom: `createSyncAccessHandle` is not a function.**
Cause — it is OPFS-only and worker-only.
Fix — get the directory from `navigator.storage.getDirectory()` inside a worker.

**Symptom: the whole flow is missing in one browser.**
Cause — limited support; parts of the API are experimental.
Fix — feature-detect and fall back to `<input type="file">` plus a download link.

## Interview questions

**★ What can the File System Access API do that `<input type="file">` cannot?**
Write back to the file the user opened. The picker returns a *handle* — a capability for that file
— so an app can save in place repeatedly instead of producing `report (3).csv` in Downloads each
time.

**★ Why does a write not appear until `close()`?**
Because the implementation writes to a temporary file and swaps it in on close. A crash mid-write
leaves the original intact — and forgetting `close()` means nothing is saved.

**★ You store a handle in IndexedDB and restore it tomorrow. What happens?**
The handle works, but the permission may need re-granting, and `requestPermission()` requires a user
gesture. Restore the handle at load and ask on the first save click.

**★ What is OPFS and when is it the right choice?**
An origin-owned filesystem with no picker and no prompt — storage with a file API. It is for
app-owned data: a WASM database, a large cache, scratch files. In a worker it offers synchronous
access handles, which is what compiled code expects.

**★ Why is `createSyncAccessHandle` restricted to workers?**
Because it is synchronous I/O. On the main thread it would block rendering and input for the length
of every read and write.

**★ Two tabs have the same file open. What do you do?**
Either serialise with a Web Lock, or open the writer in `exclusive` mode and treat
`NoModificationAllowedError` as "another tab is editing" — the default siloed mode silently lets the
last flush win.

---

← [02 · Sharing](./02-web-share.md) · [Topic index](./README.md)
