---
title: "File handles"
sidebar_label: "09 · File handles"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`open()` returns a `FileHandle` that owns an OS file descriptor. Descriptors
are a per-process limit, and one leaked handle per request takes the whole server
down with `EMFILE` — every subsequent file *and socket* fails at once.**

## Open, use, close

```js
// handle.mjs
import { open } from 'node:fs/promises';

const fh = await open('x.bin', 'w+');            // read AND write, create/truncate
try {
  await fh.write(Buffer.from('hello handle'));
  const buf = Buffer.alloc(5);
  const { bytesRead } = await fh.read(buf, 0, 5, 6);   // 5 bytes from offset 6
  console.log('read at offset 6:', buf.subarray(0, bytesRead).toString());
  console.log('size via handle :', (await fh.stat()).size);
} finally {
  await fh.close();                              // ← the whole point of the try/finally
}
```

```console
$ node handle.mjs
read at offset 6: handl
size via handle : 12
```

**`try`/`finally` is not optional.** Any throw between `open` and `close` — a
parse error, a validation failure, an aborted request — leaks the descriptor for
the lifetime of the process. Garbage collection does *not* reliably reclaim it;
Node emits a warning if a handle is collected unclosed, but by then you have
already leaked.

`close()` is idempotent, so a double close is harmless:

```console
$ node double-close.mjs
double close -> ok (idempotent)
```

## The flags

| Flag | Meaning |
|---|---|
| `'r'` | Read. Throws `ENOENT` if missing |
| `'r+'` | Read/write, must exist, does not truncate |
| `'w'` | Write, create or **truncate** |
| `'w+'` | Read/write, create or truncate |
| `'a'` | Append, create if missing |
| `'a+'` | Read/append |
| `'wx'` / `'ax'` | As above, but **fail with `EEXIST`** if it exists |

`'wx'` is the one worth remembering: it is an atomic create-if-absent, which is
how you implement a lock file without a race.

```js
// lockfile.mjs — exclusive create as a mutex
import { open, rm } from 'node:fs/promises';

let lock;
try {
  lock = await open('job.lock', 'wx');            // atomic: only one process wins
} catch (err) {
  if (err.code === 'EEXIST') throw new Error('another instance is already running');
  throw err;
}
try {
  await lock.writeFile(String(process.pid));
  await doWork();
} finally {
  await lock.close();
  await rm('job.lock', { force: true });
}
```

That is a real single-instance guard for a cron job — with the usual caveat that
a crashed process leaves a stale lock, so production versions also record the pid
and check whether it is alive.

## What a FileHandle can do

```js
const fh = await open(path, 'r+');
await fh.read(buffer, offset, length, position);  // positional read
await fh.write(buffer, offset, length, position); // positional write
await fh.readFile('utf8');                        // whole file, this handle
await fh.writeFile(data);                         // replace contents
await fh.appendFile(data);
await fh.stat();                                  // stat THIS descriptor
await fh.truncate(1024);
await fh.chmod(0o600);
await fh.sync();                                  // fsync — force to physical disk
await fh.datasync();                              // fdatasync — data only, not metadata
fh.createReadStream();                            // a stream over this handle
fh.createWriteStream();
fh.readableWebStream();                           // web ReadableStream
```

Two of these earn their place in normal code:

- **`fh.stat()`** stats the *descriptor*, not the path — so it cannot race with
  a rename or replacement. That closes the `Content-Length` race from
  [page 08](08-stat-and-existence.md): open once, stat the handle, stream from
  the same handle.
- **`fh.sync()`** is the only way to know bytes reached the disk rather than the
  OS page cache. It is what makes the atomic-write pattern on
  [page 10](10-atomic-writes-and-temp-files.md) actually durable, and it is
  expensive — do not call it per write in a hot loop.

## Positional I/O

`read(buffer, offset, length, position)` reads `length` bytes starting at
`position` in the *file* into `buffer` at `offset`. Passing `position: null`
reads from the current cursor and advances it.

This is how you read a fixed-size header without slurping the file:

```js
// header.mjs
const fh = await open('archive.bin');
try {
  const header = Buffer.alloc(16);
  const { bytesRead } = await fh.read(header, 0, 16, 0);
  if (bytesRead < 16) throw new Error('truncated file');
  const magic = header.readUInt32BE(0);
  const entries = header.readUInt32BE(4);
  // … then read only the sections you need
} finally {
  await fh.close();
}
```

