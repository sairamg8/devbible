---
title: "include and the file layout"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against [ngx_core_module](https://nginx.org/en/docs/ngx_core_module.html)
> (`include`, context `any`), [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html)
> (`types`, `default_type`) and [nginx: Linux packages](https://nginx.org/en/linux_packages.html).
> **No sandbox run** — nothing in this topic was executed, and it carries no console output.

**`include` is textual substitution at parse time, in whatever context it appears.
That single sentence explains both how a real config is organised and why so many
of them silently do nothing.**

Two chunks. The first is the mechanism and the file layout it implies; the second
is MIME types, which is the one include every nginx installation has and the
clearest worked example of what the mechanism is for.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[How `include` works](01-how-include-works.md)** | Substitution at parse time, the two kinds of included file, the literal glob, and a layout that scales |
| 02 | **[MIME types and `default_type`](02-mime-types.md)** | Why every config includes `mime.types`, why `default_type` defaults to `text/plain`, and the ES-module failure |

## Phase gate for this topic

You can say why the include-a-snippet pattern from
[page 02](../02-inheritance.md) defeats the replace rule, and you can explain why
a config file you added had no effect while `nginx -t` reported success.

## Where this connects

- **[02 · Inheritance and the replace rule](../02-inheritance.md)** — the snippet
  pattern works *because* of how `include` substitutes.
- **Phase 0 · [`nginx -t`, `-T` and `-V`](../../phase-0-process-model/06-testing-the-config.md)**
  — `nginx -T` is how you prove which files nginx actually read.
- **Phase 3 · serving static files** — MIME types decide what the browser does
  with the bytes you send it.

---

← Prev: [Inheritance and the replace rule](../02-inheritance.md) · Index: [Phase 1](../README.md) · Start → [How `include` works](01-how-include-works.md)
