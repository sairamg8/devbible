---
title: "stat and checking existence"
sidebar_label: "08 · stat, existence"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**"Does this file exist?" is almost always the wrong question. By the time you
act on the answer it can be false — and the operation you were about to do
already tells you.**

## Just do the thing

```js
// ✅ one syscall, no race
try {
  const data = await readFile(path, 'utf8');
  return JSON.parse(data);
} catch (err) {
  if (err.code === 'ENOENT') return null;
  throw err;
}

// ❌ two syscalls, and a race between them
if (existsSync(path)) {
  return JSON.parse(await readFile(path, 'utf8'));   // may already be deleted
}
```

The second form is a **TOCTOU** race — time-of-check to time-of-use. Between the
check and the read the file can be deleted, replaced, or swapped for a symlink
pointing somewhere else. In a multi-process deployment that is not theoretical:
log rotation, another worker, or a deploy replacing the directory will do it.

`fs.exists` (the callback version) is <strong>⚠ Deprecated</strong> (DEP0018) —
partly for the race, partly because its callback signature was `(exists)` with no
error argument, breaking the error-first convention. `existsSync` is *not*
deprecated and is fine in the narrow cases below.

## When `existsSync` is fine

- **At startup**, checking whether an optional config file is present, before
  anything else can race you.
- **In a CLI**, giving a friendly "no such directory" message before doing work.
- **As a pre-flight hint**, where a false answer only costs a nicer error later.

```js
// legitimate
if (!existsSync(configPath)) {
  console.error(`Config not found at ${configPath}. Run "app init" first.`);
  process.exit(1);
}
```

What it must never be is a **security check** or a guard in a request handler.

## stat, and what it tells you

```js
// stat.mjs
import { stat } from 'node:fs/promises';
const s = await stat('sandbox/a.txt');
console.log('size', s.size, '| isFile', s.isFile(), '| mode', (s.mode & 0o777).toString(8), '| mtime is a Date:', s.mtime instanceof Date);
```

```console
$ node stat.mjs
size 11 | isFile true | mode 644 | mtime is a Date: true
```

| Field | Note |
|---|---|
| `size` | Bytes. The number for `Content-Length` |
| `isFile()` / `isDirectory()` / `isSymbolicLink()` | Type predicates |
| `mtime` / `mtimeMs` | Last modification. `Ms` variant avoids Date allocation |
| `atime`, `ctime`, `birthtime` | Access, inode change, creation (unreliable on Linux) |
| `mode` | Permission bits — mask with `0o777` |
| `uid` / `gid` | Owner |
| `ino` / `dev` | Inode and device — how you tell two paths are the same file |

`{ bigint: true }` returns `BigInt` fields, which you need for files above 2^53
bytes or for exact nanosecond timestamps.

## stat vs lstat vs access

```js
// three.mjs
import { stat, lstat } from 'node:fs/promises';
import { existsSync } from 'node:fs';

console.log('stat  on symlink : isFile', (await stat('st/link.txt')).isFile(), 'isSymbolicLink', (await stat('st/link.txt')).isSymbolicLink());
console.log('lstat on symlink : isFile', (await lstat('st/link.txt')).isFile(), 'isSymbolicLink', (await lstat('st/link.txt')).isSymbolicLink());
console.log('stat on broken symlink  ->', await stat('st/broken.txt').then(() => 'ok').catch((e) => e.code));
console.log('lstat on broken symlink ->', (await lstat('st/broken.txt')).isSymbolicLink());
console.log('existsSync on broken symlink:', existsSync('st/broken.txt'));
```

```console
$ node three.mjs
stat  on symlink : isFile true isSymbolicLink false
lstat on symlink : isFile false isSymbolicLink true
stat on broken symlink  -> ENOENT
lstat on broken symlink -> true
existsSync on broken symlink: false
```

- **`stat` follows symlinks** and reports the target. A symlink to a file is
  `isFile() === true` and `isSymbolicLink() === false` — so **`stat` can never
  tell you something is a symlink.**
- **`lstat` does not follow**, so it is the one that identifies links, and the
  only one that works on a broken link.
- **A broken symlink makes `stat` throw `ENOENT` and `existsSync` return
  `false`** even though the link itself is right there. That is the correct
  answer to "can I read this", and the wrong answer to "is there something at
  this path" — which is exactly why deletion code should use `lstat`.

