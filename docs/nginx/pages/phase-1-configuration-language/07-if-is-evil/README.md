---
title: "If is evil"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against [ngx_http_rewrite_module](https://nginx.org/en/docs/http/ngx_http_rewrite_module.html).
> **No sandbox run** — nothing in this topic was executed, and it carries no console output.

**"If is evil" is the title of a page on the nginx wiki, and it is not a joke.
`if` inside a `location` does not do what it looks like it does: it creates a
nested configuration context, and directives from other modules inside it behave
in ways that are documented as undefined.**

Two chunks. The first is what `if` really is and the three ways it breaks; the
second is the four replacements that cover every real use, and the one narrow
place `if` is acceptable.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[What `if` actually is](01-what-if-does.md)** | A block directive that assigns a configuration context — plus the classic breakages and why the design is like this |
| 02 | **[What to use instead](02-what-to-use-instead.md)** | `map`, another `server`, another `location`, `try_files` — and the one acceptable `if` |

## Phase gate for this topic

You can explain why an `add_header` inside an `if` drops the headers set outside
it, and name the right replacement for a host-based, a path-based and a
file-existence condition without hesitating.

## Where this connects

- **[02 · Inheritance and the replace rule](../02-inheritance.md)** — `if` is a
  level, which is the whole reason `add_header` breaks inside it.
- **[06 · `map`](../06-map/README.md)** — the primary replacement.
- **[08 · `rewrite`, `return` and regex](../08-rewrite-and-return.md)** — the two
  directives that *are* safe inside `if`.
- **Phase 2 · server and location selection** — the mechanisms that make most
  `if` conditions unnecessary.

---

← Prev: [`map`](../06-map/README.md) · Index: [Phase 1](../README.md) · Start → [What `if` actually is](01-what-if-does.md)
