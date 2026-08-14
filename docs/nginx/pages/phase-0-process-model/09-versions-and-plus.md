---
title: "Mainline, stable and NGINX Plus"
sidebar_label: "09 · Versions and Plus"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against [nginx: download](https://nginx.org/en/download.html),
> [nginx news 2026](https://nginx.org/2026.html), [CHANGES-1.30](https://nginx.org/en/CHANGES-1.30),
> [ngx_http_upstream_module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html)
> (the NGINX Plus feature notes) and [nginx: Linux packages](https://nginx.org/en/linux_packages.html).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**Two branches and two products. "Stable" does not mean what you think it means,
and a large fraction of the official documentation describes software you do not
have.**

## Mainline and stable

| | Mainline | Stable |
|---|---|---|
| Current as of Aug 2026 | **1.31.3** (15 July 2026) | **1.30.4** (15 July 2026) |
| Release cadence | every one to two months | a new branch roughly yearly |
| Gets new features | **yes** | **no** — only fixes |
| Gets security fixes | yes | yes, **backported from mainline** |
| Third-party module compatibility | can break between releases | stable within the branch |

The nginx.org repositories offer both as `nginx-mainline` and `nginx-stable`
(page 07). Stable is the default.

### Why "stable" is a misleading word

**Stable does not mean "more tested" or "fewer bugs".** It means *frozen
features*. Every fix on the stable branch is backported from mainline, so
mainline has always had it first — and had it longer.

Which is why the nginx project's own advice has long been that most people should
run **mainline**, and why "stable" primarily suits deployments with third-party
modules that would need rebuilding, or a change-control process that wants a
frozen feature set.

**This track targets 1.30.x stable** because that is what distributions and
container images ship by default in August 2026, not because it is the safer
branch.

### Both branches get security fixes, and they arrive often

The 1.30 branch's actual 2026 history:

| Release | Date | Content |
|---|---|---|
| 1.30.0 | 14 April 2026 | branch opens, carrying the 1.29.x features |
| 1.30.1 | 13 May 2026 | six CVEs — HTTP/2 injection, buffer overflow, buffer overread, address spoofing, use-after-free |
| 1.30.2 | 22 May 2026 | buffer overflow in `ngx_http_rewrite_module` (CVE-2026-9256) |
| 1.30.3 | 17 June 2026 | buffer overflow (CVE-2026-42055), buffer overread (CVE-2026-48142) |
| 1.30.4 | 15 July 2026 | buffer overflow in `map` with regex (CVE-2026-42533), memory disclosure in `ngx_http_slice_module` (CVE-2026-60005), use-after-free |

**Four security releases in three months.** Treat "we run stable so we do not
have to upgrade" as the misunderstanding it is: staying on 1.30.0 today means
running with eleven-plus known CVEs, several in modules this track uses.

## Which version, in practice

```bash
nginx -v      # the one number that changes how you write proxy config
```

| If you are on | Then |
|---|---|
| **1.29.7 or later** (so all of 1.30.x) | Upstream keep-alive is on by default, `proxy_http_version` is 1.1, `Connection` is not sent. The tutorial incantation is redundant |
| **1.28.x or older** | You must configure keep-alive explicitly, or every proxied request opens a new TCP connection to Node |

Nothing else in this track depends so heavily on a version number. Phase 4 covers
what to actually write on each side of that line.

A few other version gates worth having in your head:

| Feature | From |
|---|---|
| Dynamic modules (`load_module`) | 1.9.11 |
| `nginx -T` | 1.9.2 |
| `worker_shutdown_timeout` | 1.11.11 |
| `accept_mutex` defaults to `off` | 1.11.3 |
| HTTP/3 and QUIC (experimental) | 1.25.0 |
| `http2` as its own directive rather than a `listen` parameter | 1.25.1 |
| Early Hints (`early_hints`) | 1.29.0 |
| ACME module (`nginx-module-acme`) | 1.29.0 / packaged 1.29.1 |
| `ssl_certificate_compression` | 1.29.1 |
| HTTP/2 to the backend, `ssl_ech_file` | 1.29.4 |
| `sticky learn` in open source | 1.29.6 |
| 🔴 **Keep-alive defaults change**, `sticky` in open source | **1.29.7** |
| `least_time` in open source | 1.31.0 — **mainline only, not on 1.30** |

That last row is the trap in the other direction: a feature can be in the
documentation and in mainline and still absent from the stable branch you run.

## NGINX Plus: the documentation describes software you may not have

nginx.org documents open source and the commercial **NGINX Plus** on the *same
pages*, marking Plus-only features in prose that is very easy to skim past. The
result is a specific and common failure: you read a directive, write it, and get
`unknown directive` on a perfectly current nginx.

The Plus-only things you are most likely to reach for:

| Plus feature | What it does | Open-source substitute |
|---|---|---|
| **`health_check`** (active health checks) | Probes upstreams on a schedule, before real traffic hits them | `max_fails` + `fail_timeout` — **passive only**, failures are detected using real requests (Phase 8) |
| **`proxy_cache_purge`** | Purge a cached entry on demand | `ngx_cache_purge` third-party module, a `proxy_cache_bypass` secret header, deleting cache files, or hashed filenames so you never purge (Phase 6) |
| **`api`, the live dashboard** (`ngx_http_api_module`) | Runtime stats and config over REST | `stub_status` (seven numbers) plus the access log (Phase 10) |
| **`auth_jwt`, `oidc`** | JWT and OpenID Connect at the edge | `auth_request` to your own verifier, or do it in Node (Phase 9) |
| **`keyval`** | A runtime key-value store in nginx | Redis |
| **`queue`** | Queue requests when all upstreams are busy | Nothing direct — shed load or scale (Phase 8) |
| **`slow_start`** | Ramp a recovered upstream back up gradually | Nothing direct |
| **`state`** | Persist upstream state across restarts | Nothing direct |
| `server … route=`, `drain` | Fine-grained upstream control | `down`, weights, and a reload (Phase 8) |
| `$upstream_last_addr`, `$upstream_last_server_name` | Extra logging variables | `$upstream_addr` lists every attempt anyway |

**Active health checks are the one that genuinely hurts.** Open-source nginx only
learns an upstream is unhealthy by sending it a real request and watching it fail
— so some user always eats the failure. Phase 8 covers what to do about that, and
the answer is usually "your orchestrator does the health checking, not nginx".

Some features do graduate. `sticky learn` became open source in 1.29.6 and the
`sticky` directive in 1.29.7; `least_time` in 1.31.0. Check the directive's own
note rather than assuming a list from a blog post is current.

## Gotchas

**Symptom:** A directive straight from the official docs gives `unknown directive`
on an up-to-date nginx.
**Cause:** It is NGINX Plus only, or newer than your branch.
**Fix:** Re-read the directive's page for the Plus marker and the "Appeared in
version" note. Both are easy to miss, and both are the answer more often than a
broken install.

**Symptom:** "We run stable, so we are on a supported version" — and the box has
not been updated since April.
**Cause:** Confusing *branch stability* with *being patched*. Stable freezes
features, not vulnerabilities.
**Fix:** Track patch releases on your branch. The 1.30 branch went 1.30.0 →
1.30.4 with eleven-plus CVEs fixed in three months.

**Symptom:** You copied a config from a recent tutorial and got
`unknown directive "least_time"`.
**Cause:** `least_time` reached open source in 1.31.0 — mainline. Stable 1.30.x
does not have it.
**Fix:** Use `least_conn`, or move to the mainline repository deliberately.

**Symptom:** You upgraded to 1.30 and your `proxy_set_header Connection "";` lines
now look wrong in review.
**Cause:** They are redundant, not wrong — since 1.29.7 that is the default
behaviour.
**Fix:** They are harmless to leave, and removing them is only safe if you will
never run this config on an older nginx. Say which version the config targets, in
a comment.

## Trade-off

**Choosing stable buys you a frozen feature set and costs you being behind.**
Every fix you receive was in mainline first, third-party modules keep working,
and change control is happy. In exchange you wait a year for features and, if you
are not disciplined about patch releases, you quietly accumulate CVEs.

Choosing mainline gets fixes and features soonest and risks a third-party module
breaking on an upgrade. If you use no third-party modules — which is most
fullstack deployments — mainline is a defensible default and the project's own
long-standing recommendation.

## Interview questions

**★ What is the difference between nginx mainline and stable?**
Mainline is the active development branch, released every one to two months with
new features and fixes. Stable freezes features on a branch and receives only
fixes, backported from mainline. "Stable" means *frozen*, not *more tested* — the
mainline has always had every fix first.

**★ Does running the stable branch mean you can skip upgrades?**
No, and it is a common and expensive misreading. The 1.30 stable branch shipped
four security releases between May and July 2026 fixing eleven-plus CVEs. Stable
freezes features, not vulnerabilities.

**★ You wrote `health_check` in your upstream block and nginx will not start.
Why?**
Active health checks are an NGINX Plus feature. Open-source nginx has only
passive checks — `max_fails` and `fail_timeout` — which mark a server down after
real requests to it have failed, meaning some user always experiences the
failure.

**Name a few NGINX Plus features and their open-source substitutes.**
Active `health_check` → passive `max_fails`/`fail_timeout`; `proxy_cache_purge` →
the third-party `ngx_cache_purge`, a `proxy_cache_bypass` header, or hashed
filenames; the `api` dashboard → `stub_status` plus access logs; `auth_jwt`/`oidc`
→ `auth_request` to your own service; `keyval` → Redis.

**Which nginx version number matters most for a Node reverse proxy, and why?**
1.29.7. From that release upstream `keepalive` is enabled by default,
`proxy_http_version` defaults to 1.1, and the `Connection` header is no longer
sent. Before it, every proxied request opened a new TCP connection to the backend
unless you configured otherwise — so the same config performs very differently on
either side of that line.

**Can a feature be documented, in mainline, and still unavailable to you?**
Yes. `least_time` became open source in 1.31.0, which is mainline — it is not on
the 1.30 stable branch. The directive's own "Appeared in version" note is the
authority, not the fact that the page exists.

---

← Prev: [Modules, static and dynamic](08-modules.md) · Index: [Phase 0](README.md) · Next → [The forks](10-forks.md)
