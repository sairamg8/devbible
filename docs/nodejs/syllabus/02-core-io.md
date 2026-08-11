---
title: "Part 2 — Core I/O"
sidebar_label: "2 · Core I/O"
sidebar_position: 2
---

> Phases 3–5 · Buffers, streams, filesystem, networking, processes

Node exists to do I/O well. This is that part.

---

## Phase 3 — Buffers and streams

### Binary data

| Topic | Tier |
|---|---|
| **`Buffer`** basics: creating, reading, slicing, converting to/from strings | <span className="db-tier t-master">Master</span> |
| **Encodings**: `utf8`, `base64`, `hex`, `latin1` — and choosing correctly | <span className="db-tier t-understand">Understand</span> |
| `Buffer.alloc` vs **`Buffer.allocUnsafe`** — the latter exposes uninitialized memory. A real security footgun | <span className="db-tier t-understand">Understand</span> |
| `Buffer` as a `Uint8Array` subclass — where TypedArray methods apply | <span className="db-tier t-understand">Understand</span> |
| `string_decoder` — why naive `chunk.toString()` corrupts multi-byte UTF-8 across chunk boundaries | <span className="db-tier t-understand">Understand</span> |
| Reading/writing typed values, endianness, binary protocol parsing | <span className="db-tier t-when">When Needed</span> |
| Buffer pooling internals and `Buffer.poolSize` | <span className="db-tier t-when">When Needed</span> |

### Streams

| Topic | Tier |
|---|---|
| **Why streams exist** — constant memory over unbounded data | <span className="db-tier t-master">Master</span> |
| The four types: **Readable, Writable, Duplex, Transform** | <span className="db-tier t-master">Master</span> |
| **Backpressure** — what `.write()` returning `false` means, and why ignoring it exhausts memory. *The* streaming concept | <span className="db-tier t-master">Master</span> |
| **`stream.pipeline()`** over `.pipe()` — correct error propagation and cleanup | <span className="db-tier t-master">Master</span> |
| Consuming streams with **`for await...of`** | <span className="db-tier t-master">Master</span> |
| Stream events: `data`, `end`, `error`, `close`, `finish`, `drain` | <span className="db-tier t-understand">Understand</span> |
| Flowing vs. paused mode | <span className="db-tier t-understand">Understand</span> |
| Building a custom **Transform** stream | <span className="db-tier t-understand">Understand</span> |
| Object mode | <span className="db-tier t-understand">Understand</span> |
| **Web Streams API** (`ReadableStream`, `WritableStream`, `TransformStream`) — the cross-platform standard, plus Node-stream interop | <span className="db-tier t-understand">Understand</span> |
| `zlib` — gzip and brotli as streams | <span className="db-tier t-know">Know</span> |
| Building custom Readable and Writable streams from scratch | <span className="db-tier t-know">Know</span> |
| `stream/promises`, `stream.compose()`, Iterable Streams API | <span className="db-tier t-know">Know</span> |
| Highwater marks and buffer tuning | <span className="db-tier t-when">When Needed</span> |

**Gate — deliverable:** stream-process a file larger than available RAM — read,
transform, compress, write — with backpressure respected end to end and errors
propagating correctly.

---

## Phase 4 — Filesystem, paths, and URLs

| Topic | Tier |
|---|---|
| **`node:fs/promises`** — your default. Read, write, append, delete, rename | <span className="db-tier t-master">Master</span> |
| The three flavors (callback / sync / promises) and when sync is acceptable (startup only) | <span className="db-tier t-understand">Understand</span> |
| **`node:path`**: `join` vs `resolve`, `basename`, `extname`, `parse` | <span className="db-tier t-master">Master</span> |
| **Path traversal as a security bug** — validating user-supplied paths with `resolve` + prefix check | <span className="db-tier t-master">Master</span> |
| **`node:url`**: WHATWG `URL`, `URLSearchParams`, `fileURLToPath` | <span className="db-tier t-understand">Understand</span> |
| Streaming files: `createReadStream` / `createWriteStream` | <span className="db-tier t-understand">Understand</span> |
| Directories: `readdir` with `withFileTypes`, `mkdir` recursive, `rm` recursive | <span className="db-tier t-understand">Understand</span> |
| `stat` / `lstat`, checking existence correctly (and why `fs.exists` is deprecated) | <span className="db-tier t-understand">Understand</span> |
| File handles (`fs.open`) and why you must close them | <span className="db-tier t-understand">Understand</span> |
| POSIX vs Windows path semantics; `path.posix` / `path.win32` | <span className="db-tier t-understand">Understand</span> |
| Atomic writes: write-to-temp-then-rename | <span className="db-tier t-understand">Understand</span> |
| **Large payloads and temp files** — stream an upload straight to a disk or object-store sink, enforce a size limit mid-stream, and clean up the temp file on every exit path including the failed one | <span className="db-tier t-understand">Understand</span> |
| `node:os` — platform, CPUs, memory, `homedir`, `tmpdir` | <span className="db-tier t-know">Know</span> |
| **Watching**: `fs.watch` vs `fs.watchFile`, platform inconsistencies, why everyone reaches for `chokidar` | <span className="db-tier t-know">Know</span> |
| Permissions, ownership, symlinks, `realpath` | <span className="db-tier t-know">Know</span> |
| Virtual File System | <span className="db-tier t-when">When Needed</span> |

