---
title: "Installing nginx"
sidebar_label: "07 · Installing nginx"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against [nginx: Linux packages](https://nginx.org/en/linux_packages.html)
> (supported distributions, the stable/mainline repository split, the
> `nginx-module-*` package list), [Installing nginx](https://nginx.org/en/docs/install.html)
> and [Command-line parameters](https://nginx.org/en/docs/switches.html).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**There are three ways to get nginx and they disagree about where files live.
Most "it works on my machine" nginx problems are that disagreement, not nginx.**

## The three sources

| Source | Version | File layout | Use when |
|---|---|---|---|
| **Your distribution's package** (`apt install nginx`) | whatever the distro froze, often a year or two old | Debian-style: `sites-available` / `sites-enabled` | You want it to just work and do not need a recent feature |
| **The official nginx.org repository** | current **stable** or **mainline**, your choice | upstream style: `conf.d/` only | You need a current version — which, on this track, you do |
| **The container image** | tagged, pinned, reproducible | upstream style, plus an entrypoint that runs templates | Anything containerised (Phase 11) |

### The distribution package

Simplest, and usually too old. Given how much of this track hinges on **nginx
1.29.7** changing the proxy defaults, "too old" is not a cosmetic complaint here —
a distro nginx from before that release needs the explicit keep-alive
configuration that a current one does not (Phase 4).

Check what you actually have before writing any proxy config:

```bash
nginx -v          # just the version — the number this whole track turns on
```

### The nginx.org repository

Official packages exist for RHEL and its derivatives (8, 9, 10), Debian
(bullseye, bookworm, trixie), Ubuntu (jammy, noble, resolute), SLES 15 SP6+ and
16, Alpine 3.21–3.24, and Amazon Linux 2023, on both x86-64 and arm64.

They come as two repository channels:

- **`nginx-stable`** — the default, and the right choice for a production box.
- **`nginx-mainline`** — enabled deliberately, for a feature that is not on the
  stable branch yet.

Page 09 explains why "stable" does not quite mean what it sounds like.

### The container image

The official image is the reproducible option, and Phase 11 covers it properly.
Two of its behaviours are worth knowing now because they explain its differences:

- It runs `nginx -g "daemon off;"` so the master stays in the foreground and the
  container's lifetime matches nginx's (page 02).
- It symlinks the access and error logs to `stdout` and `stderr`, so `USR1` log
  rotation (page 04) is irrelevant — the container runtime's log driver handles
  it.

## The layouts, and why they differ

nginx has no standard file layout. The paths are chosen at **build time** by
`./configure`, which is why `nginx -V` is the authoritative answer for the binary
in front of you:

```bash
nginx -V 2>&1 | tr ' ' '\n' | grep -- '--prefix\|--conf-path\|--error-log-path'
```

| | Debian/Ubuntu distro package | nginx.org packages and the container |
|---|---|---|
| Main config | `/etc/nginx/nginx.conf` | `/etc/nginx/nginx.conf` |
| Site configs | `/etc/nginx/sites-available/`, symlinked into `sites-enabled/` | `/etc/nginx/conf.d/*.conf` |
| Default site | `sites-enabled/default` | `conf.d/default.conf` |
| Logs | `/var/log/nginx/` | `/var/log/nginx/`, or stdout/stderr in the container |
| Worker user | `www-data` | `nginx` |

🔴 **`sites-available` / `sites-enabled` is a Debian invention, not an nginx
feature.** nginx knows nothing about it; it works only because Debian's
`nginx.conf` contains `include /etc/nginx/sites-enabled/*;`. Copy a config from a
Debian tutorial onto an nginx.org-packaged server and the file will sit in a
directory nobody includes, doing nothing — and `nginx -t` will pass, because a
file nginx never reads cannot have a syntax error.

This is the single most common "my config is being ignored" cause, and page 06's
`nginx -T` settles it in one command.

## Dynamic module packages

The nginx.org repositories ship several modules as **separate packages** rather
than compiling them in:

| Package | What it adds | Since |
|---|---|---|
| `nginx-module-njs` | njs scripting (Phase 11) | |
| `nginx-module-otel` | OpenTelemetry tracing (Phase 10) | 1.25.3 |
| `nginx-module-acme` | the built-in ACMEv2 client (Phase 5) | 1.29.1 |
| `nginx-module-geoip` | legacy GeoIP lookups | |
| `nginx-module-image-filter` | on-the-fly image transformation | |
| `nginx-module-perl` | embedded Perl | |
| `nginx-module-xslt` | XSLT response transformation | |

Installing the package is only half of it — the module also needs a
`load_module` line, and `load_module` is **not applied by a reload** (page 05).
Page 08 covers the mechanics.

Notably absent: **Brotli**. There is no official package; it is a third-party
module you compile or find elsewhere (Phase 7).

## Building from source

Real, occasionally necessary, and a maintenance commitment. You take on tracking
security releases yourself — and the 1.30 branch shipped four of them between May
and July 2026 (page 09).

The reasons that justify it are narrow: a third-party module with no package
(Brotli, `ngx_cache_purge`), a build option the packages omit, or a patched
OpenSSL. If your reason is "I want it optimised for my CPU", it is not a reason.

## Gotchas

**Symptom:** You wrote a config in `sites-available`, symlinked it, reloaded, and
nothing happened.
**Cause:** The server uses nginx.org or container packages, whose `nginx.conf`
includes `conf.d/*.conf` and has never heard of `sites-enabled`.
**Fix:** Put the file in `conf.d/` with a `.conf` extension. Confirm with
`nginx -T | grep server_name` — if your block is not in the dump, nginx is not
reading the file.

**Symptom:** A config file in `conf.d/` is ignored.
**Cause:** The include is `conf.d/*.conf` and your file is `app.conf.bak`,
`app.config` or `app`. The glob is literal.
**Fix:** Rename it. And keep backups out of that directory entirely — an editor's
`app.conf~` will not match, but a copy named `app-old.conf` **will**, and a
duplicate `server_name` silently loses to whichever block nginx read first.

**Symptom:** `403 Forbidden` after moving from the distro package to nginx.org's.
**Cause:** The worker user changed from `www-data` to `nginx`, and your files are
owned by the old one.
**Fix:** Check the `user` directive and the ownership of the whole path to your
`root`. Page 02 has the permission walkthrough.

**Symptom:** A feature the documentation describes produces `unknown directive`.
**Cause:** Either your nginx predates it, or the module is dynamic and not
loaded.
**Fix:** `nginx -v` for the version and compare against the "Appeared in" note on
the directive's doc page; `nginx -V` for compiled-in modules; check for a
`load_module` line for dynamic ones.

**Symptom:** The container ignores the config you edited on the host.
**Cause:** The image has its own copy at that path and you did not mount over it.
**Fix:** Mount the file or directory explicitly, and verify with
`docker exec … nginx -T`. Running `-T` *inside* the container is the only version
of that check that means anything.

## Trade-off

**The distro package is the least effort and the most out of date.** For nginx
that gap is unusually expensive, because the defaults changed recently: an older
package is not merely missing features, it needs configuration a current one does
not.

The nginx.org stable repository is the right default for a server you operate.
The container image is the right default for anything you deploy. The distro
package is fine for a development machine and for nothing you are on call for.

## Interview questions

**★ What is `sites-available` / `sites-enabled`, and does nginx require it?**
No. It is a Debian and Ubuntu packaging convention that works only because their
`nginx.conf` includes `sites-enabled/*`. Upstream nginx — the nginx.org packages
and the official container — uses `conf.d/*.conf` instead. A config placed in the
wrong one is silently never read.

**★ Why does the same config work on one server and not another?**
Usually the file layout: different packaging, different `include` lines, a
different worker user, or a different nginx version. `nginx -V` shows the paths
the binary was built with and `nginx -T` shows what it is actually reading — that
pair settles it.

**Which should you install: the distro package or the nginx.org repository?**
The nginx.org stable repository for anything you operate. Distro packages lag by
a year or more, and on this track that matters concretely: nginx 1.29.7 changed
the upstream keep-alive defaults, so an older package needs proxy configuration a
current one does not.

**What is the difference between the `nginx-stable` and `nginx-mainline`
repositories?**
Two channels of the same official packages. `nginx-stable` follows the stable
branch and is the default; `nginx-mainline` follows the development branch and
must be enabled deliberately. Page 09 covers which one you actually want.

**Why is `nginx-module-acme` a separate package?**
Because it is a dynamic module rather than compiled in. The nginx.org repos ship
njs, OpenTelemetry, ACME, GeoIP, image-filter, Perl and XSLT that way. Installing
the package is not enough — the config also needs `load_module`, and that
requires a restart, not a reload.

**When is building nginx from source justified?**
When you need a third-party module with no package — Brotli and `ngx_cache_purge`
are the common ones — or a build option the packages omit. The cost is that you
own security patching yourself, and the stable branch shipped four security
releases between May and July 2026.

---

← Prev: [`nginx -t`, `-T` and `-V`](06-testing-the-config.md) · Index: [Phase 0](README.md) · Next → [Modules, static and dynamic](08-modules.md)
