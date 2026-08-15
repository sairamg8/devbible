---
title: "Phase 0 — The nginx process model"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: nginx 1.30.x stable — 1.30.4 as of August 2026.**
> Every directive, default and signal on these pages is quoted from the nginx
> documentation for the current release and the page names its source. **Nothing
> here was executed**: this track has no sandbox, so where a real run would have
> produced a console block, the explanation carries the documented behaviour
> instead. See the no-new-sandboxes rule on the [Contents page](../../../README.md).

nginx is not a request handler you write code into. It is a small C program with
a fixed lifecycle — a master, some workers, and a set of signals — and that
lifecycle is what you actually operate. Every "I changed the config and nothing
happened", every "why is there still an old worker running", every "the reload
dropped my WebSockets" is a question from this phase.

Ten pages, in order. Pages 02 and 05 are the load-bearing ones.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[What nginx is](01-what-nginx-is.md)** | <span className="db-tier t-understand">Understand</span> | A reverse proxy that also serves files — and why that ordering matters for a Node stack |
| 02 | **[The master and its workers](02-master-and-workers.md)** | <span className="db-tier t-master">Master</span> | One privileged process that owns nothing but configuration, and N unprivileged ones that do all the work |
| 03 | **[Sizing the workers](03-sizing-the-workers.md)** | <span className="db-tier t-understand">Understand</span> | `worker_processes`, `worker_connections`, and why the real ceiling is file descriptors |
| 04 | **[Signals and `nginx -s`](04-signals-and-control.md)** | <span className="db-tier t-master">Master</span> | Six signals to the master, and the four `-s` words that send them for you |
| 05 | **[Reload, restart and binary upgrade](05-reload-and-upgrade.md)** | <span className="db-tier t-master">Master</span> | Why a reload drops no requests, what it cannot change, and swapping the binary under live traffic |
| 06 | **[`nginx -t`, `-T` and `-V`](06-testing-the-config.md)** | <span className="db-tier t-master">Master</span> | Test before you reload, dump the config that actually applies, and find out what your binary can do |
| 07 | **[Installing nginx](07-installing.md)** | <span className="db-tier t-understand">Understand</span> | Distro package vs the nginx.org repo vs the container image, and why their file layouts disagree |
| 08 | **[Modules, static and dynamic](08-modules.md)** | <span className="db-tier t-understand">Understand</span> | Compiled in at build time or `load_module`d at run time — and how to tell what you have |
| 09 | **[Mainline, stable and NGINX Plus](09-versions-and-plus.md)** | <span className="db-tier t-understand">Understand</span> | What the two branches promise, and the directives in the docs that you do not have |
| 10 | **[The forks](10-forks.md)** | <span className="db-tier t-when">When Needed</span> | OpenResty, Tengine, Angie, freenginx — what each exists for |

## Coverage

The syllabus lists fourteen topics for this phase. Four pairs are merged because
you would never read one without the other; nothing is dropped.

| Syllabus topic | Page |
|---|---|
| What nginx is: event-driven reverse proxy, HTTP server, load balancer | 01 |
| Master process and worker processes | 02 |
| The event loop per worker | 02 |
| `worker_processes auto`, `worker_connections`, the theoretical max | 03 |
| Connection processing methods — `epoll`, `kqueue` | 03 |
| Signals and `nginx -s` | 04 |
| A reload is not a restart | 05 |
| Binary upgrade on the fly | 05 |
| `nginx -t`, `-T` and `-V` | 06 |
| Installing: distro vs nginx.org repo vs container | 07 |
| Static vs dynamic modules | 08 |
| Mainline vs stable | 09 |
| nginx Open Source vs NGINX Plus | 09 |
| The forks and derivatives | 10 |

## Phase gate

Move on to Phase 1 when you can explain **what happens between typing
`nginx -s reload` and the new config serving traffic** — and say which of your
in-flight requests get dropped.

The answer is none, if you did it right. If you cannot say why, reread page 05.
Phase 11 (deployment) assumes it completely.

## Where this connects

- **Phase 1 — The configuration language** is what the master re-reads on a
  reload. This phase is the machinery; Phase 1 is the file it reads.
- **Phase 4 — Reverse proxy** is where the worker's event loop stops being
  trivia: `proxy_buffering` exists to free a worker sooner.
- **Phase 10 — Logs** picks up `USR1` and log reopening from page 04.
- **Phase 11 — Deployment** turns page 05 into a deploy strategy, and page 07
  into a Dockerfile.

---

← Syllabus: [Part 1 — How nginx works](../../syllabus/01-how-nginx-works.md) · Start → [What nginx is](01-what-nginx-is.md)
