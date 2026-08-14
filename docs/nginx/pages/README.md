---
title: "Nginx — Pages"
sidebar_label: "Overview"
sidebar_position: 0
---

:::info 🔒 Claimed — session `21fbf27e`, 2026-08-14

All of `docs/nginx/` is claimed. Nginx was one of the two unstarted technologies
in the bible (the other is Docker & Podman) and had zero pages.

**Work happens in the worktree
`/run/media/sairam/Storage/Backup/Knowledge/devbible-nginx`, branch `nginx`** —
not in the shared checkout, so a build failure here is genuinely this track's
fault rather than another session's uncommitted edit.

**State: syllabus complete (12 phases, 210 topics). ✅ Phase 0 written — 14/14
topics, 10 pages.** Next unit: **Phase 1 · The configuration language (14
topics)**.

Documentation-validated against nginx.org under the no-new-sandboxes rule: every
claim names its source in a `> Verified:` line, and **no console block is added
unless a run actually produced it**. There is no nginx sandbox in this repo and
none is planned.

:::

> **Target: nginx 1.30.x stable** (1.30.4, July 2026). Pages name the version a
> behaviour was confirmed on, because the 1.29 → 1.30 line **changed the proxy
> defaults** — see the [version facts](../README.md#version-facts) before
> trusting any keep-alive advice, this track's included.

The explanations behind the [Nginx syllabus](../README.md).

import Progress from '@site/src/components/Progress';

<Progress lang="nginx" />

## What each phase covers

| Phase | Covers |
|---|---|
| ✅ **[0 — The nginx process model](phase-0-process-model/README.md)** | **Written — 14/14 topics, 10 pages.** Master and workers, the per-worker event loop, signals, reload vs restart, `nginx -t`/`-T`/`-V`, mainline vs stable, dynamic modules |
| **1 — The configuration language** | Contexts and inheritance, the replace-not-merge rule, variables, `map`, why `if` is evil, `return` vs `rewrite` |
| **2 — Server and location selection** | `listen` and `server_name` matching, the default server, the location algorithm and its modifiers, internal redirects, the request phases |
| **3 — Static files and SPAs** | `root` vs `alias`, `try_files`, the SPA fallback, caching a hashed bundle, MIME types, `sendfile`, `X-Accel-Redirect` |
| **4 — Reverse proxy to Node** | The `proxy_pass` URI rule, `Host` and `X-Forwarded-*`, `realip`, keep-alive (changed in 1.29.7), timeouts, buffering, WebSockets and SSE, 502/504/499 |
| **5 — TLS, HTTP/2, HTTP/3** | The TLS server block, chain order, ACME and the built-in ACME module, HSTS, session resumption, QUIC and `Alt-Svc`, `ssl_reject_handshake` |
| **6 — Caching at the edge** | `proxy_cache_path` and the cache key, what may be cached, `use_stale`, `cache_lock`, revalidation, purging on open source, microcaching |
| **7 — Compression and limits** | `gzip_types`, `gzip_static`, Brotli, `client_max_body_size`, upload buffering, `limit_rate`, Early Hints |
| **8 — Load balancing** | Upstream blocks, balancing methods, passive health checks, `zone`, DNS resolution at startup, session affinity, zero-downtime deploys |
| **9 — Limits and hardening** | `limit_req` with `burst`/`nodelay`, `limit_conn`, rate limiting behind a CDN, `allow`/`deny`, `auth_request`, security headers, `add_header` and `always` |
| **10 — Logs and metrics** | `log_format` and JSON logs, `$request_time` vs `$upstream_response_time`, `$request_id`, reading the error log, `stub_status`, OpenTelemetry |
| **11 — Deployment and operations** | Config layout, `nginx -t` in CI, safe reloads, nginx in containers and Compose, worker tuning, canaries, the alternatives, a production checklist |

The inventory these follow starts at
[Part 1 — How nginx works](../syllabus/01-how-nginx-works.md).
