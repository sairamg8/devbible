---
title: "File streams"
sidebar_label: "06 · File streams"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`createReadStream` and `createWriteStream` are the filesystem's entry points
into everything from [Phase 3](../phase-3-buffers-streams/). They live on
`node:fs`, not `node:fs/promises`, and their options are where the useful
behaviour hides.**

```js
import { createReadStream, createWriteStream } from 'node:fs';
```

## The options that matter

```js
// options.mjs
import { createReadStream, createWriteStream } from 'node:fs';
import { text } from 'node:stream/consumers';
import { pipeline } from 'node:stream/promises';
import { stat } from 'node:fs/promises';

console.log('byte range :', await text(createReadStream('data.txt', { start: 3, end: 7, encoding: 'utf8' })));

await pipeline(createReadStream('data.txt'), createWriteStream('copy.txt'));
console.log('copy size  :', (await stat('copy.txt')).size);

await pipeline(createReadStream('data.txt'), createWriteStream('copy.txt', { flags: 'a' }));
console.log('append flag:', (await stat('copy.txt')).size);
```

```console
$ node options.mjs
byte range : defgh
copy size  : 26
append flag: 52
```

| Option | Default | Use |
|---|---|---|
| `encoding` | `null` (Buffers) | `'utf8'` to get strings instead |
| `start` / `end` | whole file | **Byte ranges — inclusive at both ends** |
| `flags` | `'r'` read, `'w'` write | `'a'` to append, `'wx'` to fail if it exists |
| `highWaterMark` | 65536 | [Phase 3, page 19](../phase-3-buffers-streams/19-highwatermark-tuning.md) |
| `autoClose` | `true` | Leave `true`; `false` means you own the fd |
| `mode` | `0o666` (minus umask) | Permissions for a newly created file |
| `fd` / `fs` | — | Reuse an open descriptor, or inject a custom fs |

**`end` is inclusive.** `{ start: 3, end: 7 }` returns five bytes, not four —
which is exactly what an HTTP `Range: bytes=3-7` header means, and the reason
range requests translate directly:

```js
// range.mjs — HTTP range request, the whole implementation
const size = (await stat(file)).size;
const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
if (!match) {
  res.writeHead(200, { 'Content-Length': size, 'Accept-Ranges': 'bytes' });
  return pipeline(createReadStream(file), res);
}
const start = match[1] ? Number(match[1]) : 0;
const end = match[2] ? Number(match[2]) : size - 1;
if (start >= size || end >= size || start > end) {
  return res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
}
res.writeHead(206, {
  'Content-Range': `bytes ${start}-${end}/${size}`,
  'Content-Length': end - start + 1,
  'Accept-Ranges': 'bytes',
});
await pipeline(createReadStream(file, { start, end }), res);
```

That is video seeking, resumable downloads and PDF page loading. Without the 416
branch a malformed `Range` header reads past the file.

## Errors arrive asynchronously

```js
// error.mjs
import { createReadStream } from 'node:fs';
const s = createReadStream('nope.txt');
s.on('error', (err) => console.log('stream error fires async:', err.code));
console.log('constructor returned without throwing');
```

```console
$ node error.mjs
constructor returned without throwing
stream error fires async: ENOENT
```

**Creating the stream never throws.** The `open` happens later, so a missing
file, a permissions failure or a directory arrives as an `'error'` event. Wrap
it in `pipeline` and it becomes a normal rejection — that is the whole reason
`pipeline` exists ([Phase 3, page 10](../phase-3-buffers-streams/10-pipeline.md)).

```js
try {
  await pipeline(createReadStream(path), res);
} catch (err) {
  if (err.code === 'ENOENT') return res.writeHead(404).end();
  throw err;
}
```

## Serving a file over HTTP

The complete, correct shape:

```js
// serve.mjs
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';

async function serveFile(res, absPath, signal) {
  const info = await stat(absPath);              // 1. throws ENOENT before headers are sent
  if (!info.isFile()) throw Object.assign(new Error('not a file'), { statusCode: 404 });

  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Length': info.size,                 // 2. bytes, from stat — not string length
    'Last-Modified': info.mtime.toUTCString(),
  });

  try {
    await pipeline(createReadStream(absPath), res, { signal });   // 3. cancellable
  } catch (err) {
    if (err.code === 'ERR_STREAM_PREMATURE_CLOSE') return;        // 4. client disconnected
    throw err;
  }
}
```

