---
title: "Nginx — Syllabus"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08-14 against [nginx.org/en/docs/](https://nginx.org/en/docs/),
> [the download page](https://nginx.org/en/download.html),
> [nginx news 2026](https://nginx.org/2026.html) and
> [CHANGES-1.30](https://nginx.org/en/CHANGES-1.30).
> **No sandbox run** — this is an inventory, not an explanation.

The topic inventory for Nginx, tiered for **mastery in fullstack MERN/PERN
development**. 12 phases, 210 topics, split into 4 parts to stay under the
300-line file cap.

nginx is the last piece of the stack and the first thing on the internet that
touches it. Everything the rest of this bible built — a React bundle, an Express
API, a Postgres or Mongo behind it — reaches a user through this layer, and the
whole track is written from that direction: **not "what does nginx do", but "what
does nginx do for a Node app in production".**

## Version facts

| | |
|---|---|
| Latest **stable** | **nginx 1.30.4** — 15 July 2026 |
| Latest **mainline** | **nginx 1.31.3** — 15 July 2026 |
| The 1.30 branch opened | **14 April 2026**, carrying everything from the 1.29.x mainline line |
| Security cadence | 1.30.1 (13 May) · 1.30.2 (22 May) · 1.30.3 (17 Jun) · 1.30.4 (15 Jul) — **four security releases in three months** |
| Build against | **1.30.x**, and check `nginx -v` before trusting any advice you read — including this track's |

🔴 **The defaults changed, and most nginx advice on the internet is now wrong.**
As of **1.29.7**, `keepalive` in the `upstream` block is **enabled by default**
(`keepalive 32 local;`), `proxy_http_version` defaults to **1.1**, and the
`Connection` header is **no longer sent** to the backend. The three-line
incantation every tutorial tells you to paste — `proxy_http_version 1.1;` plus
`proxy_set_header Connection "";` plus a `keepalive` line — is **redundant on
1.30+ and still required on 1.28 and older**. Knowing which side of that line
your server is on is the single most valuable version fact in this track.

Other things the 1.30 stable branch brought down from mainline: **session
affinity** (`sticky`) in open source, **Early Hints** (103) from proxied
backends, **HTTP/2 to the backend**, `ssl_certificate_compression`, and
Encrypted ClientHello via `ssl_ech_file`.

## Parts

| # | Part | Covers | Phases |
|---|---|---|---|
| 1 | **[How nginx works](syllabus/01-how-nginx-works.md)** | Process model, the config language, how a request finds its `server` and `location` | 0–2 |
| 2 | **[Serving and proxying](syllabus/02-serving-and-proxying.md)** | Static files and SPAs, the reverse proxy to Node, TLS/HTTP2/HTTP3 | 3–5 |
| 3 | **[Speed and scale](syllabus/03-speed-and-scale.md)** | Caching, compression and limits, load balancing and upstream health | 6–8 |
| 4 | **[Production](syllabus/04-production.md)** | Rate limiting and hardening, logs and metrics, deployment and operations | 9–11 |

## Explanations

The explanations live separately, in **[Explanations](./pages/README.md)** —
one page per topic, with code, gotchas and interview questions.

import Progress from '@site/src/components/Progress';

<Progress lang="nginx" compact />

## Tier legend

| Badge | Meaning |
|---|---|
| <span className="db-tier t-master">Master</span> | Use confidently with no documentation open |
| <span className="db-tier t-understand">Understand</span> | Know how it works; look up signatures freely |
| <span className="db-tier t-know">Know</span> | Know what/why/when; details on demand |
| <span className="db-tier t-when">When Needed</span> | Don't study upfront |

## Tier distribution

| Tier | Topics | Share |
|---|---|---|
| <span className="db-tier t-master">Master</span> | 58 | 28% |
| <span className="db-tier t-understand">Understand</span> | 101 | 48% |
| <span className="db-tier t-know">Know</span> | 38 | 18% |
| <span className="db-tier t-when">When Needed</span> | 13 | 6% |
| **Total** | **210** | |

By part: How nginx works 46 · Serving and proxying 60 · Speed and scale 47 ·
Production 57.

The <span className="db-tier t-master">Master</span> set is small on purpose and it is not spread evenly. It
concentrates in **Phase 2** (how nginx picks a `server` and a `location`) and
**Phase 4** (the reverse proxy), because those two phases explain the
overwhelming majority of "nginx is doing something insane" incidents. Finish
those two and you can debug most production nginx problems; the rest is range.

## Prerequisites

**Node through Phase 5 (networking), and Express through Phase 9 (`trust
proxy`).** nginx makes sense as *the thing in front of a server you already
understand* — proxy buffering means nothing if you have never watched a Node
response stream, and the `X-Forwarded-For` phase is unlearnable without knowing
what Express does with it.

You also want a working React or Vite build to serve. Phase 3 assumes one.

## Reading order

**Sequential, and the order is load-bearing for Parts 1 and 2.** Two rules:

1. **Do not skip Phase 2.** Location matching is the phase everyone skips and
   the phase every mystery traces back to. It is dry and it is worth it.
2. **Do not start Phase 6 (caching) before Phase 4.** Caching a reverse proxy
   you do not understand is how you serve one user's account page to another.

Part 4 is more parallelizable — logging (Phase 10) is worth reading early, and
is the fastest way to make every other phase debuggable.

## Where this connects

| This track | Hands off to / from |
|---|---|
| Phase 4 · `X-Forwarded-*` and `realip` | **Express** Phase 9 · [`trust proxy`](../expressjs/pages/phase-9-hardening/01-trust-proxy/README.md) — the two must agree or client IP and secure cookies break |
| Phase 3 · serving a built bundle | **Vite** / **Webpack** — hashed filenames are what make the caching policy possible |
| Phase 6 · caching responses | **Redis** — nginx caches *responses*, Redis caches *data*; they are not substitutes |
| Phase 7 · `client_max_body_size` | **Express** Phase 3 · size limits — the limit exists in two places and both must be set |
| Phase 9 · rate limiting | **Redis** — per-node limits in nginx vs globally counted limits in Redis |
| Phase 11 · containers | **Docker & Podman** *(not written yet)* — the multi-stage build that produces the image nginx serves from |

## Sources

- [nginx documentation index](https://nginx.org/en/docs/) · [download](https://nginx.org/en/download.html) · [news](https://nginx.org/news.html)
- [How nginx processes a request](https://nginx.org/en/docs/http/request_processing.html) · [Server names](https://nginx.org/en/docs/http/server_names.html) · [Controlling nginx](https://nginx.org/en/docs/control.html)
- [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · [ngx_http_upstream_module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html)
- [ngx_http_ssl_module](https://nginx.org/en/docs/http/ngx_http_ssl_module.html) · [ngx_http_v3_module](https://nginx.org/en/docs/http/ngx_http_v3_module.html) · [ngx_http_acme_module](https://nginx.org/en/docs/http/ngx_http_acme_module.html)
- [ngx_http_limit_req_module](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html) · [ngx_http_log_module](https://nginx.org/en/docs/http/ngx_http_log_module.html) · [CHANGES-1.30](https://nginx.org/en/CHANGES-1.30)
