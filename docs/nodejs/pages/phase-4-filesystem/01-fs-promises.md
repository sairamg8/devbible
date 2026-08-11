---
title: "node:fs/promises"
sidebar_label: "01 · fs/promises"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`node:fs/promises` is the default filesystem API. Every operation returns a
promise, errors are ordinary exceptions with a `code`, and nothing blocks the
event loop.**

```js
import { readFile, writeFile, appendFile, rename, rm, mkdir } from 'node:fs/promises';
```

## The everyday five

```js
// basics.mjs
import { writeFile, readFile, appendFile, rename, rm, mkdir } from 'node:fs/promises';

await rm('sandbox', { recursive: true, force: true });   // idempotent delete
await mkdir('sandbox/nested/deep', { recursive: true }); // mkdir -p
await writeFile('sandbox/a.txt', 'hello');               // creates or TRUNCATES
await appendFile('sandbox/a.txt', ' world');
console.log('read:', await readFile('sandbox/a.txt', 'utf8'));
await rename('sandbox/a.txt', 'sandbox/b.txt');          // atomic within one filesystem
```

```console
$ node basics.mjs
read: hello world
```

| Call | Note |
|---|---|
| `readFile(path)` | Returns a **Buffer**. Pass `'utf8'` for a string |
| `writeFile(path, data)` | **Truncates** an existing file. `{ flag: 'wx' }` to fail if it exists |
| `appendFile(path, data)` | Creates if missing |
| `rename(old, new)` | Atomic **within one filesystem**; `EXDEV` across devices |
| `rm(path, { recursive, force })` | The modern delete. `force: true` makes a missing path a no-op |
| `mkdir(path, { recursive: true })` | `mkdir -p`; no `EEXIST` |
| `cp(src, dest, { recursive })` | Copy a tree |
| `stat` / `access` | [Page 08](08-stat-and-existence.md) |
| `open` | Returns a `FileHandle` — [page 09](09-file-handles.md) |

**`recursive: true` changes the error behaviour, not just the depth.** `mkdir`
with it succeeds silently on an existing directory; without it you get `EEXIST`:

```console
$ node mkdir.mjs
mkdir recursive twice: undefined
mkdir non-recursive existing -> EEXIST
```

## Errors carry a code

```js
// errors.mjs
import { readFile, writeFile } from 'node:fs/promises';
try { await readFile('sandbox/nope.txt'); } catch (err) { console.log(err.code, '|', err.message); }
try { await writeFile('sandbox/b.txt/x', 'y'); } catch (err) { console.log(err.code); }
```

```console
$ node errors.mjs
ENOENT | ENOENT: no such file or directory, open 'sandbox/nope.txt'
ENOTDIR
```

**Branch on `err.code`, never on `err.message`** — messages are not a stable API
and are not localised consistently. The codes you will actually handle:

| Code | Means | Usual response |
|---|---|---|
| `ENOENT` | No such file or directory | 404, or create it |
| `EEXIST` | Already exists | 409, or ignore |
| `EACCES` / `EPERM` | Permission denied | 500 + alert; it is a deployment bug |
| `EISDIR` / `ENOTDIR` | Wrong type | 400 — usually bad user input |
| `ENOSPC` | Disk full | Page someone |
| `EMFILE` | Too many open files | You are leaking handles ([page 09](09-file-handles.md)) |
| `EXDEV` | Cross-device link | `rename` across filesystems; copy + delete instead |

```js
// the shape worth copying
async function readConfig(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return {};          // absent config is fine
    throw err;                                      // EACCES, EISDIR, bad JSON are not
  }
}
```

Swallowing every error to "be safe" is how a permissions problem becomes a
silent empty config in production.

## Concurrency is free, and bounded by the thread pool

```js
// concurrent.mjs
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';

let ticks = 0;
const iv = setInterval(() => ticks++, 1);
await new Promise((r) => setTimeout(r, 30));

let t = Date.now(); ticks = 0;
for (let i = 0; i < 200; i++) readFileSync('yarn.lock');
console.log(`200 sync reads : ${Date.now() - t} ms, timer ticked ${ticks} times`);

t = Date.now(); ticks = 0;
await Promise.all(Array.from({ length: 200 }, () => readFile('yarn.lock')));
console.log(`200 async reads: ${Date.now() - t} ms, timer ticked ${ticks} times`);
clearInterval(iv);
```

