---
title: "Phase 2 — How nginx picks a server and a location"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: nginx 1.30.x stable — 1.30.4 as of August 2026.**
> Every rule on these pages is quoted from the nginx documentation and each page
> names its source. **Nothing here was executed**: this track has no sandbox, so
> pages carry documented behaviour rather than console output. See the
> no-new-sandboxes rule on the [Contents page](../../../README.md).

🔴 **The most valuable phase in this track, and the one everybody skips.**

Everything that "mysteriously" serves the wrong file, proxies to the wrong app,
returns someone else's site, or drops a header on an error page is decided here.
nginx's matching rules are completely specified and slightly unintuitive — the
asymmetry between how prefix locations and regex locations are chosen is the
single most surprising thing in the product — and once you know them, nginx stops
being mysterious.

Seven pages. **01, 03 and 06 are the load-bearing ones.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Choosing the server block](01-choosing-the-server.md)** | <span className="db-tier t-master">Master</span> | Socket first, then `Host` — and the exact four-step `server_name` order |
| 02 | **[The default server and host-header safety](02-default-server.md)** | <span className="db-tier t-understand">Understand</span> | Something is always the default; make it deliberate, or leak your app to any hostname |
| 03 | **[The location matching algorithm](03-location-matching/README.md)** *(2 chunks)* | <span className="db-tier t-master">Master</span> | Longest prefix remembered, first regex wins — and the five modifiers |
| 04 | **[Named locations, `internal` and nesting](04-named-and-internal.md)** | <span className="db-tier t-understand">Understand</span> | `@name`, locations reachable only from inside, and when to nest |
| 05 | **[The request-processing phases](05-request-phases.md)** | <span className="db-tier t-understand">Understand</span> | Ten phases in order, and why `add_header` vanishes on a 500 |
| 06 | **[Internal redirects](06-internal-redirects.md)** | <span className="db-tier t-master">Master</span> | `try_files`, `error_page` and `rewrite … last` send the request round again |
| 07 | **[`error_page`](07-error-page.md)** | <span className="db-tier t-understand">Understand</span> | Custom error pages, `=200` rewriting, and intercepting upstream errors |

## Coverage

The syllabus lists eighteen topics for this phase. Several are merged into the
page that owns the mechanism; nothing is dropped.

| Syllabus topic | Page |
|---|---|
| `listen` and the address:port match first | 01 |
| `server_name` matching order | 01 |
| The default server | 01, 02 |
| The catch-all that stops host-header surprises | 02 |
| `server_name` empty value; `$host` vs `$http_host` vs `$server_name` | 02 |
| HTTPS and SNI complicate it | 02 |
| The location matching algorithm, in order | 03 · chunk 01 |
| The modifiers `=`, `^~`, `~`, `~*`, none | 03 · chunk 01 |
| Why regex order matters and prefix order does not | 03 · chunk 02 |
| Named locations `@name` | 04 |
| `internal` | 04 |
| Nested locations | 04 |
| The request-processing phases | 05 |
| Why this explains `add_header` disappearing on a 500 | 05 |
| Internal redirects | 06 |
| `rewrite … last` vs `break` vs `redirect` vs `permanent` | 06 |
| The `error_page` mechanism | 07 |
| Rewrite loops and the redirection-cycle error | 06 |

## Phase gate

**Deliverable:** given a config with six `location` blocks and a URL, you can name
the winning block *and the reason it won* without running nginx — and do it for
`/api/v1/users`, `/static/app.css` and `/` in the same config.

If that is not comfortable, reread [page 03](03-location-matching/README.md).
Phase 3 and Phase 4 both assume it completely.

## Where this connects

- **Phase 1 — the configuration language** supplies the inheritance rule that
  page 05 applies to `add_header`.
- **Phase 3 — static files** is `try_files` and the SPA fallback, which is page
  06's internal redirect mechanism doing its job.
- **Phase 4 — reverse proxy** depends on knowing which `location` wins, because
  `proxy_pass`'s URI rule is stated in terms of "the part matching the location".
- **Phase 9 — hardening** needs page 02's catch-all server and page 05's
  `always` parameter.

---

← Syllabus: [Part 1 — How nginx works](../../syllabus/01-how-nginx-works.md) · Start → [Choosing the server block](01-choosing-the-server.md)
