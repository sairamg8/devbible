---
title: "The upload service"
sidebar_label: "03 · The upload service"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Node.js v24 docs — `stream.pipeline`,
> `fs/promises`, `crypto` — and the file-type package docs. Concept home:
> [Node — backpressure](../../../nodejs/pages/phase-3-buffers-streams/09-backpressure.md),
> [atomic writes and temp files](../../../nodejs/pages/phase-4-filesystem/10-atomic-writes-and-temp-files.md),
> [request bodies as streams](../../../nodejs/pages/phase-5-http-processes/02-request-bodies.md).

## The problem

Product photos from admins, review photos from customers — the spec's words
are "uploaded by users and cannot be trusted." The service must move bytes of
unknown size from a socket to storage in constant memory, enforce limits
*while streaming* (not after), verify the bytes are actually an image, and
leave nothing behind on any failure path. This is the app's densest use of
Node's stream material.

## The design choices

**An object-store interface with a disk implementation.** The architecture
page promised S3-shaped storage; the interface is three functions —
`put(key, stream)`, `createReadStream(key)`, `remove(key)` — and development
runs it against a directory. Swapping in S3 later changes one file, because
nothing outside this module knows bytes live on disk.

**Limits enforced mid-stream, by a Transform.** A `Content-Length` check is
advisory (clients lie, chunked encoding omits it); the real limit counts
bytes as they pass and aborts the pipeline the moment the budget is gone —
the [size-limit pattern](../../../nodejs/pages/phase-5-http-processes/02-request-bodies.md)
applied.

**Content sniffing over extensions and headers.** The claimed
`Content-Type` and the filename's `.jpg` are attacker-controlled. The first
bytes of the stream are checked against magic numbers (`file-type` reads
them); the *stored* content type comes from sniffing, never from the client.

**Keys are random; metadata lives in Postgres.** `objects/ab/cd/abcd….bin` —
a `randomUUID`-derived key, no user-supplied filename anywhere near a path
([path traversal](../../../nodejs/pages/phase-4-filesystem/04-path-traversal.md)
never gets a foothold). The original filename, if ever needed for display,
is a database column, not a filesystem fact.

## The implementation

```js
// services/uploads.js
import {createReadStream, createWriteStream} from 'node:fs';
import {mkdir, rename, rm} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileTypeStream} from 'file-type';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export class UploadError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function byteLimit(maxBytes) {
  let seen = 0;
  return new Transform({
    transform(chunk, _enc, cb) {
      seen += chunk.length;
      if (seen > maxBytes) {
        cb(new UploadError('TOO_LARGE', `exceeds ${maxBytes} bytes`));
        return;
      }
      cb(null, chunk);
    },
  });
}

export function uploadService({rootDir, maxBytes = 5 * 1024 * 1024}) {
  return {
    /** Streams `source` (e.g. a busboy file stream) to storage.
     *  Resolves {key, contentType, bytes} or rejects having cleaned up. */
    async put(source) {
      const id = randomUUID().replaceAll('-', '');
      const dir = path.join(rootDir, id.slice(0, 2), id.slice(2, 4));
      const finalPath = path.join(dir, `${id}.bin`);
      const tempPath = `${finalPath}.tmp`;
      await mkdir(dir, {recursive: true});

      const limited = byteLimit(maxBytes);
      const sniffed = await fileTypeStream(source.pipe(limited));
      if (!sniffed.fileType || !ALLOWED.has(sniffed.fileType.mime)) {
        sniffed.destroy();
        throw new UploadError('BAD_TYPE', 'not an allowed image type');
      }

      try {
        let bytes = 0;
        await pipeline(
          sniffed,
          new Transform({transform(c, _e, cb) { bytes += c.length; cb(null, c); }}),
          createWriteStream(tempPath, {flags: 'wx'}),
        );
        await rename(tempPath, finalPath);          // atomic publish (concept page)
        return {key: `${id.slice(0, 2)}/${id.slice(2, 4)}/${id}.bin`,
                contentType: sniffed.fileType.mime, bytes};
      } catch (err) {
        await rm(tempPath, {force: true});          // every failure path cleans up
        throw err;
      }
    },

    async remove(key) {
      await rm(path.join(rootDir, key), {force: true});
    },

    /** Read side for serving (Phase 3's GET route). The key is server-minted,
     *  but normalize-and-check anyway — defence in depth costs two lines. */
    createReadStream(key) {
      const p = path.resolve(rootDir, key);
      if (!p.startsWith(path.resolve(rootDir) + path.sep)) {
        throw new UploadError('BAD_KEY', 'key escapes the store');
      }
      return createReadStream(p);
    },

    /** Removes .tmp orphans older than maxAgeMs; returns how many.
     *  Called by the scheduled sweep job (chapter 05). */
    async sweepTmp(maxAgeMs) {
      const {readdir, stat} = await import('node:fs/promises');
      let removed = 0;
      for (const entry of await readdir(rootDir, {recursive: true})) {
        if (!entry.endsWith('.tmp')) continue;
        const p = path.join(rootDir, entry);
        const {mtimeMs} = await stat(p);
        if (Date.now() - mtimeMs > maxAgeMs) {
          await rm(p, {force: true});
          removed++;
        }
      }
      return removed;
    },
  };
}
```

