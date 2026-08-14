---
title: "Directives and contexts"
sidebar_label: "01 · Directives and contexts"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against [ngx_core_module](https://nginx.org/en/docs/ngx_core_module.html),
> [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html)
> (the `Context:` line on every directive) and
> [Configuration file measurement units](https://nginx.org/en/docs/syntax.html).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**An nginx config is a tree of contexts containing directives. Every directive
in the documentation lists exactly which contexts it is legal in, and that one
line answers most "why won't this work?" questions before you ask them.**

## Two kinds of directive

```nginx
worker_processes auto;          # simple: a name, arguments, a semicolon

events {                        # block: a name, optional arguments, braces
    worker_connections 4096;
}
```

A **simple directive** is a name, its arguments, and a mandatory `;`. A **block
directive** is a name, optional arguments, and `{ … }`. A block that can contain
other directives is a **context**.

That is the entire grammar. There are no expressions, no functions, no loops, and
no assignment beyond `set`. What looks like complexity in a large nginx config is
always nesting plus inheritance, never syntax.

## The context tree

```nginx
# ── main context: everything outside any block ───────────────────
user              www-data;
worker_processes  auto;
error_log         /var/log/nginx/error.log warn;
pid               /run/nginx.pid;
load_module       modules/ngx_http_js_module.so;

events {                                    # ── events ───────────
    worker_connections  4096;
}

http {                                      # ── http ─────────────
    include       mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    gzip          on;

    upstream app {                          # ── upstream ─────────
        server 127.0.0.1:3000;
    }

    map $http_upgrade $connection_upgrade {  # ── map ─────────────
        default upgrade;
        ''      close;
    }

    server {                                # ── server ───────────
        listen       80;
        server_name  app.example.com;
        root         /srv/app/dist;

        location /api/ {                    # ── location ─────────
            proxy_pass http://app;
        }

        location = /healthz {               # (siblings, not nested)
            return 200 "ok\n";
        }
    }
}
```

Six contexts, and their relationships are worth stating explicitly:

| Context | Lives in | Holds | Note |
|---|---|---|---|
| **main** | the file itself | process-level settings | `worker_processes`, `user`, `pid`, `load_module` |
| **`events`** | main | connection processing | Exactly one. Mandatory in a working config |
| **`http`** | main | everything web | Exactly one. All web directives live under it |
| **`server`** | `http` | one virtual host | Many. Phase 2 is how nginx chooses between them |
| **`location`** | `server`, `location` | one URI pattern | Many, and nestable. Phase 2 again |
| **`upstream`, `map`, `geo`, `split_clients`** | `http` | named lookups and pools | Siblings of `server`, **not** inside it |

Two more exist and are out of scope here: `stream` (raw TCP/UDP, main context,
alongside `http`) and `mail` (deliberately not covered — see the syllabus).

## The `Context:` line is the specification

Every directive page in the nginx documentation carries three lines:

```text
Syntax:   client_max_body_size size;
Default:  client_max_body_size 1m;
Context:  http, server, location
```

**Read the `Context:` line before you write the directive.** It tells you exactly
where the directive is legal, and — implicitly — how broadly you can set it.
`client_max_body_size` in `http` applies to every server; in one `location` it
applies only there. `worker_processes` is `main` only, so there is no per-site
version of it. `keepalive` is `upstream` only.

A directive used in the wrong context fails at `nginx -t` with
`"foo" directive is not allowed here`, which is one of the friendlier nginx
errors: it means you looked in the right documentation and put the line in the
wrong place.

## `upstream` and `map` are not inside `server`

This is the structural mistake beginners make most:

```nginx
http {
    server {
        listen 80;

        upstream app {          # ✗ "upstream" directive is not allowed here
            server 127.0.0.1:3000;
        }
    }
}
```

`upstream`, `map`, `geo` and `split_clients` are **`http`-context** blocks. They
define named things — a pool of servers, a lookup table — that any `server` or
`location` can then refer to. They are declarations, not parts of a virtual host.

The correct shape puts them beside `server`, not inside it:

```nginx
http {
    upstream app { server 127.0.0.1:3000; }

    server {
        listen 80;
        location /api/ { proxy_pass http://app; }
    }
}
```

## Where directives actually take effect

A directive's *context* is where you may write it. Where it **takes effect** is
that context and everything nested below — subject to the replace rule on page
02. In practice this gives you a deliberate choice of altitude:

```nginx
http {
    client_max_body_size 1m;              # the site-wide default

    server {
        server_name uploads.example.com;
        client_max_body_size 50m;         # this whole virtual host

        location /api/avatar {
            client_max_body_size 2m;      # just this endpoint
        }
    }
}
```

**Set things as high as they are true and no higher.** Global defaults in `http`,
per-site overrides in `server`, per-endpoint exceptions in `location`. A config
that repeats the same directive in twenty `location` blocks is telling you it
belongs one level up.

## Gotchas

**Symptom:** `nginx: [emerg] "upstream" directive is not allowed here`.
**Cause:** An `http`-context block written inside `server`.
**Fix:** Move `upstream`, `map`, `geo` and `split_clients` out to the `http`
level, beside your `server` blocks. Check the `Context:` line on the directive's
doc page; it is authoritative.

**Symptom:** `nginx: [emerg] unexpected "}"` or `unexpected end of file, expecting "}"`.
**Cause:** A missing `;` on a simple directive, or unbalanced braces — usually
several lines above where nginx reports it.
**Fix:** Read *upward* from the reported line. nginx notices the problem only when
the parse fails, which is often long after the actual typo.

**Symptom:** A directive placed in `http` seems ignored inside one `location`.
**Cause:** Something in the chain redefined it, and the replace rule threw the
inherited value away.
**Fix:** Page 02. Confirm with `nginx -T` that the value you expect is really
where you think it is.

**Symptom:** `location` blocks in a `conf.d/` file, with no enclosing `server`.
**Cause:** Confusing the two include styles. Debian's `sites-enabled/*` files
contain whole `server` blocks; some setups include *fragments* from **inside** a
`server`.
**Fix:** Know which kind of file you are writing. A snippet full of bare
`location` blocks can only be included from within a `server` (page 03).

## Trade-off

**A declarative config buys predictability and costs expressiveness.** There is
no way to write "if the user is an admin and it is after 9pm" in nginx, and that
is a feature: every request takes a path you can determine by reading the file,
and there is no per-request code to profile or crash.

When you find yourself fighting that constraint, the answer is almost always that
the logic belongs in Node — not that you need `if`, `map` chains, or njs. Page 07
makes that case in full.

## Interview questions

**★ What are the main contexts in an nginx configuration?**
`main` (the file itself, holding process settings like `worker_processes` and
`user`), `events` (connection processing), `http` (everything web), and inside
`http`: `server` for a virtual host and `location` for a URI pattern.
`upstream`, `map`, `geo` and `split_clients` are also `http`-context blocks, and
`stream` sits beside `http` in `main` for raw TCP/UDP.

**★ Why does `upstream` go in `http` rather than in `server`?**
Because it is a declaration, not part of a virtual host. It names a pool of
backends that any `server` or `location` can point `proxy_pass` at. Writing it
inside `server` fails validation with "directive is not allowed here".

**★ How do you know where a directive is allowed?**
Its documentation page states `Syntax:`, `Default:` and `Context:` — and the
`Context:` line is exact. It also tells you the altitudes at which you can set it,
which is how you decide between a global default and a per-endpoint override.

**What is the difference between a simple directive and a block directive?**
A simple directive is a name, arguments and a mandatory semicolon. A block
directive is a name, optional arguments, and braces; a block that can contain
other directives is a context. That is the whole grammar — no expressions, no
functions, no loops.

**Where should you set `client_max_body_size`?**
As high in the tree as the value is true. In `http` for a site-wide default, in
`server` for one virtual host, in `location` for a single endpoint that differs.
Repeating it in many `location` blocks means it belongs a level up.

---

← Index: [Phase 1](README.md) · Next → [Inheritance and the replace rule](02-inheritance.md)
