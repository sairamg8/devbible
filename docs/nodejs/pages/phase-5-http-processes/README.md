---
title: "Phase 5 — Networking, HTTP, and processes"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target runtime: Node 24 — the Active LTS as of August 2026.**
> Every example on these pages was executed on **Node 24.19.0**, including every
> timing, error code and byte count.

**Complete — all 26 pages written.** The largest phase in the book, and the one
that finishes **Part 2 — Core I/O**.

Where the bytes of [Phase 3](../phase-3-buffers-streams/README.md) and the files of
[Phase 4](../phase-4-filesystem/README.md) meet the network. Three subjects that share one
theme: **your process does not run alone.** It answers clients, calls services
that fail, and is stopped by an orchestrator that will not wait long.

## HTTP — serving

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[The HTTP server](01-http-server.md)** | <span className="db-tier t-master">Master</span> | Two streams and no error handling — plus the timeout that needs a second setting to work |
| 02 | **[Request bodies](02-request-bodies.md)** | <span className="db-tier t-master">Master</span> | 3 MB arrived in 49 chunks; respond 413 *then* destroy |
| 03 | **[HTTP in practice](03-http-fundamentals.md)** | <span className="db-tier t-understand">Understand</span> | Methods, status codes, `Vary` — and CORS proven to be a browser rule only |
| 04 | **[Cookies](04-cookies.md)** | <span className="db-tier t-understand">Understand</span> | `HttpOnly` / `Secure` / `SameSite`, and why `URLSearchParams` corrupts values |
| 10 | **[Streaming and SSE](10-streaming-and-sse.md)** | <span className="db-tier t-understand">Understand</span> | Chunked for free, `Last-Event-ID` resumption, cleanup in `res.on('close')` |
| 11 | **[WebSockets](11-websockets.md)** | <span className="db-tier t-know">Know</span> | Client in core, server from `ws`, heartbeat mandatory, no CORS |

## HTTP — calling

| # | Page | Tier | In one line |
|---|---|---|---|
| 05 | **[fetch](05-fetch.md)** | <span className="db-tier t-master">Master</span> | It does not throw on 500, and an unread body hangs the pool |
| 06 | **[Outbound timeouts](06-outbound-timeouts.md)** | <span className="db-tier t-master">Master</span> | There is no default. The deadline covers the body too |
| 07 | **[Keep-alive and agents](07-keep-alive-and-agents.md)** | <span className="db-tier t-understand">Understand</span> | 20 requests → 1 connection, and the `dispatcher` trap |
| 08 | **[Outbound client discipline](08-outbound-client-discipline.md)** | <span className="db-tier t-understand">Understand</span> | Retry what is safe, honour `Retry-After`, one idempotency key per operation |
| 09 | **[HTTPS and TLS](09-https-and-tls.md)** | <span className="db-tier t-understand">Understand</span> | Chain errors decoded, `NODE_EXTRA_CA_CERTS`, SNI, and mTLS |

## The layers below

| # | Page | Tier | In one line |
|---|---|---|---|
| 12 | **[node:net and node:dgram](12-net-and-dgram.md)** | <span className="db-tier t-know">Know</span> | Three writes, one event — framing is the whole lesson |
| 13 | **[node:dns](13-dns.md)** | <span className="db-tier t-know">Know</span> | `lookup` 1066 ms behind a busy thread pool, `resolve4` 15 ms |
| 14 | **[node:http2](14-http2.md)** | <span className="db-tier t-know">Know</span> | Five 300 ms requests in 328 ms on one connection |

## Processes

| # | Page | Tier | In one line |
|---|---|---|---|
| 15 | **[The process object](15-process.md)** | <span className="db-tier t-master">Master</span> | `exit()` lost 10 MB of a pipe write; exit codes an orchestrator reads |
| 16 | **[Signals](16-signals.md)** | <span className="db-tier t-master">Master</span> | 143 and 137, and why `CMD npm start` never sees SIGTERM |
| 17 | **[Graceful shutdown](17-graceful-shutdown.md)** | <span className="db-tier t-master">Master</span> | `server.close()` alone hangs forever — sweep idle, force at the deadline |
| 18 | **[Crash handlers](18-crash-handlers.md)** | <span className="db-tier t-understand">Understand</span> | Log and exit. Continuing left a lock held forever |
| 19 | **[child_process](19-child-process.md)** | <span className="db-tier t-understand">Understand</span> | `spawn` / `exec` / `execFile` / `fork`, and the 1 MB `maxBuffer` cliff |
| 20 | **[Shell injection](20-shell-injection.md)** | <span className="db-tier t-understand">Understand</span> | Quoted interpolation defeated twice; `execFile` is the fix |
| 21 | **[IPC](21-ipc.md)** | <span className="db-tier t-know">Know</span> | A `Date` goes in and a string comes out |
| 22 | **[util.parseArgs](22-parseargs.md)** | <span className="db-tier t-know">Know</span> | Enough CLI parsing to skip the dependency |