Combined with [Phase 3, page 06](../phase-3-buffers-streams/06-binary-data-and-endianness.md),
that is the whole basis of reading structured binary files without loading them.

## The descriptor budget

```console
$ ulimit -n
524288          # this machine (systemd default). Docker's default is 1048576;
                # older distros and many CI images still ship 1024.
```

**Check it rather than assuming** — the limit varies by two or three orders of
magnitude between environments, which is precisely why a leak that is invisible
on a developer laptop kills a container.

Every open file, socket, pipe and TLS connection consumes one. A server holding
500 keep-alive connections has 500 gone before your code opens anything. That is
why `EMFILE` shows up under load and never in development:

- **One leaked handle per request** → dead in minutes at any real traffic.
- **Unbounded `Promise.all` over files** → transient `EMFILE` spikes even with
  no leak ([Phase 2](../phase-2-async/14-concurrency-control.md)).

Raising `ulimit -n` postpones the failure; it does not fix a leak. To find one:
`ls -l /proc/<pid>/fd | wc -l` on Linux, or `lsof -p <pid>`, sampled over time —
a number that only grows is a leak.

## When not to use a handle at all

```js
await readFile(path, 'utf8');                       // opens, reads, closes — no leak possible
await pipeline(createReadStream(path), sink);       // autoClose: true by default
```

**The convenience functions cannot leak.** Reach for `open` only when you need
several operations on the same descriptor, positional I/O, `sync()`, or the
exclusive-create flags. Otherwise `readFile`/`writeFile`/`createReadStream` are
both simpler and safer.

## Gotchas

**Symptom:** `EMFILE: too many open files` after hours of traffic
**Cause:** Handles opened without `try`/`finally`, or unbounded concurrency.
**Fix:** Always close in `finally`; bound concurrency. Confirm by watching the fd
count.

**Symptom:** A file is locked / cannot be deleted on Windows
**Cause:** An open handle. POSIX allows unlinking an open file; Windows does not.
**Fix:** Close before renaming or deleting.

**Symptom:** Data is missing after a crash even though the write "succeeded"
**Cause:** It was in the page cache, not on disk.
**Fix:** `fh.sync()` before you consider it durable — and `fsync` the *directory*
too if the file is newly created.

**Symptom:** `Warning: Closing file descriptor on garbage collection`
**Cause:** A handle was collected unclosed. This is Node telling you about a leak.
**Fix:** Close explicitly.

**Symptom:** Reads return fewer bytes than requested
**Cause:** Short read at end of file, or a pipe.
**Fix:** Always use `bytesRead`, and loop if you need an exact count.

**Symptom:** Two processes both created "the" file
**Cause:** `stat`-then-`open` instead of exclusive create.
**Fix:** Open with `'wx'`, which is atomic, and handle `EEXIST`.

**Symptom:** `fh.stat().size` differs from `stat(path).size`
**Cause:** The path was replaced after opening. The handle still points at the
original inode.
**Fix:** That is the desired behaviour — prefer the handle when consistency
matters.

## Interview questions

**★ What happens if you forget to close a FileHandle?**
The descriptor leaks for the process's lifetime. Descriptors are a per-process
limit — 1024 on older images, 524288 on this machine, a million in Docker's
default — so a leak in a request path eventually exhausts them and every
subsequent open, **including new sockets**, fails with `EMFILE`. The variance is
why it never reproduces locally.

**★ Where does the close belong?**
In a `finally`. Any throw between `open` and `close` otherwise leaks, and the
throw is usually in the parsing or validation you do with the data.

**★ Why use `fh.stat()` instead of `stat(path)`?**
It stats the open descriptor, so it cannot race with a rename or replacement of
the path. That is how you get a `Content-Length` that matches the bytes you are
about to stream.

**★ What is `'wx'` for?**
Atomic create-if-absent — it fails with `EEXIST` rather than truncating. It is
how you build a lock file without a check-then-create race.

**★ Does `write()` resolving mean the data is on disk?**
No, only that the OS accepted it. `fh.sync()` (fsync) forces it to physical
storage; `datasync()` flushes data without metadata. Both are slow, so use them
at commit points, not per write.

**When should you avoid `open` entirely?**
Whenever one operation will do. `readFile`, `writeFile` and `createReadStream`
open and close for you and cannot leak.

---

← Prev: [stat and existence](08-stat-and-existence.md) · Next → [Atomic writes and temp files](10-atomic-writes-and-temp-files.md)
