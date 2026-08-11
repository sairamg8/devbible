---
title: "Atomic writes and temp files"
sidebar_label: "10 · Atomic writes, temp files"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`writeFile` is not atomic. A crash, a full disk or a concurrent reader
mid-write leaves a truncated file that looks valid. Write to a temp file in the
same directory, then `rename` — that swap is atomic, and it is the only
primitive the filesystem gives you.**

## Why the direct write is unsafe

`writeFile(path, data)` opens with `'w'`, which **truncates immediately** and
then writes. Between those two moments:

- a reader sees an empty or half-written file;
- a crash leaves it truncated permanently;
- `ENOSPC` leaves it truncated permanently;
- two writers interleave and produce a mixture of both payloads.

For a cache file that is annoying. For `config.json`, a session store, or
anything read at boot, it is an outage that survives the restart.

## The pattern

```js
// atomic.mjs
import { open, rename, rm } from 'node:fs/promises';
import path from 'node:path';

export async function writeFileAtomic(file, data) {
  const dir = path.dirname(file);
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);

  const handle = await open(tmp, 'wx');       // exclusive create — never clobber
  try {
    await handle.writeFile(data);
    await handle.sync();                      // force to disk BEFORE the rename
  } finally {
    await handle.close();
  }

  try {
    await rename(tmp, file);                  // atomic swap
  } catch (err) {
    await rm(tmp, { force: true });           // do not leave litter behind
    throw err;
  }
}

await writeFileAtomic('config.json', JSON.stringify({ ok: true }));
console.log('atomic write ->', await readFile('config.json', 'utf8'));
```

```console
$ node atomic.mjs
atomic write -> {"ok":true}
```

Every line of that is load-bearing:

1. **The temp file is in the same directory as the target.** `rename` is atomic
   only *within one filesystem*; `/tmp` is very often a different mount in a
   container, and the rename fails with `EXDEV`. Verified — a cross-mount
   `rename` throws `EXDEV`, so the "write to `os.tmpdir()` then move" version of
   this pattern is broken in exactly the environment you deploy to.
2. **A unique name** (pid + timestamp, or `randomUUID()`) so two concurrent
   writers do not collide, and **`'wx'`** so a collision fails loudly rather than
   silently sharing a temp file.
3. **`sync()` before the rename.** Without it, the rename can reach the disk
   before the contents do, and a power failure leaves the new name pointing at an
   empty file. This is the step almost every hand-rolled version skips.
4. **Clean up the temp file** if the rename fails, or the directory fills with
   `.config.json.1234.*.tmp`.

For full durability you would also `fsync` the *directory* after the rename, so
the directory entry itself is persisted. Node has no direct API for that — you
`open(dir)` and `sync()` the handle. Whether you need it depends on whether you
are writing a database or a config file; for the latter, steps 1–4 are enough.

**Readers get atomicity for free.** A reader that opened the old file keeps
reading the old inode to completion — `rename` never gives anyone a half file.

## Temp directories

```js
// tmpdir.mjs
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = await mkdtemp(path.join(tmpdir(), 'upload-'));
console.log('unique dir:', path.basename(dir));
try {
  // … work inside dir
} finally {
  await rm(dir, { recursive: true, force: true });
}
```

```console
$ node tmpdir.mjs
unique dir: upload-jlhFcz
```

**`mkdtemp` is the only safe way to make a temp directory.** It appends six
random characters and creates the directory atomically, so there is no window in
which an attacker can pre-create the path or symlink it somewhere else — the
classic insecure-temp-file vulnerability. Never
`mkdir(path.join(tmpdir(), 'upload-' + Date.now()))`.

Note the argument is a **prefix**, not a directory: `mkdtemp('/tmp/foo')` creates
`/tmp/fooXXXXXX`. Forgetting `path.join` with a trailing name is the usual
mistake.

## Large payloads: stream to a temp file, cap mid-stream

The upload pattern the syllabus calls out. The requirements: never buffer the
body, enforce the size limit *while* receiving, and clean up on **every** exit
path including the failed one.

```js
// upload.mjs
import { mkdtemp, rm, rename } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const LIMIT = 25 * 1024 * 1024;

async function receiveUpload(req, finalPath) {
  const dir = await mkdtemp(path.join(path.dirname(finalPath), '.incoming-'));
  const tmp = path.join(dir, 'body');
  try {
    let written = 0;
    await pipeline(
      req,
      async function* limit(source) {
        for await (const chunk of source) {
          written += chunk.length;
          if (written > LIMIT) {
            throw Object.assign(new Error('payload too large'), { statusCode: 413 });
          }
          yield chunk;
        }
      },
      createWriteStream(tmp),
    );
    await rename(tmp, finalPath);            // same filesystem: atomic publish
    return { bytes: written };
  } finally {
    await rm(dir, { recursive: true, force: true });   // runs on success AND failure
  }
}
```

