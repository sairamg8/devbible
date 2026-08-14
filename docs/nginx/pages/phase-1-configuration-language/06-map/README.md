---
title: "map"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against [ngx_http_map_module](https://nginx.org/en/docs/http/ngx_http_map_module.html).
> **No sandbox run** — nothing in this topic was executed, and it carries no console output.

**`map` creates a variable whose value depends on another variable. It is a
lookup table, it costs nothing until read, and it is the correct answer to almost
every question that starts "how do I put an `if` in my nginx config?"**

Two chunks. The first is the mechanism — syntax, the exact search order, and the
four special parameters. The second is why you reach for it instead of `if`, and
the handful of patterns that cover most real use.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The mechanism](01-the-mechanism.md)** | Syntax, the five-step search order, `default` / `hostnames` / `include` / `volatile`, regex keys and captures |
| 02 | **[Using it instead of `if`](02-using-it.md)** | The four advantages over `if`, five patterns worth stealing, and sizing the hash |

## Phase gate for this topic

You can write a `map` that branches three ways, explain why declaring fifty of
them costs nothing, and say what an unmatched key produces when you forget
`default`.

## Where this connects

- **[07 · "If is evil"](../07-if-is-evil/README.md)** — the argument this topic's
  chunk 02 opens, made in full.
- **Phase 4 · reverse proxy** — the `$connection_upgrade` map is mandatory for
  WebSocket proxying.
- **Phase 6 · caching** — `proxy_cache_bypass` and `proxy_no_cache` are driven by
  a map over the session cookie.
- **Phase 10 · logs** — `access_log … if=$loggable` uses one to drop health
  checks from the log volume.

---

← Prev: [Units, quoting and comments](../05-syntax-details.md) · Index: [Phase 1](../README.md) · Start → [The mechanism](01-the-mechanism.md)
