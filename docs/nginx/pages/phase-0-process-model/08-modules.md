---
title: "Modules, static and dynamic"
sidebar_label: "08 · Modules"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against the [nginx documentation index](https://nginx.org/en/docs/)
> (the full module list), [ngx_core_module](https://nginx.org/en/docs/ngx_core_module.html)
> (`load_module`, appeared in 1.9.11) and
> [nginx: Linux packages](https://nginx.org/en/linux_packages.html).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**nginx is a small core plus a large pile of modules. Every directive you will
ever write belongs to one of them, and the module it belongs to decides whether
that directive exists on your server at all.**

## Everything is a module

The documentation index is organised by module, and that organisation is real —
it is how nginx is built. A few you will meet constantly:

| Module | Directives you already know | Phase |
|---|---|---|
| `ngx_core_module` | `worker_processes`, `user`, `events`, `include`, `load_module` | 0 |
| `ngx_http_core_module` | `server`, `location`, `root`, `alias`, `try_files`, `client_max_body_size` | 2, 3 |
| `ngx_http_proxy_module` | every `proxy_*` directive, including the whole cache | 4, 6 |
| `ngx_http_upstream_module` | `upstream`, `server`, `keepalive`, `least_conn`, `sticky` | 8 |
| `ngx_http_ssl_module` | every `ssl_*` directive | 5 |
| `ngx_http_rewrite_module` | `if`, `set`, `return`, `rewrite`, `break` | 1 |
| `ngx_http_headers_module` | `add_header`, `expires` | 3, 9 |
| `ngx_http_realip_module` | `set_real_ip_from`, `real_ip_header` | 4 |
| `ngx_http_limit_req_module` | `limit_req_zone`, `limit_req` | 9 |
| `ngx_http_log_module` | `log_format`, `access_log` | 10 |

Knowing which module owns a directive is not trivia — it is how you find its
documentation page, and how you check whether your binary has it.

## Static: compiled in at build time

Most modules are compiled into the binary by `./configure`. They are always
present and need no configuration to exist:

```bash
nginx -V 2>&1 | tr ' ' '\n' | grep -- '--with\|--without'
```

Two prefixes matter in that output:

- **`--with-http_v3_module`** — a module that is *not* built by default and was
  explicitly requested. `_module` on the end is the tell.
- **`--without-http_autoindex_module`** — a default module explicitly removed.

Modules with no flag at all are the defaults, built in silently. `proxy`,
`rewrite`, `headers`, `upstream`, `log`, `limit_req` are all in that group, which
is why nothing in this track's first eight phases needs a special build.

The ones you will actually check for:

| Module | Flag | Needed by |
|---|---|---|
| HTTP/3 and QUIC | `--with-http_v3_module` | Phase 5 |
| Real IP | `--with-http_realip_module` | Phase 4 |
| Pre-compressed files | `--with-http_gzip_static_module` | Phases 3, 7 |
| `stub_status` | `--with-http_stub_status_module` | Phase 10 |
| Raw TCP/UDP proxying | `--with-stream` | Phases 4, 8 |
| The debug log | `--with-debug` | Phase 10 |
| SSL at all | `--with-http_ssl_module` | Phase 5 |

## Dynamic: loaded at run time

Since **1.9.11**, a module can be a `.so` loaded at startup instead of compiled
in:

```nginx
# nginx.conf — main context, before everything else.
load_module modules/ngx_http_js_module.so;
load_module modules/ngx_otel_module.so;

events { ... }
http   { ... }
```

Three rules, and each of them catches someone:

1. **`load_module` belongs in the `main` context**, at the top of `nginx.conf` —
   not inside `http`, not in a `conf.d/` file that is included from within
   `http`.
2. **A reload does not apply it.** Adding a `load_module` line needs a full
   restart (page 05). `nginx -t` will validate it happily, which makes this
   easy to miss.
3. **The module must match your nginx version exactly.** A `.so` built against a
   different release refuses to load, because nginx has no stable module ABI.

The nginx.org repositories ship njs, OpenTelemetry, ACME, GeoIP, image-filter,
Perl and XSLT as `nginx-module-*` packages built for exactly the nginx version
they ship alongside — which is the whole reason to prefer the package over
building the module yourself.

## "Unknown directive" — the decision tree

`nginx: [emerg] unknown directive "foo"` has exactly three causes. Work through
them in order:

| Check | How | If it fails |
|---|---|---|
| 1. Is your nginx new enough? | `nginx -v`, then the "Appeared in version" line on the directive's doc page | Upgrade (page 07) |
| 2. Is the module compiled in? | `nginx -V 2>&1 \| grep <module>` | Rebuild, or install the dynamic package |
| 3. Is the dynamic module loaded? | `nginx -T \| grep load_module` | Add the line **and restart** |

A fourth cause is not really "unknown directive" but produces the same confusion:
the directive is **NGINX Plus only**. `health_check`, `sticky learn` before
1.29.6, `api`, `status_zone`, `queue`, `slow_start`, `state` are all documented
on nginx.org and all absent from the open-source binary. Page 09 covers the list.

## Third-party modules

Some things everybody wants are not in nginx at all:

| Want | Reality |
|---|---|
| **Brotli compression** | `ngx_brotli`, third-party. No official package (Phase 7) |
| **Cache purging** | `proxy_cache_purge` is NGINX Plus; `ngx_cache_purge` is the third-party substitute (Phase 6) |
| **ModSecurity WAF** | third-party connector |
| **Lua scripting** | OpenResty's territory, not stock nginx (page 10) |

Each of these means either building nginx yourself or finding a distribution that
bundles it — and each is a maintenance commitment, because the module must be
rebuilt for every nginx security release.

That is a genuine argument for doing without. Brotli is a real win for text
assets; needing a custom nginx build to get it is a real cost. Pre-compressing at
build time with `gzip_static` (Phase 7) avoids the question entirely for static
files, which is where most of the benefit was.

## Gotchas

**Symptom:** `nginx: [emerg] "load_module" directive is specified too late`.
**Cause:** The `load_module` line is inside `http`, or in an included file that is
itself inside `http`.
**Fix:** Move it to the `main` context at the top of `nginx.conf`, before the
`events` block.

**Symptom:** You installed a module package, added `load_module`, ran
`nginx -t` (passed) and `nginx -s reload`, and the module's directives are still
unknown.
**Cause:** `load_module` is not applied by a reload.
**Fix:** Restart. This is one of the very few changes that genuinely needs one.

**Symptom:** `module ... is not binary compatible`.
**Cause:** The `.so` was built against a different nginx version. nginx has no
stable module ABI.
**Fix:** Install the module package that matches your nginx exactly, and upgrade
them together. This is the reason distributions version-lock the two.

**Symptom:** A directive is in the official documentation but nginx rejects it.
**Cause:** Most likely it is NGINX Plus only, or newer than your build. The
nginx.org docs cover both products on the same page and mark Plus-only features
in prose that is easy to skim past.
**Fix:** Read the directive's "Appeared in version" note and the surrounding
text. Page 09 lists the Plus-only directives you are most likely to hit.

## Trade-off

**The static/dynamic split trades startup simplicity for upgrade coupling.**
Statically compiled modules can never be missing and never mismatch, but changing
the set means rebuilding nginx. Dynamic modules can be added by installing a
package — and now you have two things that must be upgraded in lockstep forever,
because there is no ABI guarantee between them.

For anything the official packages provide dynamically, take the dynamic package.
For anything requiring a custom build, weigh it against doing without: a
self-built nginx means you own every future security release, and there were four
of those in three months on the 1.30 branch.

## Interview questions

**★ What is the difference between a static and a dynamic nginx module?**
A static module is compiled into the binary at build time by `./configure` and is
always present. A dynamic module is a `.so` loaded at startup with `load_module`
(available since 1.9.11), which lets you add functionality without rebuilding —
at the cost of having to match the module build to the nginx version exactly.

**★ You get `unknown directive`. How do you diagnose it?**
Three checks in order: is your nginx new enough for that directive (`nginx -v`
against the doc page's "Appeared in version"); is the module compiled in
(`nginx -V`); and if it is dynamic, is it actually loaded (`nginx -T | grep
load_module`) — remembering that `load_module` needs a restart, not a reload. A
fourth possibility is that the directive is NGINX Plus only.

**★ Why does adding `load_module` require a restart?**
Because module loading happens at master startup, before the configuration that a
reload re-reads is applied. A reload starts new workers with new configuration
but does not re-link the binary's module set.

**Where must `load_module` appear in the configuration?**
In the `main` context, at the top of `nginx.conf`, before `events` and `http`.
Putting it inside `http` — including via an include from there — produces
`"load_module" directive is specified too late`.

**Why is Brotli not simply available in nginx?**
It is a third-party module with no official package, so using it means a custom
build and owning the rebuild for every nginx security release. For static assets,
pre-compressing at build time and serving with `gzip_static` sidesteps most of
the need.

**How do you find out which module a directive belongs to?**
The documentation is organised by module, and `nginx -V` lists what the binary
was built with. Knowing the owning module is how you find the right doc page and
how you check whether the directive can exist on your server at all.

---

← Prev: [Installing nginx](07-installing.md) · Index: [Phase 0](README.md) · Next → [Mainline, stable and NGINX Plus](09-versions-and-plus.md)
