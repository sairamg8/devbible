---
title: "Phase 1 — The configuration language"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: nginx 1.30.x stable — 1.30.4 as of August 2026.**
> Every directive, default and rule on these pages is quoted from the nginx
> documentation and the page names its source. **Nothing here was executed**:
> this track has no sandbox, so pages carry documented behaviour rather than
> console output. See the no-new-sandboxes rule on the
> [Contents page](../../../README.md).

nginx configuration is a real language with real scoping rules. Most people learn
it as copy-paste, because nobody ever told them the four rules that make it
predictable: contexts nest, directives inherit **by replacement**, variables are
lazy, and the rewrite module runs earlier than you think.

This phase is those four rules. It is short, and every later phase leans on it —
the `proxy_set_header` inheritance trap in Phase 4 and the `add_header` surprise
in Phase 9 are both just page 02 applied.

Nine pages. Pages 02, 06 and 07 are the ones that change how you write configs.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Directives and contexts](01-directives-and-contexts.md)** | <span className="db-tier t-master">Master</span> | Simple directives, block directives, and the context tree everything hangs in |
| 02 | **[Inheritance and the replace rule](02-inheritance.md)** | <span className="db-tier t-master">Master</span> | Children inherit from parents — and setting one value throws away the whole inherited set |
| 03 | **[`include` and the file layout](03-include-and-files/README.md)** *(2 chunks)* | <span className="db-tier t-understand">Understand</span> | How a config is assembled from many files, and MIME types as the worked example |
| 04 | **[Variables](04-variables.md)** | <span className="db-tier t-master">Master</span> | Where they come from, when they are evaluated, and `$uri` vs `$request_uri` |
| 05 | **[Units, quoting and comments](05-syntax-details.md)** | <span className="db-tier t-understand">Understand</span> | `k`/`m`/`g`, `ms`/`s`/`h`/`d`, when a value needs quotes, and the stray semicolon |
| 06 | **[`map`](06-map/README.md)** *(2 chunks)* | <span className="db-tier t-master">Master</span> | The lookup table that replaces most `if` blocks, evaluated only when used |
| 07 | **["If is evil"](07-if-is-evil.md)** | <span className="db-tier t-master">Master</span> | What `if` really does inside a `location`, and the three things to use instead |
| 08 | **[`rewrite`, `return` and regular expressions](08-rewrite-and-return.md)** | <span className="db-tier t-understand">Understand</span> | The rewrite module's stack machine, the four flags, and PCRE in nginx |
| 09 | **[`geo` and `split_clients`](09-geo-and-split-clients.md)** | <span className="db-tier t-know">Know</span> | IP-range lookups and percentage bucketing for canaries |

## Coverage

The syllabus lists fourteen topics for this phase. Five are merged into pages that
already own the material; nothing is dropped.

| Syllabus topic | Page |
|---|---|
| Directives and contexts; the context tree | 01 |
| Inheritance downward, and the replace-not-merge rule | 02 |
| `include` and the file layout | 03 · chunk 01 |
| `include` of MIME types, and `default_type` | 03 · chunk 02 |
| Variables — `$host`, `$uri`, `$args`, `$http_*`, `$sent_http_*`, `$upstream_*` | 04 |
| `$uri` vs `$request_uri` vs `$document_uri` | 04 |
| Measurement units | 05 |
| Comments, quoting, and the stray `;` | 05 |
| `map` — `default`, `hostnames`, regex keys, `volatile`, lazy evaluation | 06 · 2 chunks |
| "If is evil" | 07 |
| `set`, `return` and `rewrite` | 08 |
| `return` vs `rewrite` for redirects | 08 |
| Regular expressions in nginx | 08 |
| `geo` and `split_clients` | 09 |

## Phase gate

Move on to Phase 2 when you can take a config split across `nginx.conf` and
`conf.d/` and **predict, before running `nginx -T`, exactly which directives a
given `location` ends up with** — including which inherited ones it just threw
away.

If that is not comfortable, reread page 02. Phase 4 is unlearnable without it.

## Where this connects

- **Phase 0 — the process model** is what re-reads this file on a reload.
- **Phase 2 — server and location selection** is where the rewrite module's
  internal redirects (page 08) re-enter matching.
- **Phase 4 — reverse proxy** hits page 02's replace rule head-on with
  `proxy_set_header`, and needs page 06's `map` for WebSocket upgrades.
- **Phase 9 — hardening** meets it again with `add_header`, and uses page 06 for
  conditional logic without `if`.

---

← Syllabus: [Part 1 — How nginx works](../../syllabus/01-how-nginx-works.md) · Start → [Directives and contexts](01-directives-and-contexts.md)