## What to notice

- **`pipeline` owns the plumbing.** Backpressure, error propagation, and
  destroying every stream when any one fails — the reasons
  [`pipeline` beats `.pipe()`](../../../nodejs/pages/phase-3-buffers-streams/10-pipeline.md)
  — mean the byte-limit abort automatically destroys the socket-side stream
  too, which is what actually stops the client's bytes.
- **Sniff before writing.** `fileTypeStream` buffers only the magic-number
  prefix, decides, then replays — a `BAD_TYPE` upload is rejected having
  written *nothing*, so the cleanup path is exercised only by mid-write
  failures.
- **Temp-then-rename** is the
  [atomic-write pattern](../../../nodejs/pages/phase-4-filesystem/10-atomic-writes-and-temp-files.md):
  a crash leaves a `.tmp` orphan, never a half-written object at a live key.
  The scheduled-jobs chapter (05) sweeps orphaned `.tmp` files older than a
  day — the boot-time sweeper of the concept page, adapted to a job.
- **`flags: 'wx'`** — exclusive create. A key collision (astronomically
  unlikely, but free to defend) fails loudly instead of silently
  overwriting.
- **The 5 MB default** is per-image and deliberately server-side; the
  client-side resize (the React upload chapter) is UX, not security — the
  limit here assumes it didn't happen.

## Using it in the app

Phase 3's upload endpoints feed busboy file streams straight in — request
bytes never buffer in memory and never touch a temp dir under the web root.
`product_images.object_key` / `review_images.object_key` store the returned
key; images are *served* by the API streaming `createReadStream(key)` with
the stored content type — or, later, by Nginx/S3 directly, which the
key-plus-metadata split already permits.

## Gotchas

- **Symptom:** memory climbs with concurrent uploads until the container is
  OOM-killed. **Cause:** somewhere the file stream was buffered whole —
  usually a middleware that reads the body before busboy gets it (a JSON
  body parser mounted globally, catching multipart). **Fix:** the multipart
  route must reach busboy *unconsumed*; Phase 3 mounts parsers per-route for
  exactly this reason.
- **Symptom:** uploads succeed but a few `.tmp` files accumulate. **Cause:**
  crashes between write and rename — expected. **Fix:** already designed:
  the sweep job; alert only if the count grows fast (that means a recurring
  mid-write failure, usually disk-full).
- **Symptom:** a "PNG" upload renders as broken and virus-scanning flags the
  bucket. **Cause:** trusting client `Content-Type` — the bytes were
  something else. **Fix:** the sniffing path above is the only writer;
  audit that no other code path calls `createWriteStream` under `rootDir`.
- **Symptom:** `TOO_LARGE` arrives after the client waited to send the whole
  file. **Cause:** the limit aborts the server side immediately, but a
  client that ignores the early response keeps sending until TCP notices.
  **Fix:** working as designed server-side; the React chapter's upload hook
  watches for the early error response and aborts its own send.

## Interview questions

1. **★ Why must the size limit be a stream Transform rather than a
   `Content-Length` check?** Because `Content-Length` is a client claim —
   absent under chunked encoding and freely falsifiable. Counting bytes as
   they flow is the only measurement the server actually possesses, and
   aborting the pipeline mid-flight stops the spend (memory, disk, time)
   at the budget line instead of after the body completes.
2. **★ Walk through what happens when the disk fills mid-upload.** The
   `createWriteStream` emits `ENOSPC`; `pipeline` destroys the sniffer and
   the limited stream back to the socket (client sees the connection die);
   the catch removes the `.tmp`; the endpoint maps `ENOSPC` to a 503. No
   partial object exists at a live key because the rename never ran — the
   atomic-publish property doing its job.
3. **Why random keys instead of slugified original filenames?** Filenames
   are user input: traversal sequences, collisions, encoding surprises,
   PII in names. A random key removes the entire class; the display name,
   if wanted, is data in a column where it can't address the filesystem.
4. **What changes when this moves from disk to S3?** The implementation
   behind the same three-function interface: `put` becomes a multipart
   upload (the SDK consumes the same stream), `rename`-atomicity is
   replaced by S3's put-is-atomic semantics, and the `.tmp` sweep becomes
   an incomplete-multipart lifecycle rule. Callers change zero lines —
   which is the measure of whether the interface was right.

---

← Prev: [The data layer over raw pg](02-the-data-layer.md) ·
Next → [The outbox relay and email worker](04-outbox-relay-and-email.md)
