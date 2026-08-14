---
title: "Sizing the workers"
sidebar_label: "03 · Sizing the workers"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against [ngx_core_module](https://nginx.org/en/docs/ngx_core_module.html)
> (`worker_processes`, `worker_connections`, `worker_rlimit_nofile`, `multi_accept`,
> `accept_mutex`, `worker_cpu_affinity`, `worker_priority`, `thread_pool`,
> `timer_resolution`) and
> [Connection processing methods](https://nginx.org/en/docs/events.html).
> **No sandbox run** — nothing on this page was executed, and it carries no measurements.

**Almost every nginx tuning guide you will read is copied from one written for a
2012 kernel. The honest version of this page is short: set `worker_processes
auto`, raise `worker_connections` and the file-descriptor limit together, and
change nothing else until a metric tells you to.**

## The two numbers

| Directive | Context | Documented default | What it means |
|---|---|---|---|
| `worker_processes` | `main` | **`1`** | How many worker processes to run |
| `worker_connections` | `events` | **`512`** | Max simultaneous connections **per worker** |

Note both defaults. `worker_processes 1` and `worker_connections 512` are what
nginx ships; every distribution package overrides them, which is why almost
nobody has seen them.

```nginx
worker_processes  auto;      # one per CPU core (supported since 1.3.8 / 1.2.5)

events {
    worker_connections  4096;
}
```

`auto` is correct on essentially every deployment. nginx workers are CPU-bound
only when doing TLS handshakes and compression; more workers than cores buys
nothing and costs context switches.

## The arithmetic, and why it lies

The number quoted everywhere is:

```text
max connections = worker_processes × worker_connections
```

For a **reverse proxy** that number is misleading, and the reason matters. Each
proxied request holds **two** connections from the worker's pool: the client's,
and the one to the backend. So:

```text
max concurrent proxied requests ≈ worker_processes × worker_connections / 2
```

Serving a static file uses one. A WebSocket uses two, for as long as it lives.
A request served from the cache uses one. Mixed traffic sits somewhere in
between, which is exactly why this is a ceiling to stay well under rather than a
capacity plan.

## The real ceiling is file descriptors

Every connection is a file descriptor. So is every open log file, every cached
file being read, every upstream socket. **`worker_connections` cannot exceed what
the operating system will let a worker open**, and if you raise one without the
other, nginx fails at the OS limit and tells you so in the error log.

Three limits have to agree:

```nginx
worker_processes      auto;
worker_rlimit_nofile  8192;   # nginx raises RLIMIT_NOFILE for its workers

events {
    worker_connections  4096;  # must be <= worker_rlimit_nofile, with room to spare
}
```

```ini
# /etc/systemd/system/nginx.service.d/override.conf
# systemd caps the process before nginx ever gets to raise its own limit.
[Service]
LimitNOFILE=16384
```

The order of authority is: **systemd (or the container runtime) caps the
process → `worker_rlimit_nofile` raises nginx's own soft limit within that cap →
`worker_connections` must fit inside what is left.** Setting only the nginx ones
and wondering why nothing changed is the classic version of this mistake.

Leave headroom. `worker_connections` at exactly `worker_rlimit_nofile` leaves no
descriptors for log files, cache files or resolver sockets.

## Connection processing methods

The `use` directive selects how the worker asks the kernel which sockets are
ready. **You should not set it.** nginx picks the most efficient method available
for the platform automatically:

| Method | Platform | Notes |
|---|---|---|
| **`epoll`** | Linux 2.6+ | What you are using. Supports `EPOLLRDHUP` and, since nginx 1.11.3, `EPOLLEXCLUSIVE` on Linux 4.5+ |
| **`kqueue`** | FreeBSD 4.1+, OpenBSD 2.9+, NetBSD 2.0, macOS | The BSD equivalent |
| `/dev/poll` | Solaris 7 11/99+, HP/UX, IRIX, Tru64 | Legacy Unix |
| `eventport` | Solaris 10+ | Documented, but `/dev/poll` is recommended instead due to known issues |
| `select`, `poll` | everywhere | The portable fallbacks, used only where nothing better exists |

The single reason to know these names is reading someone else's config or an old
tuning post and recognising `use epoll;` as a no-op.

## The tuning knobs you will be told to set, and whether to

| Directive | Default | Verdict |
|---|---|---|
| `accept_mutex` | **`off`** | Leave it. It defaults to off since 1.11.3 because `EPOLLEXCLUSIVE` solved the thundering-herd problem it existed for. Turning it on now adds latency. |
| `multi_accept` | `off` | Leave it. Accepting all pending connections at once helps only under a very specific burst profile and can worsen latency fairness. |
| `worker_cpu_affinity` | — | Only on a dedicated, heavily loaded box where you have measured cache-locality gains. `auto` exists (since 1.9.10). Not on a shared or containerised host. |
| `worker_priority` | `0` | Almost never. Renicing nginx above other processes is a symptom that the box is doing too much. |
| `timer_resolution` | — | Reduces `gettimeofday()` calls by coarsening the timer. A micro-optimisation for a very high request rate; costs you log timestamp precision. |
| `thread_pool` | `default threads=32 max_queue=65536` | Relevant only with `aio threads` for large static files on slow storage (Phase 3). Irrelevant for a proxy. |
| `worker_shutdown_timeout` | — | **Genuinely useful** (since 1.11.11). Caps how long old workers linger after a reload — see page 05. |

**The pattern worth internalising:** most of these defaults were chosen *after*
the tuning advice about them was written. `accept_mutex` is the clearest case —
the config snippet telling you to enable it predates the kernel feature that made
it unnecessary.

## What actually limits you

In a Node deployment, nginx is almost never the bottleneck, and it is worth being
explicit about where the ceiling really sits:

| Suspected limit | Usually actually |
|---|---|
| `worker_connections` | file descriptors, or the backend's concurrency |
| nginx CPU | TLS handshakes (fix: session resumption, Phase 5) or gzip level (Phase 7) |
| nginx throughput | the Node event loop behind it |
| "nginx is slow" | one upstream timing out and `proxy_next_upstream` retrying it (Phase 8) |

Before touching any directive on this page, look at `$upstream_response_time` in
the access log (Phase 10). If it is large, nothing here will help.

## Gotchas

**Symptom:** `worker_connections are not enough` in the error log, often together
with `768 worker_connections are not enough while connecting to upstream`.
**Cause:** The worker's connection pool is exhausted — and note the message can
appear at half the load you expected, because each proxied request takes two
slots.
**Fix:** Raise `worker_connections`, and raise `worker_rlimit_nofile` with it.
If the number already looks generous, the real cause is usually connections
piling up behind a slow or hung upstream, not a sizing problem.

**Symptom:** You raised `worker_connections` and got
`accept4() failed (24: Too many open files)`.
**Cause:** The OS descriptor limit, not nginx's setting. `worker_connections`
promised something the kernel will not allow.
**Fix:** Raise `worker_rlimit_nofile`, and raise the service manager's
`LimitNOFILE` above it — systemd's cap wins over anything nginx asks for.

**Symptom:** `worker_processes auto` gives far more workers than the container's
CPU allocation.
**Cause:** `auto` counts the host's cores. A container limited to 0.5 CPU on a
64-core machine still gets 64 workers, each with its own memory and connection
pool.
**Fix:** Set `worker_processes` explicitly in containers, to match the CPU limit
you actually granted.

**Symptom:** A tuning guide's config made no measurable difference.
**Cause:** Most of it was already the default, or the bottleneck is the backend.
**Fix:** Measure first. `$upstream_response_time` versus `$request_time` in the
access log answers "is it nginx or is it Node?" in one query, and it is the only
number that should start a tuning exercise.

## Trade-off

**Every connection you allow is memory and a descriptor you have committed.**
Setting `worker_connections` very high does not make nginx faster; it makes nginx
willing to accept a queue it cannot serve, converting a fast rejection into a
slow timeout for everybody.

Sizing generously is still right — nginx handles idle connections cheaply, and
refusing a connection is worse than holding it. But "generous" means a
comfortable multiple of your peak, not the largest number that parses.

## Interview questions

**★ What do `worker_processes` and `worker_connections` control, and how do they
combine?**
`worker_processes` is how many worker processes run (`auto` = one per core);
`worker_connections` is the maximum simultaneous connections *per worker*. The
theoretical maximum is their product — but for a reverse proxy each request
consumes two connections, one to the client and one to the backend, so the
practical figure is about half that.

**★ Why is raising `worker_connections` alone not enough?**
Each connection is a file descriptor, and the OS limit binds first. You must also
raise `worker_rlimit_nofile`, and the service manager's own cap (systemd's
`LimitNOFILE`) above that — otherwise nginx fails with
`Too many open files` at the old limit.

**Should you set `use epoll;`?**
No. nginx already selects the most efficient method for the platform — `epoll` on
Linux, `kqueue` on BSD and macOS. The directive exists for unusual situations and
appearing in a config is a sign it was copied from an old tuning post.

**Why is `accept_mutex` off by default now?**
It existed to stop every worker waking on each new connection (the thundering
herd). Since nginx 1.11.3, `EPOLLEXCLUSIVE` on Linux 4.5+ solves that in the
kernel, so the mutex only adds accept latency. The default changed to `off`
accordingly.

**Your error log shows `worker_connections are not enough`. Is sizing the fix?**
Sometimes. First check whether connections are accumulating behind a slow or hung
upstream — a backend that stops responding fills the pool at any size. Raise the
limits, but treat the message as a symptom rather than a verdict.

**What is wrong with `worker_processes auto` inside a container?**
`auto` counts the host's CPUs, not the container's limit. On a 64-core host a
container capped at half a core still starts 64 workers, each with its own
memory and connection pool. Set the number explicitly there.

---

← Prev: [The master and its workers](02-master-and-workers.md) · Index: [Phase 0](README.md) · Next → [Signals and `nginx -s`](04-signals-and-control.md)
