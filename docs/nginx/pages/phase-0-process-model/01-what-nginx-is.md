---
title: "What nginx is"
sidebar_label: "01 · What nginx is"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against [nginx documentation index](https://nginx.org/en/docs/),
> [How nginx processes a request](https://nginx.org/en/docs/http/request_processing.html)
> and [ngx_core_module](https://nginx.org/en/docs/ngx_core_module.html).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**nginx is a single C program that can act as an HTTP server, a reverse proxy, a
load balancer, a cache, and a TCP/UDP proxy — configured, not programmed.**

Most introductions call it a "web server" and start with serving `index.html`.
For a MERN or PERN stack that is the least interesting thing it does. You already
have a server: Node. What you do not have is something in front of it.

## Why you need something in front of Node

Node can listen on port 443, serve your React build, terminate TLS and handle
every request itself. It is a genuine HTTP server, not a toy. So the question is
fair: why add a second program?

| Job | Node can | But nginx is |
|---|---|---|
| Serve a 200 KB JS bundle to 500 clients | yes | far faster, and does not occupy your event loop while doing it |
| Terminate TLS | yes | doing it in C, and can renew certificates without restarting your app |
| Survive a deploy | no | able to hold connections open while every Node process restarts |
| Run four copies of your app | with `cluster` | able to balance across them, across machines, with health tracking |
| Rate-limit an endpoint | yes, in middleware | rejecting the request before your event loop ever hears about it |
| Cache a response | with a library | caching in shared memory and on disk, per worker, with one directive |

The last row of that table is the real argument. **Every request nginx answers or
rejects is a request Node never has to schedule.** A Node process running a
single-threaded event loop is a scarce resource; nginx exists to spend it only on
things that need JavaScript.

## The one-sentence version

> **V8 runs your JavaScript, libuv does Node's waiting — and nginx does the
> waiting for everybody else.**

nginx is built entirely around not blocking. One worker process handles thousands
of simultaneous connections on one thread by never waiting on any of them, which
is the same architectural bet Node makes. That is why the two compose so well: a
slow client talking to nginx costs nginx almost nothing, and nginx keeps that
slow client away from Node.

## The five things it is

The documentation index splits nginx's modules into `http`, `stream` and `mail`.
In practice you will meet it wearing five hats:

| Hat | The module behind it | Where in this track |
|---|---|---|
| **Reverse proxy** — forward a request to another server and return its answer | `ngx_http_proxy_module` | Phase 4 |
| **Static file server** — read a file off disk and send it | `ngx_http_core_module` | Phase 3 |
| **TLS terminator** — speak HTTPS to the browser, plain HTTP to the app | `ngx_http_ssl_module` | Phase 5 |
| **Load balancer** — spread requests across a pool of backends | `ngx_http_upstream_module` | Phase 8 |
| **Cache** — store an upstream response and serve it again | `proxy_cache_*` | Phase 6 |

A sixth, `stream`, proxies raw TCP and UDP — Postgres, Redis, MQTT — and is the
one you may never need. It is covered where it earns a mention, not as its own
phase.

## What a minimal real config looks like

This is the whole shape of a fullstack deployment. Every directive in it gets its
own page later; the point here is that there is not much of it.

```nginx
# /etc/nginx/conf.d/app.conf
server {
    listen 80;
    server_name app.example.com;

    # 1. The React build, straight off disk.
    root /srv/app/dist;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 2. Everything under /api goes to Node.
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Two `location` blocks. One reads files, one forwards to Node. Everything else in
this track — TLS, caching, rate limits, load balancing, logging — is added on
top of exactly this skeleton.

Note what is *absent*: no `if`, no scripting, no request handler. **nginx
configuration is declarative.** You describe what should happen to a URL; you do
not write code that runs per request. That constraint is the reason nginx is fast
and the reason Phase 2 (how it picks a `location`) matters so much — the matching
rules are the program.

## What nginx is not

- **Not an application server.** It does not run your JavaScript. `njs` exists
  and is real, but it is glue, not a place to put business logic (Phase 11).
- **Not a firewall.** `allow`/`deny` and rate limits are useful controls, not a
  security boundary. A WAF is a different product.
- **Not stateful.** nginx has a cache and some shared-memory zones, and that is
  it. Sessions, queues and locks belong in Redis.
- **Not the only option.** Caddy gets TLS right with no config, Traefik does
  service discovery, a cloud load balancer removes the box entirely. Phase 11
  makes that comparison honestly.

## Apache, and why the comparison still gets made

The comparison is old but it explains the architecture, so it is worth thirty
seconds. Apache's traditional model dedicates a process or thread to each
connection. That is simple and it works, and it means 10,000 idle-but-open
connections cost 10,000 processes or threads.

nginx dedicates a *worker* to many connections at once and never blocks on any of
them. 10,000 idle connections cost 10,000 file descriptors and a bit of memory,
spread across a handful of workers. The C10k problem is what nginx was written
for, and the answer to "why is nginx fast?" is not "it is written in C" — it is
**"it does not allocate a thread per connection."** Page 02 is that mechanism in
full.

## Gotchas

**Symptom:** "We put nginx in front and it got *slower*."
**Cause:** Almost always an extra network hop with no benefit taken — no caching,
no static offload, no TLS termination — plus, on nginx 1.28 and older, a new TCP
connection to the backend for every single request because upstream keep-alive
was off by default.
**Fix:** Check your version first (`nginx -v`). On 1.29.7 and later keep-alive is
on by default; on older versions you must configure it. Then make nginx earn its
place: serve the static bundle from it, cache what is cacheable.

**Symptom:** Your team argues about whether to use nginx *or* Express.
**Cause:** Treating them as alternatives. They sit at different layers.
**Fix:** They are not alternatives and never were. nginx handles connections,
bytes, TLS and routing-by-URL. Express handles what your product means. Every
non-trivial deployment has both, or has nginx's job done by a cloud load balancer
instead.

**Symptom:** Someone suggests moving application logic into the nginx config.
**Cause:** Discovering `map`, `if` and `njs` and mistaking them for a programming
language.
**Fix:** They are not one, and configs that use them heavily become unmaintainable
and untestable. The rule that holds up: **if it needs a test, it belongs in
Node.**

**Symptom:** nginx serves your app fine locally, and the production box serves a
stale build after every deploy.
**Cause:** Caching headers, not nginx itself — `index.html` cached alongside the
hashed assets.
**Fix:** Phase 3. It is the single most common nginx bug in a React deployment and
it has nothing to do with nginx being complicated.

## Trade-off

**Adding nginx costs you a hop, a config file and a thing to operate.** It buys
you TLS termination, static offload, caching, rate limiting, load balancing and
graceful deploys — none of which you want to write in JavaScript.

For a hobby project on a single box with a cloud proxy already in front, skipping
nginx is a defensible choice. For anything that must survive a deploy without
dropping requests, it is not.

## Interview questions

**★ What is nginx, and why put it in front of a Node application?**
A C program that acts as HTTP server, reverse proxy, load balancer and cache,
configured declaratively. In front of Node it terminates TLS, serves static
assets without touching the event loop, spreads load across processes, caches
responses, absorbs slow clients, and holds connections open across deploys — all
work Node would otherwise do on its single JavaScript thread.

**★ Why is nginx fast?**
Not because it is written in C. Because it does not allocate a thread or process
per connection: a small number of workers each handle thousands of connections
with non-blocking I/O and an event loop, so an idle connection costs a file
descriptor rather than a thread stack.

**★ Is nginx a replacement for Express?**
No — they are different layers. nginx routes by URL and moves bytes; Express
expresses what your application means. A typical deployment runs both.

**Can Node serve static files and terminate TLS on its own?**
Yes, both. The reason not to is cost: static file serving and TLS handshakes
occupy the same single thread that runs your application logic, and a deploy that
restarts Node drops every connection it was holding.

**What is nginx *not* good at?**
Anything stateful or logical. It has no database, no session store, no job queue,
and its config is declarative by design. Business logic in nginx is untestable
and belongs in the application.

**Where does the `stream` module fit?**
It proxies raw TCP and UDP rather than HTTP — Postgres, Redis, MQTT, or SNI-based
routing without terminating TLS. Most fullstack deployments never need it.

---

← Index: [Phase 0](README.md) · Next → [The master and its workers](02-master-and-workers.md)
