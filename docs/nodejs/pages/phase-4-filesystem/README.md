---
title: "Phase 4 — Filesystem, paths, and URLs"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target runtime: Node 24 — the Active LTS as of August 2026.**
> Every example on these pages was executed on **Node 24.19.0**, including every
> error code and permission mode.

**Complete — all 14 pages written.**

Where the bytes from [Phase 3](../phase-3-buffers-streams/README.md) come from and go. The
API surface is small; the difficulty is entirely in the failure modes — races,
traversal, partial writes, leaked descriptors — and every one of them is a
production incident rather than a compile error.

## The API

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[node:fs/promises](01-fs-promises.md)** | <span className="db-tier t-master">Master</span> | The default API, and the seven `err.code`s you actually branch on |
| 02 | **[The three flavors](02-the-three-flavors.md)** | <span className="db-tier t-understand">Understand</span> | 200 sync reads let a 1 ms timer tick zero times |
| 03 | **[node:path](03-path.md)** | <span className="db-tier t-master">Master</span> | `join` vs `resolve` is a security boundary, plus `path.posix` |
| 04 | **[Path traversal](04-path-traversal.md)** | <span className="db-tier t-master">Master</span> | Resolve, check with the separator, then `realpath` |
| 05 | **[node:url](05-url.md)** | <span className="db-tier t-understand">Understand</span> | WHATWG `URL`, `searchParams`, and the deprecated parser that caused SSRF bypasses |
| 06 | **[File streams](06-file-streams.md)** | <span className="db-tier t-understand">Understand</span> | Byte ranges, async errors, and HTTP range requests in 15 lines |

## Inspecting and writing safely

| # | Page | Tier | In one line |
|---|---|---|---|
| 07 | **[Directories](07-directories.md)** | <span className="db-tier t-understand">Understand</span> | `withFileTypes` saves a stat per entry; ordering is never guaranteed |
| 08 | **[stat and existence](08-stat-and-existence.md)** | <span className="db-tier t-understand">Understand</span> | "Does it exist?" is the wrong question — TOCTOU, `stat` vs `lstat` |
| 09 | **[File handles](09-file-handles.md)** | <span className="db-tier t-understand">Understand</span> | `try`/`finally` or `EMFILE`; `'wx'` as an atomic lock |
| 10 | **[Atomic writes and temp files](10-atomic-writes-and-temp-files.md)** | <span className="db-tier t-understand">Understand</span> | Temp file **in the same directory**, `fsync`, rename — and `EXDEV` if you skip the first part |

## The rest

| # | Page | Tier | In one line |
|---|---|---|---|
| 11 | **[node:os](11-os.md)** | <span className="db-tier t-know">Know</span> | It reports the host, not your container — the worker-pool sizing bug |
| 12 | **[Watching files](12-watching.md)** | <span className="db-tier t-know">Know</span> | One save, five events, and nothing at all inside Docker on macOS |
| 13 | **[Permissions and symlinks](13-permissions-and-symlinks.md)** | <span className="db-tier t-know">Know</span> | umask subtracts, `mode` needs masking, `realpath` sees through links |
| 14 | **[Virtual filesystems](14-virtual-filesystems.md)** | <span className="db-tier t-when">When Needed</span> | What mocking the filesystem hides, and SEA assets |

## Coverage — all 16 syllabus rows

16 rows map to 14 pages, with two merges:

| Merged row | Landed on |
|---|---|
| POSIX vs Windows path semantics; `path.posix` / `path.win32` | 03, with the rest of `node:path` |
| Large payloads and temp files | 10, with atomic writes — both are the temp-file-then-rename pattern |

## Phase gate

You have this phase when you can write a file upload endpoint that is correct on
all four axes at once:

```js
// every line here is a page in this phase
const dir = await mkdtemp(path.join(path.dirname(finalPath), '.incoming-'));  // 10
try {
  let written = 0;
  await pipeline(req, limitTo(25e6, () => written), createWriteStream(tmp));   // 06, 10
  const safe = await resolveUserPath(req.body.destination);                    // 04
  await rename(tmp, safe);                                                     // 10 — same fs, atomic
} finally {
  await rm(dir, { recursive: true, force: true });                             // 07, 10
}
```

The four things it gets right, each of which is a real incident when missed:
the limit is enforced **mid-stream** rather than from `Content-Length`; the
destination is **resolved and realpath-checked**, not joined; the publish is a
**rename within one filesystem**, so no reader sees a partial file and `EXDEV`
cannot happen; and cleanup runs in **`finally`**, so a rejected upload leaves
nothing behind.

## Where this connects

- **Phase 3 — streams** supplies `pipeline`, backpressure and the size-limit
  transform. Pages 06 and 10 are those applied to files.
- **Phase 5 — HTTP** is where request bodies arrive and where range requests,
  uploads and `sendFile` live.
- **Phase 8 — security** goes deeper on traversal, SSRF, and the upload
  threat model sketched on page 04.
- **Phase 11 — deployment** is where `os` misreporting the container, the
  non-root uid and the read-only root filesystem stop being hypothetical.

---

← Phase 3: [Buffers and streams](../phase-3-buffers-streams/README.md) · Start → [node:fs/promises](01-fs-promises.md)