## Concurrency and scaling

| # | Page | Tier | In one line |
|---|---|---|---|
| 23 | **[cluster](23-cluster.md)** | <span className="db-tier t-understand">Understand</span> | Keep-alive sent 40 requests to 1 of 4 workers |
| 24 | **[worker_threads](24-worker-threads.md)** | <span className="db-tier t-know">Know</span> | Not faster to start than a fork — a tenth of the memory, and shareable |
| 25 | **[Shared memory](25-shared-memory.md)** | <span className="db-tier t-when">When Needed</span> | The same race lost 1.8 M updates, then zero |
| 26 | **[Single executables](26-single-executable-applications.md)** | <span className="db-tier t-when">When Needed</span> | 121 MB to print four lines |

## Coverage — all 30 syllabus rows

30 rows map to 26 pages, with four merges:

| Merged row | Landed on |
|---|---|
| mTLS / client certificates | 09, with the rest of TLS — same certificates, same chain |
| Writing a custom binary protocol over TCP | 12, with `node:net` — the framing section *is* the protocol |
| Exit codes and what they mean to an orchestrator | 15, with `exitCode` vs `exit()` — one subject |
| Sticky sessions and why stateful workers complicate scaling | 23, with `cluster` — stickiness is a consequence of it |

Two rows are answered mostly by **cross-reference** rather than repetition:
`uncaughtException` / `unhandledRejection` ([page 18](18-crash-handlers.md))
defers the mechanics to [Phase 2, page
15](../phase-2-async/15-unhandled-rejections.md) and covers only the process-level
decision, and `worker_threads` ([page 24](24-worker-threads.md)) defers *why* CPU
work must move to [Phase 2, page 22](../phase-2-async/22-cpu-bound-work.md).

## Phase gate

The syllabus asks for a server that survives `SIGTERM` mid-request without
dropping a response, size-limits bodies, times out every outbound `fetch`, and
offloads one CPU-heavy endpoint to a worker. Every line of it is a page here:

```js
const server = createServer({ requestTimeout: 30_000, connectionsCheckingInterval: 1000 },  // 01
  handle(async (req, res) => {
    if (req.url === '/upload') {
      const body = await readLimited(req, res, 5e6);                                        // 02
      if (body === null) return;                                    // already answered 413
      const enriched = await json(`${API}/enrich`, {                                        // 05
        signal: AbortSignal.any([req.signal, AbortSignal.timeout(2000)]),                   // 06
      });
      return res.end(JSON.stringify(await pool.run({ body, enriched })));                   // 24
    }
  }));

for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => shutdown(sig));              // 16, 17
```

The four things it gets right, each an incident when missed: the body limit is
enforced **mid-stream** rather than from `Content-Length`; every outbound call has
a **deadline** that also dies with the client; the CPU work runs in a **pooled
worker** instead of blocking the loop; and shutdown **drains** rather than
dropping — which needs `closeIdleConnections()` on an interval, not just
`server.close()`.

## Where this connects

- **Phase 2 — async** supplies `AbortSignal`, unhandled rejections and the
  CPU-bound argument. Pages 06, 18 and 24 are those applied to the network.
- **Phase 3 — streams** is what `req` and `res` actually are; backpressure and
  `pipeline` come straight through into pages 02 and 10.
- **Phase 6 — data access** is what the pools closed on page 17 contain.
- **Phase 7 — background work** takes the third-party calls off the request path
  and owns retries, idempotency and circuit breakers on the *receiving* side.
- **Phase 8 — security** goes deeper on CORS, cookies, SSRF and the shell
  injection sketched on page 20.
- **Phase 11 — deployment** is where signals, exit codes, `preStop` hooks and
  proxy timeouts stop being hypothetical.

---

← Phase 4: [Filesystem, paths and URLs](../phase-4-filesystem/README.md) · Start → [The HTTP server](01-http-server.md)