---

## Phase 5 — Networking, HTTP, and processes

### HTTP and networking

| Topic | Tier |
|---|---|
| **`node:http`**: creating a server, the request and response objects, headers, status codes | <span className="db-tier t-master">Master</span> |
| **Request bodies are streams, not strings** — collecting and size-limiting them | <span className="db-tier t-master">Master</span> |
| **`fetch`** (undici, global and stable): `Request`/`Response`/`Headers`, JSON, `FormData` | <span className="db-tier t-master">Master</span> |
| Request timeouts via `AbortSignal.timeout()` — and why a fetch with no timeout is a production incident | <span className="db-tier t-master">Master</span> |
| HTTP fundamentals in practice: methods, status codes, headers, content negotiation, CORS | <span className="db-tier t-understand">Understand</span> |
| Cookies: parsing, setting, `HttpOnly` / `Secure` / `SameSite` | <span className="db-tier t-understand">Understand</span> |
| Keep-alive and `Agent` connection pooling — a common silent bottleneck | <span className="db-tier t-understand">Understand</span> |
| **Outbound client discipline** — one shared dispatcher, retries and idempotency keys on the *calling* side, honouring `Retry-After`. Every platform calls payment, email and SMS APIs; none of them are always up | <span className="db-tier t-understand">Understand</span> |
| **`node:https`** and TLS/SSL: certificates, chains, SNI | <span className="db-tier t-understand">Understand</span> |
| Streaming responses, chunked transfer, Server-Sent Events | <span className="db-tier t-understand">Understand</span> |
| **WebSockets** — the protocol · the built-in global `WebSocket` **client** (unflagged in v22, no longer experimental in v22.4) · `ws` for the **server** side, which Node has no built-in answer for · choosing between WS and SSE | <span className="db-tier t-know">Know</span> |
| `node:net` (TCP) and `node:dgram` (UDP) | <span className="db-tier t-know">Know</span> |
| `node:dns` — and why `lookup` hits the thread pool while `resolve` does not | <span className="db-tier t-know">Know</span> |
| **`node:http2`**: multiplexing, and when it matters behind Nginx | <span className="db-tier t-know">Know</span> |
| mTLS / client certificates | <span className="db-tier t-when">When Needed</span> |
| Writing a custom binary protocol over TCP | <span className="db-tier t-when">When Needed</span> |

### Processes

| Topic | Tier |
|---|---|
| **`process`**: `argv`, `env`, `cwd()`, `exitCode` vs `exit()`, `stdout`/`stderr` | <span className="db-tier t-master">Master</span> |
| **Signals**: `SIGTERM`, `SIGINT` — and what a container runtime actually sends | <span className="db-tier t-master">Master</span> |
| **Graceful shutdown**: stop accepting, drain in-flight requests, close pools, exit. The thing that makes deploys stop dropping requests | <span className="db-tier t-master">Master</span> |
| `process.on('uncaughtException')` / `('unhandledRejection')` — log and exit, never continue | <span className="db-tier t-understand">Understand</span> |
| **`child_process`**: `spawn` vs `exec` vs `execFile` vs `fork`; stdio piping | <span className="db-tier t-understand">Understand</span> |
| **Shell injection** via `exec` with interpolated input — and why `execFile` is the fix | <span className="db-tier t-understand">Understand</span> |
| Exit codes and what they mean to an orchestrator | <span className="db-tier t-understand">Understand</span> |
| IPC between parent and forked child | <span className="db-tier t-know">Know</span> |
| **`util.parseArgs()`** — zero-dependency CLI option parsing over `process.argv`; stable since v20. Reach for `commander` only when you need subcommands and generated help | <span className="db-tier t-know">Know</span> |

### Concurrency and scaling

| Topic | Tier |
|---|---|
| **`cluster`**: multi-core scaling, primary/worker split, when it beats more instances | <span className="db-tier t-understand">Understand</span> |
| **`worker_threads`**: real threads for CPU-bound work; worker pools | <span className="db-tier t-know">Know</span> |
| Sharing memory: `SharedArrayBuffer`, `Atomics`, `MessageChannel`, transferables | <span className="db-tier t-when">When Needed</span> |
| Sticky sessions and why stateful workers complicate scaling | <span className="db-tier t-when">When Needed</span> |
| **Single Executable Applications** — shipping Node apps as one binary | <span className="db-tier t-when">When Needed</span> |

**Gate — deliverable:** an HTTP server that survives `SIGTERM` mid-request without
dropping a single response, size-limits request bodies, times out every outbound
`fetch`, and offloads one CPU-heavy endpoint to a worker.

---

← Prev: [Part 1 — Foundations](01-foundations.md) · Next → [Part 3 — Application layer](03-application.md)