`access(path, mode)` asks the OS a permission question:

```js
import { access, constants } from 'node:fs/promises';
await access(p, constants.R_OK);                    // readable?
await access(p, constants.W_OK | constants.X_OK);   // writable and executable?
```

It resolves or rejects with `EACCES`/`ENOENT`. **It is still TOCTOU** — the
Node docs say plainly not to use `access` before `open`/`read`/`write`. Its one
good use is a startup self-check: "is my data directory writable", reported
clearly at boot instead of as a mystery failure under load.

## Identity: are these the same file?

```js
const [a, b] = await Promise.all([stat(p1), stat(p2)]);
const sameFile = a.ino === b.ino && a.dev === b.dev;
```

Comparing paths cannot answer this — hard links, symlinks, bind mounts and
case-insensitive filesystems all produce different strings for one file.
`ino` + `dev` is the real identity. (On Windows, `ino` is unreliable; compare
resolved paths there.)

## Cheap freshness checks

`mtimeMs` is how you avoid work:

```js
// cache.mjs — rebuild only when the source changed
const cache = new Map();
async function loadTemplate(file) {
  const { mtimeMs, size } = await stat(file);
  const hit = cache.get(file);
  if (hit && hit.mtimeMs === mtimeMs && hit.size === size) return hit.value;
  const value = compile(await readFile(file, 'utf8'));
  cache.set(file, { mtimeMs, size, value });
  return value;
}
```

Including `size` matters: `mtime` has coarse resolution on some filesystems, so
two writes within the same tick can share a timestamp. Size plus mtime catches
almost all of those; a content hash catches the rest, at the cost of reading the
file.

## Gotchas

**Symptom:** `ENOENT` on a file that "exists"
**Cause:** Checked then acted — TOCTOU — or a broken symlink, or a different
working directory.
**Fix:** Attempt the operation and handle `ENOENT`; use absolute paths.

**Symptom:** `isSymbolicLink()` is always false
**Cause:** Used `stat`, which follows the link.
**Fix:** `lstat`.

**Symptom:** Deleting a broken symlink fails with `ENOENT` from a pre-check
**Cause:** `stat`/`existsSync` say it does not exist.
**Fix:** `lstat`, or just `rm(p, { force: true })`.

**Symptom:** Permission check passes, the write still fails
**Cause:** `access` is advisory and racy; permissions can change, and ACLs,
read-only mounts and containers are not fully captured.
**Fix:** Attempt the write and handle `EACCES`.

**Symptom:** `Content-Length` mismatch
**Cause:** The file changed between `stat` and the read.
**Fix:** `open` once and use `fileHandle.stat()` on the same descriptor
([page 09](09-file-handles.md)).

**Symptom:** A cache never invalidates
**Cause:** `mtime` resolution is coarser than the write frequency.
**Fix:** Compare size as well, or hash the content.

**Symptom:** `birthtime` is wrong or equals `mtime`
**Cause:** Many Linux filesystems do not store creation time.
**Fix:** Do not rely on it; record creation time in your own metadata.

## Interview questions

**★ Why is `fs.exists` deprecated, and is `existsSync` too?**
`fs.exists` broke the error-first callback convention (its callback took only
`exists`) and encourages a TOCTOU race. `existsSync` is **not** deprecated and is
fine for startup and CLI checks — but never as a guard before an operation, and
never as a security check.

**★ What is TOCTOU and how do you avoid it here?**
Time-of-check to time-of-use: the state can change between checking and acting.
Avoid it by performing the operation directly and handling the error — one
syscall, no window.

**★ What is the difference between `stat` and `lstat`?**
`stat` follows symlinks and describes the target, so it never reports
`isSymbolicLink() === true` and throws `ENOENT` on a broken link. `lstat`
describes the link itself.

**★ How do you tell whether two paths refer to the same file?**
Compare `ino` and `dev` from `stat`. Path comparison cannot see hard links,
symlinks, bind mounts or case-insensitive filesystems.

**When is `access()` useful?**
As a startup self-check — "is the data directory writable?" — reported clearly at
boot. Not before an operation; the Node docs explicitly advise against that.

**Why include `size` alongside `mtimeMs` in a cache key?**
`mtime` resolution can be coarser than the interval between writes, so two
different contents can share a timestamp. Size catches most of the rest.

---

← Prev: [Directories](07-directories.md) · Next → [File handles](09-file-handles.md)
