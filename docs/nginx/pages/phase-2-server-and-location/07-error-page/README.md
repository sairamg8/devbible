---
title: "error_page"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html)
> and [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).
> **No sandbox run** — nothing in this topic was executed, and it carries no console output.

**`error_page` maps a status code to a URI and issues an internal redirect to it.
It can also change the status code on the way — which is the source of both its
most useful trick and its most dangerous misuse.**

Two chunks. The first is the directive itself and its four forms; the second is
using it with a backend, where the interesting decisions are — and where an API
can quietly stop telling the truth.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The directive and its forms](01-the-directive.md)** | The basic form, `=response`, a bare `=`, named locations, URL redirects — and the method changing to GET |
| 02 | **[With a backend, and what not to do](02-with-a-backend.md)** | `proxy_intercept_errors`, `recursive_error_pages`, inheritance, and why an API should keep its own errors |

## Phase gate for this topic

You can explain why a custom error page does not fire for a backend 500 by
default, say what a bare `=` does that `=200` does not, and give a reason not to
turn on `proxy_intercept_errors` for `/api/`.

## Where this connects

- **[06 · Internal redirects](../06-internal-redirects/README.md)** —
  `error_page` is one of the five causes, and shares the ten-redirect limit.
- **[04 · Named locations and `internal`](../04-named-and-internal.md)** — error
  pages should live in `internal` locations, and can be handed to a named one.
- **[Phase 1 · 02 Inheritance](../../phase-1-configuration-language/02-inheritance.md)**
  — `error_page` is multi-valued, so defining one discards the inherited set.
- **Phase 4 · reverse proxy** — the argument about intercepting upstream errors
  belongs to the API design there.

---

← Prev: [Internal redirects](../06-internal-redirects/README.md) · Index: [Phase 2](../README.md) · Start → [The directive and its forms](01-the-directive.md)