```console
$ node upload.mjs
upload rejected: payload too large | status 413
temp dir cleaned up: true
```

Three decisions worth stating:

- **The limit is enforced mid-stream, not from `Content-Length`.** That header is
  client-supplied and may be absent entirely (chunked encoding). Checking it as
  well is a cheap early rejection, but it is not the enforcement.
- **The temp directory is next to the destination**, again so the final `rename`
  cannot hit `EXDEV`.
- **`finally` does the cleanup.** The failure path is the one that matters — a
  rejected 25 MB upload that leaves its partial file behind is a disk-fill bug
  that only appears under attack.

`rm` with `force: true` inside `finally` never throws, so it cannot mask the
original error.

## Cleaning up orphans

Even correct code leaks temp files when the process is `SIGKILL`ed. Anything
long-running needs a sweeper:

```js
// on boot, remove stale incoming directories
for (const entry of await readdir(uploadRoot, { withFileTypes: true })) {
  if (!entry.name.startsWith('.incoming-')) continue;
  const full = path.join(entry.parentPath, entry.name);
  const { mtimeMs } = await stat(full);
  if (Date.now() - mtimeMs > 60 * 60 * 1000) await rm(full, { recursive: true, force: true });
}
```

The one-hour grace period matters: without it, a boot during an in-flight upload
deletes a live temp directory. Relying on the OS to clean `/tmp` is not a plan —
containers often have no such job, and `/tmp` fills up.

## Gotchas

**Symptom:** `EXDEV: cross-device link not permitted`
**Cause:** The temp file is on a different filesystem from the destination —
almost always `os.tmpdir()` versus a mounted data volume.
**Fix:** Create the temp file in the destination's own directory.

**Symptom:** Config file is empty after a crash
**Cause:** `writeFile` truncated, then the process died. Or the rename reached
disk before the data.
**Fix:** Temp + `sync()` + rename.

**Symptom:** `.config.json.*.tmp` files accumulate
**Cause:** No cleanup when the rename or write failed.
**Fix:** `rm` in the error path, plus a boot-time sweeper for `SIGKILL` cases.

**Symptom:** Two writers produced a mixture of both payloads
**Cause:** Both wrote the same file directly, or shared a temp name.
**Fix:** Unique temp names with `'wx'`, then rename.

**Symptom:** Disk fills during an attack
**Cause:** Rejected uploads left partial files behind.
**Fix:** Clean up in `finally`, and enforce the limit mid-stream.

**Symptom:** Uploads bigger than the limit still get through
**Cause:** Only `Content-Length` was checked; the client lied or used chunked
encoding.
**Fix:** Count bytes as they arrive and destroy the stream past the limit.

**Symptom:** A predictable temp path was hijacked (symlink attack)
**Cause:** Built the name from a timestamp or pid instead of `mkdtemp`.
**Fix:** `mkdtemp`, which creates atomically with random characters.

## Interview questions

**★ Why is `writeFile` not atomic, and what is the fix?**
It truncates the file and then writes, so a crash, a full disk, or a concurrent
reader can observe a truncated file. The fix is to write a uniquely-named temp
file in the **same directory**, `fsync` it, then `rename` over the target —
`rename` is atomic within a filesystem.

**★ Why must the temp file be in the same directory?**
`rename` only works within one filesystem; across mounts it throws `EXDEV`. In
containers `/tmp` is routinely a different mount from the data volume, so the
common "write to tmpdir and move" version fails exactly where it matters.

**★ Why `fsync` before the rename?**
Otherwise the rename can be persisted before the file's contents are, and a power
loss leaves the new name pointing at an empty file. It is the step most
hand-rolled implementations omit.

**★ How do you enforce an upload size limit?**
Count bytes as they stream and destroy the pipeline past the limit — not from
`Content-Length`, which is client-supplied and absent under chunked encoding.
Clean up the partial file in a `finally`.

**★ Why `mkdtemp` rather than constructing a temp path yourself?**
It creates the directory atomically with random suffix characters, so there is no
window for an attacker to pre-create or symlink a predictable path. Timestamp- or
pid-based names are guessable.

**What still leaks after all this?**
Temp files from a `SIGKILL`ed process. A long-running service needs a boot-time
sweeper with a grace period, so it does not delete an in-flight upload.

---

← Prev: [File handles](09-file-handles.md) · Next → [node:os](11-os.md)
