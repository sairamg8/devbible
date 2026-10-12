---
title: "Link map · Node.js · Part 2 (phases 3–5)"
sidebar_label: "02 · Node.js · Core I/O (3–5)"
sidebar_position: 2
---

# Link map · Node.js · Part 2 — Core I/O (phases 3–5)

Covers every topic row of `docs/nodejs/syllabus/02-core-io.md`: phase 3 (Buffers and streams, T03-01 to T03-21), phase 4 (Filesystem, paths, URLs, T04-01 to T04-16) and phase 5 (Networking, HTTP, processes, T05-01 to T05-30). **All 67 rows have a page of ours (✅).**
*read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one.

🔴 **Version note.** nodejs.org/api served **v26.11.1** on 2026-10-12. Anchors on API pages were checked as heading ids in the HTML. API pages are references, not tutorials: look up, do not read through. `Buffer.poolSize` now defaults to 65536 (raised from 8192 in v26.3.0, *read*), so a page that says 8 KiB is stale.

---

## Phase 3 — Buffers and streams

### T03-01 · `Buffer` basics — Master · ✅ written `docs/nodejs/pages/phase-3-buffers-streams/01-buffer-basics.md`
- **Read this:** [Buffer](https://nodejs.org/api/buffer.html) · nodejs.org · the class reference (≈28k words): a fixed-length sequence of bytes, a `Uint8Array` subclass; `from`/`alloc`, `toString`, `subarray` and `slice` are all indexed (*read* the opening, *headings only* for the rest) · covers our angle: **partial** — reference, no tutorial ordering · fetched 2026-10-12
- **Our delta:** the learning order (create, read, slice, convert) and the slice-shares-memory warning; the reference does not teach in that order.

### T03-02 · Encodings — Understand · ✅ written `…/02-encodings.md`
- **Read this:** [Buffers and character encodings](https://nodejs.org/api/buffer.html#buffers-and-character-encodings) · nodejs.org · UTF-8 is the default when none is given; `base64url` added v15.7.0; `latin1` alias of `binary` (*read*: the history table, the `utf8` entry, the `latin1` example) · covers our angle: **partial** — lists encodings; "choosing correctly" is our job · fetched 2026-10-12
- **Our delta:** the choice guidance (when hex or base64, why latin1 is a trap for text).

### T03-03 · `Buffer.alloc` vs `Buffer.allocUnsafe` — Understand · ✅ written `…/03-alloc-vs-allocunsafe.md`
- **Read this:** [What makes allocUnsafe "unsafe"?](https://nodejs.org/api/buffer.html#what-makes-bufferallocunsafe-and-bufferallocunsafeslow-unsafe) · nodejs.org · the doc's own example comment says the returned buffer "might contain old data"; `--zero-fill-buffers` forces zeroing at a measured performance cost (*read* both passages; the dedicated section itself *headings only*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** the leak scenario (reusing a pooled slice in a response) written concretely.

### T03-04 · `Buffer` as a `Uint8Array` subclass — Understand · ✅ written `…/04-buffer-as-uint8array.md`
- **Read this:** [Buffers and TypedArrays](https://nodejs.org/api/buffer.html#buffers-and-typedarrays) · nodejs.org · since v3.0.0 `Buffer` inherits `Uint8Array`, all TypedArray methods apply, with subtle incompatibilities, the first being `slice` (*read*) · covers our angle: full · fetched 2026-10-12

### T03-05 · `string_decoder` — Understand · ✅ written `…/05-string-decoder.md`
- **Read this:** [String decoder](https://nodejs.org/api/string_decoder.html) · nodejs.org · short page (≈900 words): preserves multi-byte UTF-8/UTF-16 characters; incomplete bytes are held until the next `write()` or `end()`; the example writes a Euro sign over three calls (*read*) · covers our angle: full · fetched 2026-10-12

### T03-06 · Typed values, endianness, binary parsing — When Needed · ✅ written `…/06-binary-data-and-endianness.md`
- **Read this:** [buf.readUInt32BE()](https://nodejs.org/api/buffer.html#bufreaduint32beoffset) · nodejs.org · the BE/LE read and write family with offset rules; out-of-range offsets throw `ERR_OUT_OF_RANGE` (*read*) · covers our angle: **partial** — no protocol-parsing walkthrough · fetched 2026-10-12
- **Also good:** [Endianness](https://developer.mozilla.org/en-US/docs/Glossary/Endianness) · MDN · big-endian is also called "network byte order" (*read*) · fetched 2026-10-12

### T03-07 · Buffer pooling and `Buffer.poolSize` — When Needed · ✅ written `…/03-alloc-vs-allocunsafe.md`
- **Read this:** [Buffer.poolSize](https://nodejs.org/api/buffer.html#bufferpoolsize) · nodejs.org · size in bytes of pre-allocated pooled Buffers; default 65536, raised from 8192 in v26.3.0; may be modified (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** 🔴 the default is version-dependent (8192 before v26.3.0). Do not state one number without a version.

### T03-08 · Why streams exist — Master · ✅ written `…/07-why-streams.md`
- **Read this:** [How To Use Streams](https://nodejs.org/learn/modules/how-to-use-streams) · nodejs.org Learn · opens on large data causing performance bottlenecks and memory exhaustion (*read* the intro); sections on types, `pipeline`, async iterators, object mode, Web Streams interop (*headings only*, ≈6.5k words) · covers our angle: full · fetched 2026-10-12

### T03-09 · The four types — Master · ✅ written `…/08-stream-types.md`
- **Read this:** [Types of streams](https://nodejs.org/api/stream.html#types-of-streams) · nodejs.org · "four fundamental stream types": Writable, Readable, Duplex, Transform, each with examples (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [How To Use Streams](https://nodejs.org/learn/modules/how-to-use-streams) · nodejs.org Learn · Transform described as duplex with output computed from input (*read*) · fetched 2026-10-12

### T03-10 · Backpressure — Master · ✅ written `…/09-backpressure.md`
- **Read this:** [Backpressuring in Streams](https://nodejs.org/learn/modules/backpressuring-in-streams) · nodejs.org Learn · `.write()` returns `false` past `highWaterMark`, the Readable pauses, `'drain'` resumes it; sections on GC drag and memory exhaustion (*read*, ≈5.4k words) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Streams Concepts: Backpressure](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Concepts) · MDN · the Web Streams view of the same idea, with queuing strategies (*headings only*) · fetched 2026-10-12

### T03-11 · `stream.pipeline()` over `.pipe()` — Master · ✅ written `…/10-pipeline.md`
- **Read this:** [stream.pipeline()](https://nodejs.org/api/stream.html#streampipelinesource-transforms-destination-options) · nodejs.org · the `stream/promises` example puts an async generator between source and a write stream (*read* the example); the awaited promise form is `node:stream/promises` · covers our angle: **partial** — the reference entry does not argue why `.pipe()` leaks on error · fetched 2026-10-12
- **Also good:** [How To Use Streams: pipeline](https://nodejs.org/learn/modules/how-to-use-streams) · nodejs.org Learn · its `.pipe()` error example ends with the other streams not being notified, "resulting in memory leaks", and it recommends `pipeline()` instead (*read*) · covers the `.pipe()` failure angle: full · fetched 2026-10-12
- **Our delta:** the `.pipe()` failure mode (no cleanup on error), the reason the syllabus gives; the Learn page above is the place that argues it.

### T03-12 · Consuming with `for await...of` — Master · ✅ written `…/11-for-await-of.md`
- **Read this:** [Consuming readable streams with async iterators](https://nodejs.org/api/stream.html#consuming-readable-streams-with-async-iterators) · nodejs.org · section id verified (*headings only*); the pipeline example in the same page uses `for await` over a source (*read*) · covers our angle: **partial** · fetched 2026-10-12
- **Also good:** [How To Use Streams](https://nodejs.org/learn/modules/how-to-use-streams) · nodejs.org Learn · a dedicated async-iterators section (*headings only*) · fetched 2026-10-12

### T03-13 · Stream events — Understand · ✅ written `…/12-stream-events-and-modes.md`
- **Read this:** [Writable events: drain, finish](https://nodejs.org/api/stream.html#event-drain) · nodejs.org · `'drain'` after a `write()` returned false; `'finish'` after `end()` and a full flush (*read* both) · covers our angle: **partial** — Readable `data`/`end`/`error`/`close` ids exist (`event-data`, `event-end`, `event-close-1`) but were *headings only* · fetched 2026-10-12

### T03-14 · Flowing vs paused — Understand · ✅ written `…/12-stream-events-and-modes.md`
- **Read this:** [Two reading modes](https://nodejs.org/api/stream.html#two-reading-modes) · nodejs.org · flowing and paused, separate from object mode (*read*) · covers our angle: full · fetched 2026-10-12

### T03-15 · Custom `Transform` stream — Understand · ✅ written `…/13-transform-streams/` (two pages)
- **Read this:** [How To Use Streams: Transform](https://nodejs.org/learn/modules/how-to-use-streams) · nodejs.org Learn · Transform = duplex whose output derives from input, usually between Readable and Writable (*read*); the "creating a transform stream" section is *headings only* · covers our angle: **partial** · fetched 2026-10-12
- **Also good:** [Class: stream.Transform](https://nodejs.org/api/stream.html#class-streamtransform) · nodejs.org · the reference (*headings only*) · fetched 2026-10-12

### T03-16 · Object mode — Understand · ✅ written `…/14-object-mode.md`
- **Read this:** [Object mode](https://nodejs.org/api/stream.html#object-mode) · nodejs.org · Node-created streams handle strings, Buffers, TypedArrays and DataViews only; object mode is chosen at construction and switching later is not safe; `highWaterMark` then counts objects (*read*) · covers our angle: full · fetched 2026-10-12

### T03-17 · Web Streams API and interop — Understand · ✅ written `…/15-web-streams.md`
- **Read this (1/2):** [Web Streams API](https://nodejs.org/api/webstreams.html) · nodejs.org · WHATWG Streams, "Stability: 2 - Stable", no longer experimental since v21.0.0 (*read*) · covers our angle: **partial** — interop is in the other page · fetched 2026-10-12
- **Read this (2/2):** [stream.Readable.fromWeb / toWeb](https://nodejs.org/api/stream.html#streamreadablefromwebreadablestream-options) · nodejs.org · `Readable.fromWeb`, `Readable.toWeb`, `Writable.fromWeb`, `Writable.toWeb`, `Duplex.fromWeb` exist (*read* the index; anchor id verified) · covers the interop angle: full · fetched 2026-10-12

### T03-18 · `zlib` — Know · ✅ written `…/16-zlib.md`
- **Read this:** [Zlib](https://nodejs.org/api/zlib.html) · nodejs.org · page marked "Stability: 2 - Stable"; gzip, deflate, Brotli, and Zstd; the stream example is `pipeline(source, gzip, destination, cb)` with `createGzip()`, then a promise form (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** 🔴 the syllabus says "gzip and brotli"; v26 docs also list **Zstd**, but the Zstd methods are marked "Stability: 1 - Experimental" (added v23.8.0, v22.15.0, *read*) even though the page is Stable. Say both.

### T03-19 · Custom Readable and Writable — Know · ✅ written `…/17-custom-readable-writable.md`
- **Read this:** [Backpressuring in Streams: custom streams](https://nodejs.org/learn/modules/backpressuring-in-streams#rules-to-abide-by-when-implementing-custom-streams) · nodejs.org Learn · rules for Readable and Writable implementers (*headings only* for the rules; the page's backpressure body *read*) · covers our angle: **partial** · fetched 2026-10-12
- **Also good:** [API for stream implementers](https://nodejs.org/api/stream.html) · nodejs.org · the second half of the stream page (*headings only*) · fetched 2026-10-12

### T03-20 · `stream/promises`, `compose()`, iterable helpers — Know · ✅ written `…/18-stream-promises-and-compose.md`
- **Read this (1/2):** [stream.compose()](https://nodejs.org/api/stream.html#streamcomposestreams) · nodejs.org · history says "Marking the API stable" in v26.2.0 (*read*); `readable.compose`, `readable.map/filter/forEach/toArray` are in the index, and `readable.map` shows "Stability: 1 - Experimental" (*read*) · covers compose and the Readable helpers: **partial** · fetched 2026-10-12
- **Read this (2/2):** [Iterable Streams](https://nodejs.org/api/stream_iter.html) · nodejs.org · the v26 index lists an "Iterable Streams API" page: `node:stream/iter`, "Stability: 1 - Experimental", behind `--experimental-stream-iter`, built on iterables with no base classes (*read* the opening, ≈10.7k words) · covers the syllabus's "Iterable Streams API" literally: **partial** · fetched 2026-10-12
- **Also good:** [Streams Promises API](https://nodejs.org/api/stream.html#streams-promises-api) · nodejs.org · `require('node:stream/promises')` (*read*) · fetched 2026-10-12
- **Our delta:** 🔴 "Iterable Streams API" is ambiguous: our page reads it as the Readable helpers (`map`, `filter`), but v26 also has a separate `node:stream/iter` module. The page must say which it covers and mark the module experimental and flag-gated.

### T03-21 · Highwater marks and tuning — When Needed · ✅ written `…/19-highwatermark-tuning.md`
- **Read this:** [Buffering](https://nodejs.org/api/stream.html#buffering) · nodejs.org · `highWaterMark` is bytes for normal streams, objects in object mode (*read*) · covers our angle: **partial** — tuning guidance is ours; `stream.getDefaultHighWaterMark()` exists (*headings only*) · fetched 2026-10-12

---

## Phase 4 — Filesystem, paths, and URLs

### T04-01 · `node:fs/promises` — Master · ✅ written `docs/nodejs/pages/phase-4-filesystem/01-fs-promises.md`
- **Read this:** [fs: Promise example](https://nodejs.org/api/fs.html#promise-example) · nodejs.org · promise forms return a promise fulfilled on completion; the example uses `unlink` from `node:fs/promises` (*read*); the page is ≈41k words, so look up per method (`fsPromises.rm` takes `recursive` and `force`, *read*) · covers our angle: **partial** — a reference, with no "your default" argument · fetched 2026-10-12
- **Also good:** [Writing files with Node.js](https://nodejs.org/learn/manipulating-files/writing-files-with-nodejs) · nodejs.org Learn · write, append and flags, with a promises example (*headings only*) · fetched 2026-10-12

### T04-02 · Callback, sync, promises — Understand · ✅ written `…/02-the-three-flavors.md`
- **Read this:** [fs: Synchronous example](https://nodejs.org/api/fs.html#synchronous-example) · nodejs.org · sync calls block the event loop until done; exceptions are thrown immediately (*read*); the callback form reserves the first argument for the error (*read*) · covers our angle: **partial** — "acceptable at startup only" is our rule · fetched 2026-10-12
- **Also good:** [fs: Performance Considerations](https://nodejs.org/api/fs.html#performance-considerations) · nodejs.org · `fs.readFile()` reads into memory one chunk at a time so the event loop can turn (*read* the opening) · fetched 2026-10-12

### T04-03 · `node:path` — Master · ✅ written `…/03-path.md`
- **Read this:** [path.resolve()](https://nodejs.org/api/path.html#pathresolvepaths) · nodejs.org · segments are processed right to left until an absolute path forms; `path.join()` joins with the platform separator and normalizes (*read* both entries; `basename`, `extname`, `parse` ids verified, *headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Node.js File Paths](https://nodejs.org/learn/manipulating-files/nodejs-file-paths) · nodejs.org Learn · `resolve` with a base, `normalize` of `..` and `//`; says neither checks that the path exists (*read*) · fetched 2026-10-12

### T04-04 · Path traversal as a security bug — Master · ✅ written `…/04-path-traversal.md`
- **Read this:** [Preventing Path Traversal Attacks in Node.js](https://blog.openreplay.com/prevent-path-traversal-nodejs/) · OpenReplay, 2026-04-29 · `path.normalize()` and `path.join()` are not security tools; use `path.resolve()` plus a `startsWith` check that includes `path.sep` (a base of `/uploads` would pass `/uploads-other/`); `path.relative()` for stricter checks; symlinks can still escape, so `fs.realpath()` first; best is an ID lookup (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Path Traversal](https://community.owasp.org/attacks/Path_Traversal) · OWASP Community · the attack in general terms (`../` sequences, absolute paths); advice to prefer working without user input and to use indexes instead of file names (*read*); no Node code · fetched 2026-10-12
- **Our delta:** 🔴 a single vendor blog is the only Node-specific source found. OWASP is the authority for the class. The page must carry its own tested code and the sibling-prefix and symlink cases. Note the OWASP community page (read) still suggests calling `normalize()` on user input before file I/O, which the vendor blog says is not enough alone.

### T04-05 · `node:url` — Understand · ✅ written `…/05-url.md`
- **Read this:** [url.fileURLToPath()](https://nodejs.org/api/url.html#urlfileurltopathurl-options) · nodejs.org · the file-URL to path function, with a `windows` option (v22.1.0, v20.13.0) (*read*); `URL` and `URLSearchParams` are globals since v10.0.0 (*read*, ids `class-url`, `class-urlsearchparams`) · covers our angle: full · fetched 2026-10-12

### T04-06 · `createReadStream` / `createWriteStream` — Understand · ✅ written `…/06-file-streams.md`
- **Read this:** [fs.createReadStream()](https://nodejs.org/api/fs.html#fscreatereadstreampath-options) · nodejs.org · the reference entry (*headings only*); the ReadStream class lists `'open'`, `'ready'` and `bytesRead` (*read* the index) · covers our angle: **partial** · fetched 2026-10-12
- **Also good:** [fs.createWriteStream()](https://nodejs.org/api/fs.html#fscreatewritestreampath-options) · nodejs.org · (*headings only*) · fetched 2026-10-12

### T04-07 · Directories — Understand · ✅ written `…/07-directories.md`
- **Read this:** [fsPromises.readdir()](https://nodejs.org/api/fs.html#fspromisesreaddirpath-options) · nodejs.org · `withFileTypes` (since v10.11.0) and `recursive` (since v20.1.0, v18.17.0) options (*read*) · covers our angle: **partial** — `mkdir` recursive default is false (*read* at [mkdir](https://nodejs.org/api/fs.html#fspromisesmkdirpath-options)); `rm` recursive is T04-01 · fetched 2026-10-12
- **Also good:** [Working with folders in Node.js](https://nodejs.org/learn/manipulating-files/working-with-folders-in-nodejs) · nodejs.org Learn · check, create, read, rename, remove (*read* the mkdir section) · fetched 2026-10-12

### T04-08 · `stat` / `lstat` and existence — Understand · ✅ written `…/08-stat-and-existence.md`
- **Read this:** [Node.js file stats](https://nodejs.org/learn/manipulating-files/nodejs-file-stats) · nodejs.org Learn · `isFile()`, `isDirectory()`, `isSymbolicLink()`, `size` (*read*) · covers our angle: **partial** — `lstat` and why `exists` is wrong are elsewhere · fetched 2026-10-12
- **Also good:** [fs.exists()](https://nodejs.org/api/fs.html#fsexistspath-callback) · nodejs.org · "Deprecated in: v1.0.0" (*read*) · fetched 2026-10-12
- **Our delta:** the check-then-use race; try the operation and handle `ENOENT`. Not stated in what I read.

### T04-09 · File handles — Understand · ✅ written `…/09-file-handles.md`
- **Read this:** [Class: FileHandle](https://nodejs.org/api/fs.html#class-filehandle) · nodejs.org · an unclosed handle tries to close itself and emits a process warning, but the page says not to rely on it (*read*); `filehandle.close()` waits for pending operations (*read*) · covers our angle: full · fetched 2026-10-12

### T04-10 · POSIX vs Windows paths — Understand · ✅ written `…/03-path.md`
- **Read this:** [Windows vs. POSIX](https://nodejs.org/api/path.html#windows-vs-posix) · nodejs.org · `node:path` assumes Windows-style paths when running on Windows; `path.posix` and `path.win32` expose each flavor (*read*) · covers our angle: full · fetched 2026-10-12

### T04-11 · Atomic writes — Understand · ✅ written `…/10-atomic-writes-and-temp-files.md`
- **Read this:** [write-file-atomic README](https://cdn.jsdelivr.net/npm/write-file-atomic@8.0.0/README.md) · npm package v8.0.0 (jsDelivr copy; npmjs.com and github.com return 403) · writes a temporary file, renames it over the target, unlinks the temp file on any error, queues concurrent writes to one file; `fsync` defaults to true (*read*, ≈470 words) · covers our angle: **partial** — it documents a library, not the pattern; same-filesystem rename is **not confirmed** in what I read · fetched 2026-10-12
- **Also good:** [fsPromises.rename()](https://nodejs.org/api/fs.html#fspromisesrenameoldpath-newpath) · nodejs.org · the primitive (*headings only*) · fetched 2026-10-12

### T04-12 · Large payloads and temp files — Understand · ✅ written `…/10-atomic-writes-and-temp-files.md`
- **Read this:** [busboy README](https://raw.githubusercontent.com/mscdex/busboy/master/README.md) · busboy (raw GitHub copy; github.com is 403) · `limits.fileSize` default Infinity; on hitting it the file stream gets `truncated: true` and emits `'limit'` (*read*) · covers our angle: **partial** — size limit mid-stream only; temp-file cleanup is not covered · fetched 2026-10-12
- **Also good:** [Node.js Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html) · OWASP · the "Set request size limits" section: unbounded bodies can exhaust memory or fill disk; limit with `raw-body` (*read*) · fetched 2026-10-12
- *Not opened:* a 2026 OneUptime upload guide (a search hit; its excerpt showed Busboy limits but no cleanup).
- **Our delta:** 🔴 no page found covers size limit, pipeline and temp cleanup together. The failed-exit cleanup is ours alone.

### T04-13 · `node:os` — Know · ✅ written `…/11-os.md`
- **Read this:** [OS](https://nodejs.org/api/os.html) · nodejs.org · short page (≈4.2k words): `os.tmpdir()` has no trailing slash on any platform since v2.0.0; `os.homedir()` uses `$HOME` on POSIX; `os.platform()` is fixed at compile time (*read*) · covers our angle: full · fetched 2026-10-12

### T04-14 · Watching files — Know · ✅ written `…/12-watching.md`
- **Read this:** [fs.watch() caveats](https://nodejs.org/api/fs.html#fswatchfilename-options-listener) · nodejs.org · "not 100% consistent across platforms"; on Windows no events if the watched directory is moved; uses inotify on Linux and kqueue/FSEvents on macOS; `fs.watchFile()` is stat polling, slower and less reliable (*read*) · covers our angle: **partial** — "why everyone reaches for chokidar" is in the other link · fetched 2026-10-12
- **Also good:** [chokidar README](https://raw.githubusercontent.com/paulmillr/chokidar/main/README.md) · chokidar (raw GitHub copy) · its "Why?" section says raw `fs.watch` reports many changes as `rename` and can fire twice (*read*) · fetched 2026-10-12

### T04-15 · Permissions, symlinks, `realpath` — Know · ✅ written `…/13-permissions-and-symlinks.md`
- **Read this:** [fs: File modes](https://nodejs.org/api/fs.html#file-modes) · nodejs.org · the `mode` bitmask from `fs.constants.S_I*` flags, e.g. `S_IRUSR 0o400` (*read*) · covers our angle: **partial** — `fsPromises.realpath()` resolves the actual location (*read*, [entry](https://nodejs.org/api/fs.html#fspromisesrealpathpath-options)); symlink creation `symlink(target, path[, type])` listed (*headings only*) · fetched 2026-10-12

### T04-16 · Virtual File System — When Needed · ✅ written `…/14-virtual-filesystems.md`
- **Read this:** [Virtual File System](https://nodejs.org/api/vfs.html) · nodejs.org · `node:vfs`, added v26.4.0, "Stability: 1 - Experimental"; a `node:fs`-like API for tests, fixtures and embedded assets (*read* the opening, ≈4.2k words) · covers our angle: full · fetched 2026-10-12
- **Our delta:** 🔴 experimental in v26 and absent from the v24 LTS this bible builds on. Say so.

---

## Phase 5 — Networking, HTTP, and processes

### T05-01 · `node:http` server — Master · ✅ written `docs/nodejs/pages/phase-5-http-processes/01-http-server.md`
- **Read this:** [Anatomy of an HTTP Transaction](https://nodejs.org/learn/http/anatomy-of-an-http-transaction) · nodejs.org Learn · create the server, method/URL/headers, status code, response headers, response body, an echo server (≈4.5k words; section list *read*, request-body passage *read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [http.createServer()](https://nodejs.org/api/http.html#httpcreateserveroptions-requestlistener) · nodejs.org · the option history (e.g. `httpValidation` in v26.3.0) (*read*); `'request'` fires per request, several per keep-alive connection (*read*) · fetched 2026-10-12

### T05-02 · Request bodies are streams — Master · ✅ written `…/02-request-bodies.md`
- **Read this:** [Anatomy of an HTTP Transaction: request body](https://nodejs.org/learn/http/anatomy-of-an-http-transaction#request-body) · nodejs.org Learn · the request is a ReadableStream, listen to `'data'` and `'end'`, each chunk is a Buffer (*read*) · covers our angle: **partial** — collecting is shown; size-limiting is not · fetched 2026-10-12
- **Also good:** [Node.js Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html) · OWASP · the "Set request size limits" section names `raw-body` (*read*) · [Denial of Service of HTTP server](https://nodejs.org/learn/getting-started/security-best-practices#denial-of-service-of-http-server-cwe-400) · nodejs.org Learn · Slowloris; "correctly configure the server timeouts" (*read*) · fetched 2026-10-12
- **Our delta:** counting bytes mid-stream and destroying the request past the cap.

### T05-03 · `fetch` — Master · ✅ written `…/05-fetch.md`
- **Read this:** [Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) · MDN · bodies of string, ArrayBuffer, FormData, URLSearchParams, ReadableStream; `response.ok` check; `Headers`, streaming the response body (*read*, ≈3.7k words) · covers our angle: **partial** — browser-oriented, no Node/undici detail · fetched 2026-10-12
- **Also good:** [Using the Fetch API with Undici in Node.js](https://nodejs.org/learn/getting-started/fetch) · nodejs.org Learn · GET, POST, customizing with Undici, streaming responses (*read* a GET example, *headings only* for the rest) · [Global fetch](https://nodejs.org/api/globals.html) · "No longer behind --experimental-fetch" since v18.0.0; based on undici (*read*) · fetched 2026-10-12

### T05-04 · Timeouts via `AbortSignal.timeout()` — Master · ✅ written `…/06-outbound-timeouts.md`
- **Read this:** [AbortSignal.timeout()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static) · MDN · aborts with a `TimeoutError` DOMException; combine signals with `AbortSignal.any()` (*read*) · covers our angle: **partial** — the "production incident" argument is ours; MDN's "active rather than elapsed time" remark concerns suspended browser workers and bfcache, so do not carry it over to Node · fetched 2026-10-12
- **Also good:** [Node globals: AbortSignal.timeout()](https://nodejs.org/api/globals.html#static-method-abortsignaltimeoutdelay) · nodejs.org · section id verified (*headings only*) · fetched 2026-10-12

### T05-05 · HTTP fundamentals — Understand · ✅ written `…/03-http-fundamentals.md`
- **Read this (1/2):** [An overview of HTTP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview) · MDN · HTTP is stateless but not sessionless; the list of controllable features (*read*) · covers methods, status, headers: **partial** · fetched 2026-10-12
- **Read this (2/2):** [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) · MDN · `Access-Control-Allow-Origin` opt-in; the preflight request (*read*, ≈4.8k words) · covers the CORS angle: full · fetched 2026-10-12
- **Also good:** [Content negotiation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Content_negotiation) · MDN · server-driven negotiation; 406 and 415 as fallbacks (*read*) · fetched 2026-10-12

### T05-06 · Cookies — Understand · ✅ written `…/04-cookies.md`
- **Read this:** [Using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies) · MDN · `Secure`, `HttpOnly`, and `SameSite` for cross-site requests; values visible to and changeable by the user (*read*) · covers our angle: **partial** — no server-side parse/set code for Node · fetched 2026-10-12
- **Also good:** [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#httponly-attribute) · OWASP · per-attribute sections for Secure, HttpOnly, SameSite, prefixes (*headings only*, ≈9k words) · fetched 2026-10-12

### T05-07 · Keep-alive and `Agent` pooling — Understand · ✅ written `…/07-keep-alive-and-agents.md`
- **Read this:** [Class: http.Agent](https://nodejs.org/api/http.html#class-httpagent) · nodejs.org · an Agent manages connection persistence and reuse; it keeps a queue per host and port (*read* the opening and constructor options) · covers our angle: **partial** — "silent bottleneck" is ours · fetched 2026-10-12
- **Also good:** [Connection management in HTTP/1.x](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Connection_management_in_HTTP_1.x) · MDN · short-lived vs persistent connections; `Connection` and `Keep-Alive` as hop-by-hop headers (*read*) · [undici Agent](https://raw.githubusercontent.com/nodejs/undici/main/docs/docs/api/Agent.md) · undici (raw GitHub copy) · per-origin `Pool`, "Stability: 2 - Stable", `new Agent({ connections: 10 })` (*read*) · fetched 2026-10-12

### T05-08 · Outbound client discipline — Understand · ✅ written `…/08-outbound-client-discipline.md`
- **Read this (1/2):** [Timeouts, retries, and backoff with jitter](https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter) · AWS Builder Center (redirected from the Builders' Library URL; page metadata dated 2026-06-12) · if side effects repeated are undesirable, design idempotent APIs (*read* that passage) · covers retries and backoff: full for the argument · fetched 2026-10-12
- **Read this (2/2):** [Idempotent requests](https://docs.stripe.com/api/idempotent_requests) · Stripe · an idempotency key makes a repeat safe after a connection error; keys prunable after 24 hours on API v1 (*read*) · covers the calling-side key: full · fetched 2026-10-12
- **Also good:** [Retry-After](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After) · MDN · used with 503, 429 and redirects; value is a date or seconds (*read*) · [undici RetryAgent](https://raw.githubusercontent.com/nodejs/undici/main/docs/docs/api/RetryAgent.md) · undici (raw copy) · `retryAfter` option default true; default statuses 500, 502, 503, 504, 429; default methods exclude POST (*read*) · fetched 2026-10-12
- **Our delta:** the "one shared dispatcher" rule; the undici Agent doc above supports it but does not argue it.

### T05-09 · `node:https` and TLS — Understand · ✅ written `…/09-https-and-tls.md`
- **Read this:** [TLS: ALPN and SNI](https://nodejs.org/api/tls.html#alpn-and-sni) · nodejs.org · SNI lets one TLS server serve multiple hostnames; ALPN one server for several protocols (*read*) · covers our angle: **partial** — certificate chains were not found in what I read · fetched 2026-10-12
- **Also good:** [HTTPS](https://nodejs.org/api/https.html) · nodejs.org · "Stability: 2 - Stable"; HTTP over TLS as a separate module; `https.Agent` (*read*) · fetched 2026-10-12

### T05-10 · Streaming responses, chunked, SSE — Understand · ✅ written `…/10-streaming-and-sse.md`
- **Read this:** [Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) · MDN · respond with `text/event-stream`, events end with a pair of newlines; over HTTP/1 a per-browser-and-domain limit of 6 open connections applies (*read*) · covers our angle: **partial** — client-side examples, PHP server sample · fetched 2026-10-12
- **Also good:** [Transfer-Encoding](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Transfer-Encoding) · MDN · rarely used outside `chunked` (*read*) · fetched 2026-10-12

### T05-11 · WebSockets — Know · ✅ written `…/11-websockets.md`
- **Read this (1/2):** [Global WebSocket](https://nodejs.org/api/globals.html#class-websocket) · nodejs.org · added v21.0.0, v20.10.0; "No longer experimental" since v22.4.0; unflagged since v22.0.0 (*read*) · covers the client: full · fetched 2026-10-12
- **Read this (2/2):** [ws README](https://raw.githubusercontent.com/websockets/ws/master/README.md) · ws (raw GitHub copy; github.com and npmjs.com are 403) · the server side; does not work in the browser, which must use native `WebSocket` (*read*) · covers the server angle: full · fetched 2026-10-12
- **Also good:** [Choose Between SSE and WebSockets](https://docs.railway.com/guides/sse-vs-websockets) · Railway docs, 2026-03-30 (page metadata) · comparison table: SSE server to client, auto-reconnect built in, text only; WebSockets bidirectional, binary, manual reconnect (*read*, vendor guide) · [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) · MDN · the API has no way to apply backpressure (*read*) · fetched 2026-10-12

### T05-12 · `node:net` and `node:dgram` — Know · ✅ written `…/12-net-and-dgram.md`
- **Read this (1/2):** [net: Class net.Socket](https://nodejs.org/api/net.html#class-netsocket) · nodejs.org · a TCP socket or IPC endpoint, extends `stream.Duplex` (*read*); `net.createServer` `highWaterMark` option since v20.1.0 (*read*) · covers TCP: full · fetched 2026-10-12
- **Read this (2/2):** [UDP/datagram sockets](https://nodejs.org/api/dgram.html) · nodejs.org · `dgram.createSocket(type)` and options form (*headings only*, ≈6k words) · covers UDP: **partial** · fetched 2026-10-12

### T05-13 · `node:dns` — Know · ✅ written `…/13-dns.md`
- **Read this:** [DNS: Implementation considerations](https://nodejs.org/api/dns.html#implementation-considerations) · nodejs.org · `dns.lookup()` is a synchronous `getaddrinfo(3)` on libuv's threadpool, "surprising negative performance implications"; other APIs call it internally (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [libuv thread pool](https://docs.libuv.org/en/v1.x/threadpool.html) · libuv docs · pool runs file-system ops plus `getaddrinfo`; default size 4, `UV_THREADPOOL_SIZE` up to 1024 (*read*) · fetched 2026-10-12

### T05-14 · `node:http2` — Know · ✅ written `…/14-http2.md`
- **Read this:** [HTTP/2](https://nodejs.org/api/http2.html) · nodejs.org · "Stability: 2 - Stable" since v10.10.0; core API and compatibility API sections (*read* the opening, ≈24.8k words) · covers our angle: **partial** — "when it matters behind Nginx" is not on the page · fetched 2026-10-12

### T05-15 · mTLS / client certificates — When Needed · ✅ written `…/09-https-and-tls.md`
- **Read this:** [Require client authentication](https://flaviocopes.com/courses/tls-certificates/require-client-authentication/) · flaviocopes.com (no date shown) · `requestCert: true` asks each client for a certificate, `rejectUnauthorized: true` drops failures, `ca` is the trust anchor; the handler reads `getPeerCertificate()` (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [tls.createServer options: requestCert](https://nodejs.org/api/tls.html#tlscreateserveroptions-secureconnectionlistener) · nodejs.org · `requestCert`, default false: the server requests a certificate from connecting clients and tries to verify it (*read*) · fetched 2026-10-12

### T05-16 · Custom binary protocol over TCP — When Needed · ✅ written `…/12-net-and-dgram.md`
- **Read this:** [How to Handle Binary Protocols Over TCP in Node.js](https://oneuptime.com/blog/post/2026-01-25-binary-protocols-tcp-nodejs/view) · OneUptime, 2026-01-25 · framing options (length-prefixed 4-byte header, delimiter, fixed length) and partial reads (*read*, TypeScript, ≈3k words) · covers our angle: **partial** — backpressure is named once among edge cases; a max-frame-size guard is not on the page · fetched 2026-10-12
- **Our delta:** a vendor blog is the only source found; the max-frame-size guard is ours.

### T05-17 · The `process` object — Master · ✅ written `…/15-process.md`
- **Read this:** [process.exitCode](https://nodejs.org/api/process.html#processexitcode-1) · nodejs.org · accepts an integer or an integer string since v20.0.0 (*read*); `process.argv` and `process.cwd()` entries (*read*) · covers our angle: **partial** — `exitCode` vs `exit()` contrast is ours · fetched 2026-10-12

### T05-18 · Signals — Master · ✅ written `…/16-signals.md`
- **Read this (1/2):** [process: Signal events](https://nodejs.org/api/process.html#signal-events) · nodejs.org · signal names are the event names; not available on Worker threads (*read*) · covers Node side: full · fetched 2026-10-12
- **Read this (2/2):** [docker stop](https://docs.docker.com/reference/cli/docker/container/stop/) · Docker · the main process gets SIGTERM, then SIGKILL after a grace period (*read*) · covers "what a runtime sends": full for Docker · fetched 2026-10-12
- **Also good:** [Pod lifecycle: termination](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination) · Kubernetes · TERM to each container's main process, with a grace period (*read*; page modified 2026-07-27 per metadata; anchor id verified) · fetched 2026-10-12

### T05-19 · Graceful shutdown — Master · ✅ written `…/17-graceful-shutdown.md`
- **Read this:** [Shutting Down a Node Server Gracefully](https://blog.openreplay.com/graceful-node-server-shutdown/) · OpenReplay, 2026-09-11 · fail readiness, wait for the load balancer, `server.close()`, close resources in dependency order, exit; forced-exit timer below `terminationGracePeriodSeconds`; shell-form `CMD` swallows SIGTERM (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [server.close()](https://nodejs.org/api/http.html#serverclosecallback) · nodejs.org · since v19.0.0 it also closes idle connections (*read*); `closeAllConnections()` for the rest · fetched 2026-10-12
- **Our delta:** 🔴 one vendor blog; no official Node guide found. Our page needs a tested runnable server for the gate.

### T05-20 · `uncaughtException` / `unhandledRejection` — Understand · ✅ written `…/18-crash-handlers.md`
- **Read this:** [Warning: Using 'uncaughtException' correctly](https://nodejs.org/api/process.html#warning-using-uncaughtexception-correctly) · nodejs.org · "crude mechanism" for last-resort use, not On Error Resume Next; the app is in an undefined state (*read*) · covers our angle: full for uncaught; `unhandledRejection` default `--unhandled-rejections=throw` (*read*, [entry](https://nodejs.org/api/process.html#event-unhandledrejection)) · fetched 2026-10-12

### T05-21 · `child_process` — Understand · ✅ written `…/19-child-process.md`
- **Read this:** [Child process](https://nodejs.org/api/child_process.html) · nodejs.org · `exec` spawns a shell and buffers output to a callback; `execFile` spawns directly without a shell by default; `fork` is for Node modules (*read* the overview; ≈14k words) · covers our angle: **partial** — a reference; stdio piping is *headings only* · fetched 2026-10-12

### T05-22 · Shell injection — Understand · ✅ written `…/20-shell-injection.md`
- **Read this:** [child_process.exec()](https://nodejs.org/api/child_process.html#child_processexeccommand-options-callback) · nodejs.org · "Never pass unsanitized user input" — shell metacharacters can trigger arbitrary commands (*read*) · covers our angle: **partial** — the `execFile` fix is in its own entry (id `child_processexecfilefile-args-options-callback`, *headings only*) · fetched 2026-10-12
- **Also good:** [OS Command Injection Defense Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html) · OWASP · avoid OS commands; parameterization with input validation; examples are Java, .NET, PHP, none for Node (*read* the contents) · fetched 2026-10-12
- **Our delta:** 🔴 `execFile` still allows option injection (a leading hyphen) — **not confirmed** in an official page I read; the page must test it.

### T05-23 · Exit codes — Understand · ✅ written `…/15-process.md`
- **Read this:** [process: Exit codes](https://nodejs.org/api/process.html#exit-codes) · nodejs.org · 0 when nothing is pending; 1 Uncaught Fatal Exception; 2 reserved by Bash; 3 internal parse error (*read*) · covers our angle: **partial** — what an orchestrator does with them is not on it · fetched 2026-10-12

### T05-24 · IPC parent/child — Know · ✅ written `…/21-ipc.md`
- **Read this:** [Child process: Event 'message'](https://nodejs.org/api/child_process.html#event-message) · nodejs.org · fires when a child uses `process.send()`; a parsed JSON object or primitive (*read*); `subprocess.send()` entry id verified · covers our angle: full · fetched 2026-10-12

### T05-25 · `util.parseArgs()` — Know · ✅ written `…/22-parseargs.md`
- **Read this:** [util.parseArgs()](https://nodejs.org/api/util.html#utilparseargsconfig) · nodejs.org · history shows "no longer experimental" in v20.0.0, negative options in v22.4.0 and v20.16.0; the util page is "Stability: 2 - Stable" (*read*) · covers our angle: full for the stable-since-v20 claim · fetched 2026-10-12

### T05-26 · `cluster` — Understand · ✅ written `…/23-cluster.md`
- **Read this:** [Cluster: How it works](https://nodejs.org/api/cluster.html#how-it-works) · nodejs.org · workers come from `child_process.fork()`; default distribution is round-robin by the primary except on Windows (*read*) · covers our angle: **partial** — "when it beats more instances" is ours · fetched 2026-10-12

### T05-27 · `worker_threads` — Know · ✅ written `…/24-worker-threads.md`
- **Read this:** [Worker threads](https://nodejs.org/api/worker_threads.html) · nodejs.org · "Stability: 2 - Stable"; useful for CPU-intensive JavaScript, not much for I/O (*read*) · covers our angle: **partial** — pools are not covered · fetched 2026-10-12
- **Also good:** [piscina README](https://raw.githubusercontent.com/piscinajs/piscina/current/README.md) · piscina (raw GitHub copy) · "the node.js worker pool" (*read* the opening, ≈5k words) · [Don't Block the Event Loop (or the Worker Pool)](https://nodejs.org/learn/asynchronous-work/dont-block-the-event-loop#offloading) · nodejs.org Learn · an offloading section (*headings only*) · fetched 2026-10-12

### T05-28 · Sharing memory — When Needed · ✅ written `…/25-shared-memory.md`
- **Read this:** [worker_threads page: sharing](https://nodejs.org/api/worker_threads.html) · nodejs.org · unlike `child_process` or `cluster`, threads share memory by transferring `ArrayBuffer`s or sharing `SharedArrayBuffer`s (*read*); `MessageChannel` id verified · covers our angle: **partial** · fetched 2026-10-12
- **Also good:** [Atomics](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics) · MDN · static methods for atomic operations, used with `SharedArrayBuffer` (*read*) · fetched 2026-10-12

### T05-29 · Sticky sessions — When Needed · ✅ written `…/23-cluster.md`
- **Read this:** [Using multiple nodes](https://socket.io/docs/v4/using-multiple-nodes/) · Socket.IO docs (page shows "Last updated on Oct 6, 2026") · requests of a session must reach the same process: sticky sessions, disabling long-polling, or client-side balancing (*read*) · covers our angle: **partial** — Socket.IO specific, generalizes to stateful workers · fetched 2026-10-12

### T05-30 · Single Executable Applications — When Needed · ✅ written `…/26-single-executable-applications.md`
- **Read this:** [Single executable applications](https://nodejs.org/api/single-executable-applications.html) · nodejs.org · "Stability: 1.1 - Active development"; built-in generation with `--build-sea` since v25.5.0; assets and a VFS for assets (*read* the opening; ids verified) · covers our angle: full · fetched 2026-10-12
