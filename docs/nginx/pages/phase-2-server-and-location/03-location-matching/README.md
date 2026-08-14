---
title: "The location matching algorithm"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against [ngx_http_core_module — location](https://nginx.org/en/docs/http/ngx_http_core_module.html)
> and [How nginx processes a request](https://nginx.org/en/docs/http/request_processing.html).
> **No sandbox run** — nothing in this topic was executed, and it carries no console output.

🔴 **The single highest-value topic in this track.**

nginx's location algorithm is completely specified, takes four sentences to state,
and is slightly unintuitive in one specific way: **prefix locations are chosen by
specificity regardless of order, and regex locations are chosen by order
regardless of specificity.** Almost every "nginx is doing something insane" report
is that asymmetry.

Two chunks. The first is the algorithm and the five modifiers; the second is the
asymmetry, the ordering rules that follow from it, and worked configurations.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The algorithm and the modifiers](01-the-algorithm.md)** | Longest prefix remembered, first regex wins — and what `=`, `^~`, `~`, `~*` and bare prefix each do |
| 02 | **[The asymmetry, in practice](02-the-asymmetry.md)** | Why regex order matters and prefix order does not, how to order a real config, and three worked examples |

## Phase gate for this topic

Given a config with six `location` blocks and a URL, you can name the winning
block **and the reason it won** — for `/api/v1/users`, `/static/app.css` and `/`
in the same config, without running nginx.

## Where this connects

- **[01 · Choosing the server block](../01-choosing-the-server.md)** — the same
  specificity-versus-order asymmetry appears in `server_name` matching.
- **[04 · Named locations and `internal`](../04-named-and-internal.md)** — the two
  kinds of location this algorithm never matches.
- **Phase 3 · static files** — `try_files` and the SPA fallback both depend on
  which location wins.
- **Phase 4 · reverse proxy** — `proxy_pass`'s URI rule is stated in terms of
  *"the part of the request matching the location"*, so it is meaningless without
  this.

---

← Prev: [The default server](../02-default-server.md) · Index: [Phase 2](../README.md) · Start → [The algorithm and the modifiers](01-the-algorithm.md)
