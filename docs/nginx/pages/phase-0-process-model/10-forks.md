---
title: "The forks"
sidebar_label: "10 · The forks"
sidebar_position: 10
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-14 against [Angie — similarities and differences with nginx](https://en.angie.software/news/articles/shodstva-i-razlichiya-angie-i-nginx/),
> [webserver-llc/angie on GitHub](https://github.com/webserver-llc/angie),
> [OpenResty (Wikipedia)](https://en.wikipedia.org/wiki/OpenResty),
> [nginx news 2026](https://nginx.org/2026.html) and
> [ngx_http_upstream_module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**This page exists so that when somebody says "we should use Angie" or you find a
Stack Overflow answer that only works on OpenResty, you know what they mean and
whether it applies to you. For a fullstack MERN or PERN deployment the answer is
almost always "stock nginx".**

That is why this is the one <span className="db-tier t-when">When Needed</span> topic in the phase. Read it once,
recognise the names, move on.

## Why forks exist at all

Two different motives, and they produce very different projects:

1. **"nginx does not do enough."** Stock nginx is deliberately minimal and
   declarative — no scripting, no dynamic upstream API, limited observability, and
   a meaningful set of features reserved for NGINX Plus (page 09). Forks fill
   those gaps.
2. **"nginx is not developed the way we want."** nginx is owned by F5, and its
   direction is a commercial decision. Some forks are a response to that.

## The four you will hear about

| Fork | Origin | Exists to | Drop-in? |
|---|---|---|---|
| **OpenResty** | agentzh / OpenResty Inc. | Embed **LuaJIT** so nginx becomes a programmable application server | An nginx *distribution*, so mostly yes — plus a large extra API |
| **Tengine** | Taobao (Alibaba) | Features for very large Chinese web operations | Broadly, but development has been quiet |
| **Angie** | webserver-llc, founded by ex-nginx developers | A drop-in replacement with the Plus-style features in the open — plus "the best of nginx and freenginx" | Positioned explicitly as a drop-in replacement |
| **freenginx** | Maxim Dounin, long-time nginx core developer | Preserve free and open development of nginx outside F5's control | Yes, deliberately conservative |

### OpenResty

The one you are most likely to *encounter* rather than choose. It bundles nginx
with LuaJIT and a large library ecosystem, turning the config into a place where
you can genuinely write code — request handlers, custom auth, dynamic routing,
rate limiters with logic.

**Why it matters even if you never run it:** a very large amount of the "advanced
nginx" material online is actually OpenResty material. If an answer uses
`content_by_lua_block`, `access_by_lua`, or `resty.*`, it will not work on stock
nginx no matter which module you install.

**Why you probably do not want it in this stack:** you already have a programmable
server — Node. Moving logic into Lua inside nginx means a second language, a
second place to test, and logic in a layer that is hard to observe. OpenResty
earns its place where nginx *is* the application; here nginx is the edge.

### Angie

The most active fork in 2026, built by people who worked on nginx itself. It
targets exactly the gaps page 09 listed: active health checks, a runtime API and
metrics, dynamic upstream configuration, and other things stock nginx reserves for
Plus. It is designed as a drop-in replacement, so an existing config generally
works unchanged.

**When it is worth a look:** you need active health checks or a runtime API, you
do not want a Plus subscription, and your orchestrator is not already doing the
job. **When it is not:** a containerised deployment where Kubernetes or your cloud
load balancer already health-checks the backends — which is most of them.

### freenginx

Started by one of nginx's principal developers as a governance fork, not a feature
fork. Its point is *how* the code is developed, not *what* it does, so it is
deliberately close to upstream. Relevant to you mainly as context for why the
ecosystem fragmented after 2024.

### Tengine

Alibaba's fork, aimed at their own scale. Historically interesting, and it seeded
ideas that later reached upstream. In practice a Western fullstack team will not
choose it.

## What upstream nginx did in response

Some of the pressure has worked. Features that used to be Plus-only or fork-only
have been arriving in open-source nginx recently:

- `sticky learn` session affinity — open source in **1.29.6**
- the `sticky` directive — open source in **1.29.7**
- `least_time` load balancing — open source in **1.31.0** (mainline)
- the **ACME module** for automatic certificates — **1.29.0**
- **OpenTelemetry** tracing via `ngx_otel_module` — **1.25.3**

That trend is a real argument for staying on stock nginx and simply keeping
current. The gap that motivated the forks is narrower in 2026 than it was in
2024 — with **active health checks still the conspicuous exception**.

## How to decide

Ask, in order:

1. **Does stock nginx already do it?** Check the directive's "Appeared in
   version" note before assuming it does not — see the list above.
2. **Does something else in your stack already do it?** Kubernetes probes,
   your cloud load balancer's health checks, Prometheus scraping your Node app.
   This eliminates most fork use cases in a containerised deployment.
3. **Would it belong in Node anyway?** Auth logic, request rewriting with
   business rules, anything you would want a test for.
4. **Only then** consider a fork — and cost in what you are taking on: a
   different security-advisory feed, different packages, different container
   images, and colleagues who know nginx but not this.

## Gotchas

**Symptom:** A config snippet from a blog post produces `unknown directive`, and
the module you are told to install does not exist.
**Cause:** The snippet is OpenResty (Lua directives) or Angie, not stock nginx.
**Fix:** Check what the answer's directives belong to. `*_by_lua*` means
OpenResty; anything the nginx.org module index does not list means a fork or a
third-party module.

**Symptom:** Someone proposes "just switch to Angie" to get health checks.
**Cause:** A real gap in open-source nginx.
**Fix:** It is a legitimate option — but check first whether your orchestrator is
already health-checking the backends, which makes nginx's own checks redundant.
Switching the edge proxy is a large change to make for a feature you may already
have (Phase 8).

**Symptom:** A team runs a fork and follows nginx.org security announcements.
**Cause:** Assuming the advisory feeds are the same.
**Fix:** They are not. Each fork patches on its own schedule and publishes its
own advisories. Running a fork means subscribing to *its* feed, and this is the
most commonly forgotten cost of the decision.

## Trade-off

**A fork buys a specific missing feature and costs ecosystem.** Every tutorial,
every Stack Overflow answer, every colleague's experience and every container
base image assumes stock nginx. That is a large, quiet advantage to give up for
one directive.

The honest summary for this bible's stack: **use stock nginx, keep it current,
and let your orchestrator do the health checking.** Reach for OpenResty only if
nginx genuinely is your application server, and for Angie only when you have
identified a specific feature you need, cannot get elsewhere, and are prepared to
own.

## Interview questions

**★ What is OpenResty, and when would you use it?**
An nginx distribution bundling LuaJIT and a library ecosystem, turning nginx into
a programmable application server. It is right when nginx *is* your application —
an API gateway with routing logic, custom auth, dynamic rate limiting. In a stack
that already has Node, it usually just moves logic into a second language in a
harder-to-test place.

**Why did nginx get forked, and what came of it?**
Two reasons: features held back for the commercial NGINX Plus, and disagreement
about F5's stewardship of the project. Angie (by ex-nginx developers) targets the
feature gap; freenginx (by a core developer) is a governance fork. The pressure
had an effect — session affinity, ACME and OpenTelemetry have all landed in
open-source nginx recently.

**A Stack Overflow answer uses `access_by_lua_block`. Will it work on your nginx?**
No. That is OpenResty, not stock nginx, and no module you install on stock nginx
provides it. A large share of "advanced nginx" content online is actually
OpenResty content.

**What is the main practical cost of running a fork?**
The ecosystem: tutorials, container images, colleagues' knowledge and, most
easily forgotten, the security advisory feed. Each fork patches on its own
schedule, so following nginx.org's announcements no longer tells you when you are
vulnerable.

**Which open-source nginx gap most often motivates a switch?**
Active health checks. Open source has only passive checks (`max_fails` /
`fail_timeout`), which detect a bad upstream by failing a real user's request.
Angie and NGINX Plus both offer active probing — though in a containerised
deployment the orchestrator usually already does it.

---

← Prev: [Mainline, stable and NGINX Plus](09-versions-and-plus.md) · Index: [Phase 0](README.md) · Syllabus → [Part 1 — How nginx works](../../syllabus/01-how-nginx-works.md)
