---
title: "Nginx in front of the API"
sidebar_label: "13 · Nginx in front of the API"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [nginx `try_files`](https://nginx.org/en/docs/http/ngx_http_core_module.html#try_files),
> [WebSocket proxying](https://nginx.org/en/docs/http/websocket.html),
> [nginx `proxy_pass`](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass),
> [nginx `resolver`](https://nginx.org/en/docs/http/ngx_http_core_module.html#resolver),
> [the official `nginx` image documentation](https://hub.docker.com/_/nginx) and
> [Docker DNS services](https://docs.docker.com/engine/network/#dns-services).
> **No sandbox** — no console output on this page.

**One origin is the whole point.** The proxy exists so that the browser sees a
single host and port, which deletes CORS, makes the frontend's API URL a relative
path, and reduces the published surface of the stack to one port. Everything below
is what it takes to make that true without breaking WebSockets, client routing or
the API's idea of its own address.

## The configuration

```nginx
server {
    listen 80;
    server_name _;

    resolver 127.0.0.11 valid=10s ipv6=off;

    location /api/ {
        set $api http://${API_UPSTREAM};
        proxy_pass $api;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
    }

    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
}
```

In production the frontend is static files copied into this same image
([topic 12](12-react-vite-frontend.md)), so `location /` serves from disk rather
than proxying. In development it proxies to the Vite dev server instead — one
template, one variable.

## Four things a container changes

### 1 · The upstream name has to be resolved at request time

🔴 Covered in full on [topic 07](07-the-whole-stack/06-the-proxy.md), and it is the
single most common way this configuration breaks. `proxy_pass` consults a
`resolver` only when *"Parameter value can contain variables"* — with a literal
name, the documentation does not describe request-time re-resolution at all. Since
a recreated container *"joins the network under a different IP address but the same
name"*, the variable form plus `resolver 127.0.0.11` is what survives an API
rebuild. **"The embedded DNS server address is `127.0.0.11`"**, and there is no IPv6
equivalent — hence `ipv6=off`.

### 2 · Client-side routing needs a fallback

A React app that owns `/orders/42` has no file at that path. A hard refresh asks
nginx for it, nginx finds nothing, and the user gets a 404 on a page that works
fine when navigated to. `try_files` is the documented fix:

> *"Checks the existence of files in the specified order and uses the first found
> file for request processing … If none of the files were found, an internal
> redirect to the `uri` specified in the last parameter is made."*

So `try_files $uri $uri/ /index.html` serves the real file when there is one, and
otherwise hands `index.html` to the browser and lets the router take over.

⚠️ **The last parameter is what decides the behaviour.** The documentation's own
example ends `=404`, returning a code instead of redirecting — right for an assets
directory, wrong for an SPA. Getting these the wrong way round gives you either a
404 on refresh or an `index.html` served in place of a missing image.

### 3 · WebSockets need the hop-by-hop headers passed explicitly

The nginx documentation is precise about why: *"since the 'Upgrade' is a hop-by-hop
header, it is not passed from a client to proxied server"*, and *"in order for the
proxied server to know about the client's intention to switch a protocol to
WebSocket, these headers have to be passed explicitly"*. nginx has implemented the
tunnel *"since version 1.3.13"* when the upstream answers **101 Switching
Protocols**.

⚠️ **`proxy_http_version 1.1` is shown commented in the current documentation, with
the note `# before version 1.29.7`** — so on older nginx it is required and on
current versions it is not. If you are pinning an older tag, put it back.

🔴 **And the timeout nobody expects:** *"By default, the connection will be closed if
the proxied server does not transmit any data within 60 seconds."* A WebSocket that
is idle for a minute is dropped by the proxy, not by either endpoint — which
presents as a client that mysteriously reconnects every minute. The documented
answers are raising `proxy_read_timeout` or having the server *"periodically send
WebSocket ping frames to reset the timeout"*.

The docs' more careful form uses a `map` so `Connection` is `close` for ordinary
requests:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

⚠️ **`map` is only valid in the `http` context**, so it cannot live in a file
dropped into `conf.d/` — that file is already inside `http`. Either replace the
whole `nginx.conf`, or use the literal `"upgrade"` form above and accept that it is
the simplification.

### 4 · The API no longer knows its own address

Every request now arrives from the proxy's container IP, over plain HTTP, with the
proxy's hostname — so the API's logs show one client, `req.ip` is useless for rate
limiting, and any absolute URL it generates says `http`. The forwarded headers carry
the truth, which is why all four are set above.

🔴 **Setting the headers is only half of it — the application has to be told to
trust them.** In Express that is `app.set('trust proxy', …)`; without it the
framework has no reason to believe a header a client could have forged. Configure
it to trust exactly the hop in front of it, never blindly, since anything trusted
too broadly lets a client set its own `X-Forwarded-For`. The framework side belongs
to the [Express track](../../../expressjs/README.md); the container side is simply
that this problem did not exist before you added a proxy.

## Where TLS terminates

**Not here, usually.** In development there is no TLS at all — the whole stack is on
loopback. In production the sane default is that TLS terminates at whatever is
already in front: a cloud load balancer, an ingress, or Caddy or Traefik on the
host. Then this container keeps speaking plain HTTP on an internal network and
`X-Forwarded-Proto` is what tells the API the client used HTTPS.

Terminating here means certificates in the container: a volume for them, a renewal
process that can reload nginx (`SIGHUP` — *"changing configuration … starting new
worker processes with a new configuration, graceful shutdown of old worker
processes"*), and a rebuild story for every renewal. Worth it when this container
genuinely is the edge, not otherwise.

⚠️ **Whatever you choose, the API must never be published directly.** Two entry
points means two places to configure TLS, two places for headers to be wrong, and a
CORS problem the single-origin design was supposed to delete
([topic 07](07-the-whole-stack/03-the-wiring.md)).

## The container specifics, briefly

All established on [topic 07 · The proxy](07-the-whole-stack/06-the-proxy.md) and
not re-argued here: `STOPSIGNAL SIGQUIT` is already correct and must not be
overridden; `-g daemon off;` is why the container stays up; templates in
`/etc/nginx/templates/*.template` are `envsubst`-ed into `/etc/nginx/conf.d/`, which
**must be writable**; and `NGINX_ENVSUBST_FILTER` narrows substitution to your own
variables.

Deeper nginx material — location matching, caching, rate limiting, TLS
configuration — belongs to the [nginx track](../../../nginx/README.md); this page is
only the part that changes because there is a container involved.

## Gotchas

**Symptom:** A hard refresh on a client-side route returns 404; navigating there
works.
**Cause:** No SPA fallback. nginx looked for a file at that path and there is not
one.
**Fix:** `try_files $uri $uri/ /index.html` on the frontend location. Keep `=404` as
the last parameter for asset directories, where serving `index.html` for a missing
image is worse than a 404.

**Symptom:** WebSockets connect and then drop about once a minute.
**Cause:** nginx's documented default — *"the connection will be closed if the
proxied server does not transmit any data within 60 seconds"*.
**Fix:** Raise `proxy_read_timeout`, or send periodic ping frames from the server,
which the documentation offers as the alternative and which also detects dead peers.

**Symptom:** Rate limiting blocks everyone at once, and the logs show a single
client IP.
**Cause:** Every request now originates from the proxy. `X-Forwarded-For` carries the
real address, but the application is not configured to trust it.
**Fix:** Set the forwarded headers at the proxy *and* enable the framework's proxy
trust for exactly one hop. Trusting broadly is worse than not trusting at all,
because then the client controls the value.

**Symptom:** The API generates `http://` links on an HTTPS site.
**Cause:** TLS terminated upstream, so the request reaching the API really is plain
HTTP, and nothing told it otherwise.
**Fix:** `proxy_set_header X-Forwarded-Proto $scheme` plus the framework's trust
setting. This is the same missing-trust problem as the IP, in a different field.

## Interview questions

**★ What does putting nginx in front of the API actually buy you?**
One origin. The browser talks to a single host and port, so there is no
cross-origin request and CORS never has to be configured; the frontend's API URL
becomes the relative path `/api`, which is correct in every environment and lets one
built bundle ship everywhere; and the stack publishes exactly one port instead of
one per service. It also gives you a single place for TLS, headers and routing —
which is worth more than any individual feature, because it is one thing to get
right rather than several.

**★ Why does a hard refresh 404 on a client-side route, and what fixes it?**
Because the route exists only in the browser's router — there is no file on disk at
`/orders/42`, so nginx looks, finds nothing, and returns 404. `try_files $uri $uri/
/index.html` fixes it: the documentation describes it as checking each path in order
and, if none are found, performing an internal redirect to the URI in the last
parameter. The subtlety is that the last parameter can instead be `=404`, which
returns a code rather than redirecting — correct for assets, wrong for the app
shell, and mixing them up produces either broken refreshes or images that come back
as HTML.

**★ WebSockets work locally and fail through the proxy. Why?**
Because `Upgrade` and `Connection` are hop-by-hop headers, and nginx's documentation
says outright that they are *"not passed from a client to proxied server"* — so the
upstream never learns the client wanted to switch protocols, and never answers 101.
They have to be set explicitly with `proxy_set_header`. On nginx before 1.29.7 you
also need `proxy_http_version 1.1`. And once it works, the second surprise is the
60-second idle timeout: nginx closes a connection where the upstream has sent
nothing for a minute, so long-lived sockets need a raised `proxy_read_timeout` or
periodic pings.

**Where should TLS terminate?**
Usually not in this container. If there is already a load balancer, ingress or edge
proxy in front, terminate there and let this one speak plain HTTP on an internal
network, with `X-Forwarded-Proto` telling the API what the client actually used.
Terminating here means certificates on a volume, a renewal process that can reload
nginx with `SIGHUP`, and a story for every renewal — reasonable when this container
genuinely is the edge, unnecessary otherwise.

**What breaks in the API once it is behind a proxy?**
Its idea of the client and of itself. Every request arrives from the proxy's IP over
plain HTTP, so client IP, protocol and host are all wrong unless the forwarded
headers are set *and* the framework is configured to trust them. That trust setting
is the part people miss, and it has to be scoped to the actual number of hops:
trusting nothing breaks rate limiting and logging, trusting everything lets a client
forge its own address.

**Why can't the WebSocket `map` block live in `conf.d`?**
Because `map` is only valid in the `http` context, and a file in `conf.d/` is already
included *inside* `http` — so the directive has nowhere to go. Either replace
`nginx.conf` wholesale, or use the literal `Connection "upgrade"` form and accept
that non-WebSocket requests also carry it. The image's template mechanism does not
change this; it writes into `conf.d` too.

---

← Prev: [A React/Vite frontend](12-react-vite-frontend.md) · Index: [Phase 9](README.md) · Next → **Connecting from the host** *(not written yet)*
