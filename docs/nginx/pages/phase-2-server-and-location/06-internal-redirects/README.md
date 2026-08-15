---
title: "Internal redirects"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against [njs reference](https://nginx.org/en/docs/njs/reference.html),
> [ngx_http_rewrite_module](https://nginx.org/en/docs/http/ngx_http_rewrite_module.html),
> [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html)
> and [How nginx processes a request](https://nginx.org/en/docs/http/request_processing.html).
> **No sandbox run** — nothing in this topic was executed, and it carries no console output.

**An internal redirect changes the request's URI and sends it back through
location matching — inside nginx, with no round trip to the browser. Five things
cause one, the loop is capped at ten, and `$request_uri` never changes.**

Two chunks. The first is the mechanism — what causes one, what happens to the
variables, and `last` versus `break`. The second is what goes wrong: redirection
cycles, the SPA fallback that swallows an API, and how to make an invisible
mechanism visible in the logs.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The mechanism](01-the-mechanism.md)** | The five causes, where processing restarts, `$uri` vs `$request_uri`, and the four `rewrite` flags |
| 02 | **[Cycles, SPAs and debugging](02-cycles-and-debugging.md)** | The ten-redirect limit and its 500, the three classic cycles, the correct SPA fallback, and logging both URIs |

## Phase gate for this topic

You can name all five causes of an internal redirect, explain why an SPA fallback
turns a backend 404 into a 200, and read
`rewrite or internal redirection cycle` back to the directive that caused it.

## Where this connects

- **[03 · The location matching algorithm](../03-location-matching/README.md)** —
  what the request re-enters.
- **[04 · Named locations and `internal`](../04-named-and-internal.md)** — the
  safe destination for a fallback, and where `X-Accel-Redirect` lands.
- **[07 · `error_page`](../07-error-page/README.md)** — the fourth cause, in full.
- **Phase 3 · static files** — `try_files` and the SPA fallback are this
  mechanism applied.

---

← Prev: [The request-processing phases](../05-request-phases.md) · Index: [Phase 2](../README.md) · Start → [The mechanism](01-the-mechanism.md)
