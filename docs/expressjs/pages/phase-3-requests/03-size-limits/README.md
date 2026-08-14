---
title: "Body size limits"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**Default limits exist so one client cannot stream gigabytes into memory. Treat
`limit` as a production control. Oversize → 413.**

> Verified: 2026-08-14 against **`body-parser@2.3.0`** and **`raw-body`** in
> `sandbox/express-verify/node_modules/` — the two 413 paths, `contentstream`'s
> compressed-body branch and `normalizeOptions`' `bytes` parsing, cited per chunk
> by function. The socket-level limits are Node's, per
> [`http.Server`](https://nodejs.org/api/http.html#class-httpserver). Every parser
> documents `limit` with a default of `"100kb"`
> ([express reference](https://expressjs.com/en/5x/api/express.html)). **Reading
> source is not a run.** The single console block (chunk 01) **predates this pass
> and was not re-measured**; the earlier verification review checked it by hand.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Two paths to 413](01-two-paths-to-413.md)** | Refused from the headers vs refused mid-stream, why a compressed body can only take the second path, and why body-parser drains the request afterwards |
| 02 | **[Choosing and layering limits](02-choosing-and-layering.md)** | The five layers a body crosses, why the proxy's limit should sit *above* the app's, how to pick a number, and giving one route more |
| 03 | **[What a limit does not protect](03-what-it-does-not-protect.md)** | Concurrency, slow clients, cheap-but-expensive bodies, post-parse memory and multipart — and the order to add the other controls in |

**Split on concept boundaries at the 300-line mark.** 01 is the mechanism, 02 is
the number, 03 is the boundary of what the number buys.

## Phase gate

You can name both routes to a 413 and what distinguishes them, say whether
`limit` measures compressed or decompressed bytes, and list two attacks a size
limit does nothing about.

## Where this connects

- **← [Phase 0 · 03 · chunk 01](../../phase-0-express-basics/03-request-lifecycle/01-the-nine-stages.md)**
  — why a limit can only be enforced *while reading*, never up front for every case.
- **← [02 · JSON and urlencoded](../02-json-and-urlencoded/README.md)** — the
  `limit` option among the rest, and the error-type table.
- **→ [05 · Malformed bodies](../05-malformed-bodies.md)** — the 400 sibling of
  these 413s.
- **→ [07 · Multipart uploads](../07-multipart-uploads.md)** — the bodies no
  built-in parser claims, and multer's `Infinity` default.
- **→ [Phase 6 · 03 · Pagination](../../phase-6-rest-surface/03-pagination/README.md)** and
  **[· 10 · PATCH and bulk](../../phase-6-rest-surface/10-patch-and-bulk.md)** — the
  semantic caps that bytes cannot express.
- **→ [Phase 9 · 04 · Rate limiting](../../phase-9-hardening/04-rate-limiting.md)** —
  the control for "many requests", which this one says nothing about.
- **→ [Phase 9 · 06 · Timeouts](../../phase-9-hardening/06-timeouts-and-secrets.md)**
  — the control for slow clients, and why a timeout is not a cancellation.

---

← Prev topic: [JSON and urlencoded](../02-json-and-urlencoded/README.md) · Start → [Two paths to 413](01-two-paths-to-413.md)