```console
$ node concurrent.mjs
200 sync reads : 86 ms, timer ticked 0 times
200 async reads: 45 ms, timer ticked 23 times
```

Two results, both worth internalising. The async version is **faster** —
`fs` work runs on the four libuv thread pool threads
([Phase 0](../phase-0-runtime-model/04-libuv-thread-pool.md)), so reads overlap.
And the sync version let the event loop tick **zero** times in 86 ms: nothing
else in the process ran at all.

`Promise.all` over an unbounded list of files still hits `EMFILE`. Bound it —
[Phase 2, concurrency control](../phase-2-async/14-concurrency-control.md).

## Read the whole file, or stream it?

`readFile` buffers. That is correct for config, templates and small uploads; it
is wrong for anything user-sized. The rule from
[Phase 3](../phase-3-buffers-streams/07-why-streams.md): if the size is bounded
and small, buffer; if a user controls it, stream and cap it.

```js
await readFile('config.json', 'utf8');                    // ✅ bounded, small
await readFile(userUpload);                                // ❌ peak RSS = file size × concurrency
await pipeline(createReadStream(userUpload), sink);        // ✅
```

## What is NOT in fs/promises

`existsSync` and `watch`'s callback form live on `node:fs`, not the promises
export. Mixing imports from both modules is normal:

```js
import { readFile } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
```

`fs.promises` (the property on the sync module) is the same object as the
`node:fs/promises` module — use the explicit import.

## Gotchas

**Symptom:** A file's previous contents vanished
**Cause:** `writeFile` truncates by default.
**Fix:** `appendFile`, or `{ flag: 'a' }`. Use `{ flag: 'wx' }` when the file must
not already exist — it throws `EEXIST` instead of overwriting.

**Symptom:** `readFile` returns `<Buffer 7b 22 …>` instead of a string
**Cause:** No encoding argument.
**Fix:** `readFile(path, 'utf8')`.

**Symptom:** `EMFILE: too many open files` under load
**Cause:** Unbounded concurrent file operations, or leaked handles.
**Fix:** Bound concurrency; close every `open`.

**Symptom:** `EXDEV: cross-device link not permitted` on `rename`
**Cause:** Source and destination are on different filesystems — very common in
containers, where `/tmp` is often a separate mount from the app volume.
**Fix:** Copy then delete, or create the temp file in the *same* directory as the
destination.

**Symptom:** A missing optional file crashes the server at boot
**Cause:** No `ENOENT` branch.
**Fix:** Catch `ENOENT` specifically, rethrow everything else.

**Symptom:** Errors are handled by matching on message text and stop working
after an upgrade
**Cause:** Messages are not API.
**Fix:** `err.code`.

**Symptom:** `rm` throws on a path that is already gone
**Cause:** No `force: true`.
**Fix:** `rm(path, { recursive: true, force: true })` for idempotent cleanup.

## Interview questions

**★ Why prefer `fs/promises` over the callback API?**
Ordinary `async`/`await` control flow, `try`/`catch` errors, and composition with
`Promise.all` — without callback nesting. Same thread pool underneath, so there is
no performance cost.

**★ Why were 200 concurrent async reads faster than 200 sync reads?**
`fs` operations run on the libuv thread pool (4 threads by default), so async
reads overlap: 45 ms versus 86 ms. The sync loop also blocked the event loop
completely — a 1 ms timer ticked zero times in those 86 ms.

**★ How do you handle "file may not exist" correctly?**
Attempt the operation and catch `err.code === 'ENOENT'`. Do not check existence
first — that is a TOCTOU race ([page 08](08-stat-and-existence.md)) — and do not
swallow other codes, because `EACCES` means something is genuinely broken.

**★ What does `rename` guarantee?**
It is atomic within a single filesystem: readers see either the old file or the
new one, never a partial write. Across filesystems it fails with `EXDEV`, which
is why atomic-write helpers put the temp file in the destination's own directory
([page 10](10-atomic-writes-and-temp-files.md)).

**What does `writeFile` do to an existing file?**
Truncates it. `{ flag: 'a' }` appends, `{ flag: 'wx' }` fails with `EEXIST` if it
exists.

**When is `readFile` the wrong call?**
When the size is unbounded or user-controlled. Peak memory is file size ×
concurrency, and strings above ~512 MB throw `ERR_STRING_TOO_LONG`.

---

← Phase index: [Filesystem, paths and URLs](README.md) · Next → [The three flavors](02-the-three-flavors.md)
