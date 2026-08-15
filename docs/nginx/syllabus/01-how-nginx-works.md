---
title: "Part 1 — How nginx works"
sidebar_label: "1 · How nginx works"
sidebar_position: 1
---

> Phases 0–2 · The process model, the configuration language, and how a request
> finds its `server` and its `location`

> Verified: 2026-08-14 against [nginx.org/en/docs/](https://nginx.org/en/docs/),
> [Controlling nginx](https://nginx.org/en/docs/control.html),
> [How nginx processes a request](https://nginx.org/en/docs/http/request_processing.html),
> [Server names](https://nginx.org/en/docs/http/server_names.html),
> [Configuration file measurement units](https://nginx.org/en/docs/syntax.html) and
> [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html).
> **No sandbox run** — this is an inventory, not an explanation.

This is the part that decides whether nginx feels like a config file you copy from
Stack Overflow or a program you can reason about. Almost every "why is nginx
serving the wrong thing?" question is a Phase 2 question, and almost every "why
did my change do nothing?" question is a Phase 0 one.

---

## Phase 0 — The nginx process model

nginx is not a request handler you write code into. It is a small C program with a
fixed lifecycle, and the lifecycle is what you actually operate.

| Topic | Tier |
|---|---|
| **What nginx is**: an event-driven reverse proxy, HTTP server and load balancer — and why "web server" undersells it in a Node stack | <span className="db-tier t-understand">Understand</span> |
| **Master process and worker processes** — who reads the config, who binds the ports, who serves the requests, and who runs as `root` | <span className="db-tier t-master">Master</span> |
| **The event loop per worker** — one worker handles thousands of connections; why nginx does not spawn a thread or process per request, and how that differs from Apache's prefork model | <span className="db-tier t-understand">Understand</span> |
| **`worker_processes auto`, `worker_connections`, and the theoretical max** — connections × workers, and why the real ceiling is the file-descriptor limit (`worker_rlimit_nofile`) | <span className="db-tier t-understand">Understand</span> |
| Connection processing methods — `epoll` on Linux, `kqueue` on BSD/macOS, and why you almost never set `use` by hand | <span className="db-tier t-know">Know</span> |
| **Signals and `nginx -s`** — `reload` (HUP), `quit` (graceful QUIT), `stop` (immediate TERM), `reopen` (USR1 after log rotation) | <span className="db-tier t-master">Master</span> |
| **A reload is not a restart** — the master re-reads the config, starts new workers, and lets old workers finish in-flight requests; what this buys you and what it cannot change | <span className="db-tier t-master">Master</span> |
| **Binary upgrade on the fly** — USR2 to start a new master, WINCH to drain the old workers, and how to roll back if the new binary is bad | <span className="db-tier t-know">Know</span> |
| **`nginx -t`, `-T` and `-V`** — test the config, dump the *fully resolved* config, and print the compile-time flags and module list | <span className="db-tier t-master">Master</span> |
| Installing: distro packages vs the official nginx.org repo vs the container image — and why the distro package's file layout differs from upstream's | <span className="db-tier t-understand">Understand</span> |
| **Static vs dynamic modules** — `--with-...` at build time vs `load_module` at run time; how to tell whether the module you need is even present | <span className="db-tier t-understand">Understand</span> |
| **Mainline vs stable** — what the two branches actually promise, and why "stable" does not mean "the safe one to run" | <span className="db-tier t-understand">Understand</span> |
| nginx Open Source vs NGINX Plus — the directives the docs list that you do not have, and the open-source substitute for each | <span className="db-tier t-know">Know</span> |
| The forks and derivatives — OpenResty, Tengine, Angie, freenginx — what each exists for, and when a fullstack team would care | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you can explain what happens between typing
`nginx -s reload` and the new config serving traffic, and say which of your
in-flight requests get dropped (none, if you did it right).

---

## Phase 1 — The configuration language

nginx config is a real language with real scoping rules. Most people learn it as
copy-paste because nobody told them the four rules that make it predictable.

| Topic | Tier |
|---|---|
| **Directives and contexts** — simple directives (`name value;`) vs block directives (`name { … }`), and the context tree: `main` → `events` / `http` → `server` → `location` | <span className="db-tier t-master">Master</span> |
| **Inheritance downward, and the replace-not-merge rule** — a child context inherits directives from its parent, but *setting the same directive in the child replaces the whole set*, it never appends | <span className="db-tier t-master">Master</span> |
| **`include` and the file layout** — `conf.d/*.conf`, the Debian `sites-available` / `sites-enabled` convention, and why upstream nginx does not ship it | <span className="db-tier t-understand">Understand</span> |
| **Variables** — `$host`, `$uri`, `$request_uri`, `$args`, `$remote_addr`, `$scheme`, `$http_*`, `$sent_http_*`, `$upstream_*`; where they come from and when they are set | <span className="db-tier t-master">Master</span> |
| `$uri` vs `$request_uri` vs `$document_uri` — the decoded-and-rewritten one, the raw original, and which one you want in a log | <span className="db-tier t-understand">Understand</span> |
| **Measurement units** — `k`/`m`/`g` for size, `ms`/`s`/`m`/`h`/`d` for time; the units are part of the syntax, not decoration | <span className="db-tier t-understand">Understand</span> |
| **`map`** — the lookup table that replaces most `if` blocks; `default`, `hostnames`, regex keys, `volatile`, and lazy evaluation | <span className="db-tier t-master">Master</span> |
| **"If is evil"** — what `if` inside `location` actually does, the two directives that are safe inside it, and the three things to use instead (`map`, `try_files`, `return`) | <span className="db-tier t-master">Master</span> |
| `set`, `return` and `rewrite` — the rewrite module's tiny imperative language, and why it runs earlier than you think | <span className="db-tier t-understand">Understand</span> |
| **`return` vs `rewrite` for redirects** — why `return 301 https://$host$request_uri;` is the correct HTTPS redirect and a `rewrite` is not | <span className="db-tier t-understand">Understand</span> |
| `geo` and `split_clients` — IP-range lookup tables and percentage bucketing for canaries and A/B tests | <span className="db-tier t-know">Know</span> |
| Regular expressions in nginx — PCRE, capture groups as `$1`, named captures, and the cost of a regex in a hot path | <span className="db-tier t-understand">Understand</span> |
| `include` of MIME types, and how `default_type` decides what a browser does with an unknown extension | <span className="db-tier t-understand">Understand</span> |
| Comments, quoting, and the three ways a stray `;` ruins your evening | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** a config split across `nginx.conf` + `conf.d/` where you
can predict, before running `nginx -T`, exactly which directives a given
`location` ends up with.

---

## Phase 2 — How nginx picks a server and a location

The single highest-value phase in this track. Everything that "mysteriously"
serves the wrong file, proxies to the wrong app, or ignores your `add_header`
is decided here.

### Choosing the `server` block

| Topic | Tier |
|---|---|
| **`listen` and the address:port match first** — nginx narrows by socket *before* it looks at any hostname | <span className="db-tier t-understand">Understand</span> |
| **`server_name` matching order** — exact name → longest leading wildcard (`*.example.com`) → longest trailing wildcard (`www.example.*`) → first matching regex, in file order | <span className="db-tier t-master">Master</span> |
| **The default server** — `listen … default_server`, and the fact that *something* is always the default: the first block for that address:port | <span className="db-tier t-understand">Understand</span> |
| **The catch-all that stops host-header surprises** — a `server_name _;` default returning 444, and why leaving the default to chance leaks your app to any hostname pointed at your IP | <span className="db-tier t-understand">Understand</span> |
| `server_name` with an empty value, `$host` vs `$http_host` vs `$server_name`, and which one is safe to trust | <span className="db-tier t-understand">Understand</span> |
| **HTTPS complicates it**: the certificate is chosen by SNI *before* the request line exists, so a name mismatch fails at TLS, not at HTTP | <span className="db-tier t-understand">Understand</span> |

### Choosing the `location` block

| Topic | Tier |
|---|---|
| **The matching algorithm, in order**: all prefix locations are checked and the *longest* match remembered; then regexes are tried **in file order** and the **first** match wins; if no regex matches, the remembered prefix is used | <span className="db-tier t-master">Master</span> |
| **The modifiers**: `=` (exact, terminates immediately), `^~` (longest prefix, skip regexes), `~` (case-sensitive regex), `~*` (case-insensitive regex), none (plain prefix) | <span className="db-tier t-master">Master</span> |
| **Why regex order matters and prefix order does not** — the one asymmetry that makes nginx configs feel random | <span className="db-tier t-master">Master</span> |
| **Named locations `@name`** — not matched against any URI; reachable only from `try_files`, `error_page` and `rewrite … last` | <span className="db-tier t-understand">Understand</span> |
| `internal` — locations reachable only by internal redirect; the building block for `X-Accel-Redirect` and `auth_request` | <span className="db-tier t-understand">Understand</span> |
| Nested locations, and when nesting is clearer than another top-level prefix | <span className="db-tier t-know">Know</span> |

### The phases a request actually goes through

| Topic | Tier |
|---|---|
| **The request-processing phases** — post-read, server-rewrite, find-config, rewrite, post-rewrite, preaccess, access, precontent, content, log — and which module runs in each | <span className="db-tier t-understand">Understand</span> |
| **Why this explains `add_header` disappearing on a 500** — `add_header` only applies to a listed set of status codes unless you say `always` | <span className="db-tier t-master">Master</span> |
| **Internal redirects** — `try_files`, `error_page`, `rewrite … last`; the request re-enters location selection with a new URI, and `$request_uri` does not change | <span className="db-tier t-master">Master</span> |
| **`rewrite … last` vs `break` vs `redirect` vs `permanent`** — two of them stay inside nginx, two of them go back to the browser | <span className="db-tier t-understand">Understand</span> |
| The `error_page` mechanism — internal handling, `=200` rewriting, and intercepting upstream errors with `proxy_intercept_errors` | <span className="db-tier t-understand">Understand</span> |
| Rewrite loops and the `rewrite or internal redirection cycle` error — how to read it and how to break the cycle | <span className="db-tier t-understand">Understand</span> |

**Gate — deliverable:** given a config with six `location` blocks and a URL, you
can name the winning block *and the reason it won* without running nginx — and
you can do it for `/api/v1/users`, `/static/app.css` and `/` in the same config.

---

← Index: [Nginx](../README.md) · Next → [Part 2 — Serving and proxying](02-serving-and-proxying.md)
