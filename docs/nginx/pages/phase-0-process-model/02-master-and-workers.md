---
title: "The master and its workers"
sidebar_label: "02 · The master and its workers"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against [ngx_core_module](https://nginx.org/en/docs/ngx_core_module.html)
> (`user`, `worker_processes`, `master_process`, `daemon`, `pid`),
> [Controlling nginx](https://nginx.org/en/docs/control.html) and
> [Connection processing methods](https://nginx.org/en/docs/events.html).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**nginx runs as one master process that does no work, and N worker processes that
do all of it. Understanding which is which explains privileges, reloads, shared
state, and every "why are there still old nginx processes?" question.**

## The division of labour

| | Master | Worker |
|---|---|---|
| How many | exactly one | `worker_processes`, usually one per CPU core |
| Runs as | **`root`** (usually) | the unprivileged `user`, default `nobody nobody` |
| Reads the config | **yes** | no — it is handed the parsed result |
| Binds the listening sockets | **yes** | no — it inherits the already-open sockets |
| Accepts and serves requests | **never** | **always** |
| Opens log files | yes | writes to the inherited descriptors |
| Survives a reload | yes | no — new ones are started, old ones retire |

The master's entire job is **supervision**: parse configuration, open privileged
resources, spawn workers, and pass signals along. It never touches a request. If
a worker crashes, the master starts a replacement.

## Why the master needs root and the workers do not

Binding to ports below 1024 — 80 and 443 — requires privilege on Unix. The master
does that binding once, at startup, while it is still `root`, and then hands the
open file descriptors down to workers that have already dropped to an
unprivileged user:

```nginx
# /etc/nginx/nginx.conf
user  www-data;          # workers run as this; default is `nobody nobody`
worker_processes  auto;
pid   /run/nginx.pid;
```

This is the reason a request-handling bug in nginx is not automatically a root
compromise: **the code that parses attacker-controlled bytes never runs as
root.** It is also why `user` in the config affects file *reading* — your
`root /srv/app/dist` must be readable by `www-data`, not by `root`.

`worker_processes auto` was added in 1.3.8 / 1.2.5. Note that the documented
default is **`worker_processes 1;`** — `auto` is what distribution packages set
for you, not what nginx does on its own.

## What a worker actually does

One worker is one process, running one thread, running one event loop. That loop
is a thin wrapper around the kernel's readiness API — `epoll` on Linux, `kqueue`
on BSD and macOS — and it looks like this:

1. Ask the kernel: *which of my thousands of sockets are ready to read or write?*
2. The kernel returns the handful that are.
3. For each one, do the small amount of work that is now possible without
   blocking — read a request line, write part of a response, finish a TLS
   handshake.
4. Go back to step 1.

Nothing in that loop ever waits. A client on a slow mobile connection is not a
worker sitting still; it is a socket that has not appeared in step 2 yet. That is
the whole trick, and it is exactly the bet Node's event loop makes.

**The consequence to remember: one blocked worker blocks every connection it is
holding.** nginx's own code is careful never to block, which is why the few
things that genuinely can — reading a cold file off a slow disk — have a
`thread_pool` escape hatch (`aio threads`), and why `njs` code doing something
expensive is a real hazard rather than a style objection.

## Connections are not requests

`worker_connections` (documented default **512**) counts *connections*, not
requests, and each proxied request costs **two**: one from the client to nginx,
one from nginx to the backend.

The theoretical ceiling for a proxying server is therefore:

```text
max concurrent proxied requests  ≈  worker_processes × worker_connections / 2
```

Page 03 works through what that number is really limited by. The point here is
structural: **a worker's capacity is a pool of file descriptors, not a pool of
threads.**

## How the processes appear on the box

A running nginx is a small process tree — one master, N workers, and (if caching
is configured) a **cache manager** and a **cache loader**:

```text
nginx: master process /usr/sbin/nginx -g daemon on; master_process on;
 ├─ nginx: worker process
 ├─ nginx: worker process
 ├─ nginx: worker process
 ├─ nginx: worker process
 ├─ nginx: cache manager process      # only when proxy_cache_path is set
 └─ nginx: cache loader process       # short-lived, at startup
```

The master rewrites its own process title to include the `-g` directives it was
started with, which is why `ps` output shows that suffix. The cache manager
enforces `max_size` and `inactive`; the cache loader reads an existing on-disk
cache into shared memory at startup and then exits (Phase 6).

Two directives control this shape, and both exist for containers:

| Directive | Default | Why you would change it |
|---|---|---|
| `daemon` | `on` | **`daemon off;`** in a container, so nginx stays in the foreground as PID 1's child instead of forking away and letting the container exit |
| `master_process` | `on` | `off` runs a single process with no workers — a debugging mode, never production |

The official nginx container image already sets `daemon off;`, which is why its
`CMD` is `nginx -g "daemon off;"` rather than plain `nginx` (Phase 11).

## What workers do and do not share

Each worker is a separate process with its own memory. That has a consequence
people trip over constantly:

**By default, workers count things independently.** A `limit_req` of 10 requests
per second, with 4 workers, is not automatically a global limit — it depends on
which worker accepts the connection. The fix is a **shared memory zone**, which
is why so many directives take a `zone=name:size` parameter:

```nginx
# One zone, shared by every worker.
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

upstream app {
    zone app 64k;        # upstream state shared across workers
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
}
```

Anything that must be consistent across workers — rate limit counters, upstream
health state, the cache index, SSL session cache — lives in one of these zones.
Anything without a zone is per-worker. This single fact explains a surprising
amount of "my limit lets through four times what I set".

## Gotchas

**Symptom:** `bind() to 0.0.0.0:80 failed (13: Permission denied)` when starting
nginx.
**Cause:** nginx was started as a non-root user, so the master could not bind a
privileged port.
**Fix:** Start it through its service manager (which starts the master as root),
or use a port above 1024, or grant `CAP_NET_BIND_SERVICE`. Do not "fix" it by
setting `user root;` — that puts the request-handling code back in the privileged
position the split exists to avoid.

**Symptom:** `403 Forbidden` on a static file that definitely exists and is
readable.
**Cause:** It is readable by *you*, not by the worker's user. The worker runs as
`www-data`/`nginx`/`nobody`, not as the account that deployed the files — and
every directory on the path needs execute permission too.
**Fix:** Check the whole path, not just the file. On a distro with SELinux
enforcing, also check the file's context; a build copied into a non-standard
directory will be denied regardless of mode bits.

**Symptom:** After a reload, `ps` still shows old worker processes, sometimes for
a long time.
**Cause:** That is correct behaviour, not a leak. Old workers stop accepting new
connections but keep serving the requests they already have — and a WebSocket or
an SSE stream can hold one open for hours.
**Fix:** Nothing, usually. If you need them gone, `worker_shutdown_timeout` puts
a ceiling on it, at the cost of cutting those connections. See page 05.

**Symptom:** Your rate limit allows roughly `worker_processes` times what you
configured.
**Cause:** Counting per worker instead of in a shared zone.
**Fix:** Every limiting directive that supports `zone=` needs one, and one zone
name must be shared by all the places that should count together.

**Symptom:** The container exits immediately with status 0 after starting nginx.
**Cause:** `daemon on` (the default) — nginx forked into the background, the
foreground process ended, so the container considered its job done.
**Fix:** `daemon off;`, or use the official image's `CMD`, which already does it.

## Trade-off

**The master/worker split costs you shared state.** Anything counted globally
needs an explicitly configured shared memory zone, sized by hand, and a zone that
fills up starts rejecting rather than growing.

What it buys is worth it: privilege separation, a supervisor that restarts a
crashed worker, reloads that do not drop connections, and linear use of every CPU
core. Every alternative design gives up at least one of those.

## Interview questions

**★ What is the difference between the nginx master process and a worker
process?**
The master reads the configuration, binds the listening sockets, opens log files
and manages workers — it never handles a request. Workers inherit the already-open
sockets, drop to an unprivileged user, and serve every request on a non-blocking
event loop. Usually one worker per CPU core.

**★ Why does the master run as root when the workers do not?**
Only the master needs privilege, and only briefly: to bind ports 80 and 443 and
open log files. Workers are dropped to the unprivileged `user` before they handle
any traffic, so the code that parses attacker-controlled input is never
privileged.

**★ How does one worker handle thousands of connections on one thread?**
By never blocking. It asks the kernel (via `epoll`/`kqueue`) which sockets are
ready, does the work that is possible on those without waiting, and loops. An
idle connection costs a file descriptor and some memory, not a thread.

**Why do four workers not automatically give you a global rate limit?**
Because each worker is a separate process with its own memory, so each counts
independently. Directives that must agree across workers need a shared memory
zone — `limit_req_zone … zone=name:size`, `upstream { zone … }` — and without one
the effective limit is roughly the configured limit times the worker count.

**What are the cache manager and cache loader processes?**
Extra children the master spawns when `proxy_cache_path` is configured. The
loader reads an existing on-disk cache into shared memory at startup and then
exits; the manager runs continuously, evicting entries to honour `max_size` and
`inactive`.

**Why does the official nginx container image run `nginx -g "daemon off;"`?**
Because `daemon` defaults to `on`, and a backgrounding process would let the
container's foreground command exit — taking the container with it. `daemon off;`
keeps the master in the foreground so the container's lifetime matches nginx's.

**What does `worker_processes auto` do, and is it the default?**
It sets one worker per available CPU core (supported since 1.3.8/1.2.5). It is
**not** nginx's documented default, which is `worker_processes 1;` — `auto` is
what distribution packages and container images configure on your behalf.

---

← Prev: [What nginx is](01-what-nginx-is.md) · Index: [Phase 0](README.md) · Next → [Sizing the workers](03-sizing-the-workers.md)