Four things earn their place: `stat` first so a 404 is possible *before* headers
go out; `Content-Length` from `stat`, not from any string; a `signal` so a
disconnect tears the read down; and treating `ERR_STREAM_PREMATURE_CLOSE` as
normal rather than an error to log.

In production, `sendFile` from Express or `nginx`'s `X-Accel-Redirect` does all
of this plus ETags and conditional requests. Write it by hand once to know what
they are doing.

## Write streams truncate by default

```js
createWriteStream('out.log');                  // flags 'w' — TRUNCATES an existing file
createWriteStream('out.log', { flags: 'a' });  // append
createWriteStream('out.log', { flags: 'wx' }); // fail with EEXIST if it exists
```

The default surprises people writing log files. And note that
**`createWriteStream` creates the file immediately** — even if you never write
to it, you have replaced the old one.

`stream.end()` resolves before the data is necessarily on physical disk; the OS
may still hold it in the page cache. For durability guarantees you need
`fileHandle.sync()` ([page 09](09-file-handles.md)), which matters for the
atomic-write pattern on [page 10](10-atomic-writes-and-temp-files.md).

## Gotchas

**Symptom:** `try`/`catch` around `createReadStream` does not catch ENOENT
**Cause:** The error is emitted asynchronously, not thrown.
**Fix:** `pipeline`, or an `'error'` listener.

**Symptom:** A range request returns one byte too few
**Cause:** `end` is inclusive; used `start + length` instead of
`start + length - 1`.
**Fix:** `Content-Length` is `end - start + 1`.

**Symptom:** A log file is empty after restart
**Cause:** `createWriteStream` with the default `'w'` flag truncated it.
**Fix:** `{ flags: 'a' }`.

**Symptom:** Headers already sent when the file turns out to be missing
**Cause:** Started streaming before checking.
**Fix:** `stat` first; only then `writeHead`.

**Symptom:** File descriptors leak on client disconnects
**Cause:** `.pipe()` instead of `pipeline`, so the read stream is never
destroyed.
**Fix:** `pipeline` with a `signal`.

**Symptom:** `Content-Length` mismatch, client hangs
**Cause:** Used `str.length` on a non-ASCII string, or the file changed between
`stat` and the read.
**Fix:** Use `stat().size`; accept that a concurrently-modified file is a real
race — write atomically ([page 10](10-atomic-writes-and-temp-files.md)).

**Symptom:** Reading a directory path "works" then errors mid-stream
**Cause:** `createReadStream` on a directory emits `EISDIR` asynchronously.
**Fix:** Check `stat().isFile()` first.

## Interview questions

**★ Why doesn't `try`/`catch` catch a missing file with `createReadStream`?**
The constructor only schedules the `open`; it does not perform it. Failures
arrive as an `'error'` event on a later tick. `pipeline` converts that into a
rejection you can catch.

**★ How do you implement HTTP range requests?**
Parse `Range: bytes=start-end`, `stat` for the size, respond 206 with
`Content-Range` and `Content-Length: end - start + 1`, and stream
`createReadStream(file, { start, end })` — remembering that `end` is inclusive.
Return 416 for out-of-range values.

**★ What order do you do things in when serving a file?**
`stat` first (so a 404 is still possible), then `writeHead` with the size from
`stat`, then `pipeline` with an abort signal, and treat
`ERR_STREAM_PREMATURE_CLOSE` as a normal client disconnect.

**★ What does `createWriteStream` do to an existing file?**
Truncates it — the default flag is `'w'`, and the file is created or emptied as
soon as the stream is created, even if nothing is written. `'a'` appends.

**Does `end()` mean the data is on disk?**
No. It means Node handed the bytes to the OS. Durability requires
`fileHandle.sync()` (fsync).

---

← Prev: [node:url](05-url.md) · Next → [Directories](07-directories.md)
