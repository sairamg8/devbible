---
title: "The proxy"
sidebar_label: "06 · The proxy"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [the official `nginx` image documentation](https://hub.docker.com/_/nginx),
> [the nginx image Dockerfile and entrypoint scripts](https://github.com/nginxinc/docker-nginx),
> [nginx `proxy_pass`](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass),
> [nginx `resolver`](https://nginx.org/en/docs/http/ngx_http_core_module.html#resolver),
> [controlling nginx](https://nginx.org/en/docs/control.html) and
> [Docker DNS services](https://docs.docker.com/engine/network/#dns-services).
> **No sandbox** — no console output on this page.

**The proxy is what turns five services into one website, and it is the only
service whose configuration lives outside the compose file.** That extra file is
small, and every line in it is answering a container-specific question.

## The service

```yaml
  proxy:
    image: nginx:1.29-alpine
    environment:
      API_UPSTREAM: api:3000
      WEB_UPSTREAM: web:80
      NGINX_ENVSUBST_FILTER: "^(API|WEB)_UPSTREAM$$"
    volumes:
      - ./proxy/default.conf.template:/etc/nginx/templates/default.conf.template:ro
    ports:
      - "127.0.0.1:8080:80"
    depends_on:
      api:
        condition: service_healthy
      web:
        condition: service_started
    networks: [edge]
    restart: unless-stopped
```

## What the nginx image already does for you

Its Dockerfile ends with `ENTRYPOINT ["/docker-entrypoint.sh"]`, `EXPOSE 80`,
**`STOPSIGNAL SIGQUIT`** and `CMD ["nginx", "-g", "daemon off;"]`, and it copies
four scripts into `/docker-entrypoint.d/` that the entrypoint runs before nginx
starts. Three consequences:

- 🔴 **`STOPSIGNAL SIGQUIT` is already the right signal.** nginx's own signal
  table reads **QUIT = graceful shutdown** and **TERM/INT = fast shutdown**, so
  the image deliberately overrides the container default of `SIGTERM`. **Do not
  set `stop_signal:` on this service** — you would be downgrading a graceful stop
  to an abrupt one.
- **`-g daemon off;` is why the container stays up.** The image documentation
  warns that if you write your own `CMD`, *"be sure to include `-g daemon off;`"* —
  without it nginx forks into the background and PID 1 exits immediately, which
  presents as a container that starts and stops with no error
  ([Phase 10 · PID 1](../../phase-10-production/01-pid-1/README.md)).
- **`20-envsubst-on-templates.sh`** is what makes the template below work.

### The template mechanism, precisely

Files matching `/etc/nginx/templates/*.template` are run through `envsubst` and
written to `/etc/nginx/conf.d/`, which the shipped `nginx.conf` includes. Four
environment variables tune it — `NGINX_ENVSUBST_TEMPLATE_DIR`,
`NGINX_ENVSUBST_TEMPLATE_SUFFIX`, `NGINX_ENVSUBST_OUTPUT_DIR` and
`NGINX_ENVSUBST_FILTER` — with the defaults above.

🔴 **The substitution list is built from the container's own environment.** The
script enumerates every variable name in the environment, keeps the ones matching
`NGINX_ENVSUBST_FILTER`, and passes exactly those to `envsubst` as an explicit
shell-format list. So nginx's own `$host`, `$scheme` and `$proxy_add_x_forwarded_for`
are left alone — *unless* a container environment variable happens to share their
name, which is precisely the collision `NGINX_ENVSUBST_FILTER` exists to prevent.

Setting the filter is two seconds of work and removes a whole class of "the
config came out mangled" bugs:

```yaml
      NGINX_ENVSUBST_FILTER: "^(API|WEB)_UPSTREAM$$"
```

⚠️ **The `$$` is a Compose escape, not a typo.** The regex needs a literal `$` as
its end anchor, and a single `$` would be interpolated away by Compose.

⚠️ **The output directory must be writable.** The script checks, logs
`ERROR: … is not writable` and gives up quietly. That is what bites a hardened
`read_only: true` proxy — the fix is a `tmpfs` at `/etc/nginx/conf.d` (plus
`/var/cache/nginx` and `/var/run`), not abandoning either feature
([Phase 10 · Hardening](../../phase-10-production/10-hardening/README.md)).

## The template

```nginx
server {
    listen 80;
    server_name _;

    resolver 127.0.0.11 valid=10s ipv6=off;

    location /api/ {
        set $api http://${API_UPSTREAM};
        proxy_pass $api;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        set $web http://${WEB_UPSTREAM};
        proxy_pass $web;
        proxy_set_header Host $host;
    }
}
```

### Why the upstream goes through a variable

🔴 **This is the container-specific line.** The `proxy_pass` documentation says
that when the value contains variables and the address is a domain name, *"the
name is searched among the described server groups, and, if not found, is
determined using a `resolver`"* — the resolver being consulted at request time.
Without a variable, no resolver is involved.

That matters because of a fact established in phase 8: a recreated container
*"joins the network under a different IP address but the same name"*. Rebuild the
API, and the name still resolves — but only if something is resolving it. The
variable form plus a `resolver` is what keeps the proxy pointing at the new
container instead of at an address that no longer exists.

⚠️ **What the documentation does *not* say is when a literal name is re-resolved.**
So this page does not claim that nginx caches DNS forever, or for any particular
duration. It claims the documented thing: the variable form consults the resolver,
and that is the form to use when the upstream is a container.

The resolver address is documented too — **"The embedded DNS server address is
`127.0.0.11`"**, used by every container on a user-defined network. `valid=10s`
overrides the answer's TTL, and `ipv6=off` stops nginx failing lookups on a
network with no IPv6.

### No path rewriting, on purpose

`proxy_pass $api;` has **no URI component after the host**, and the documentation
is explicit about what that means: *"If `proxy_pass` is specified without a URI,
the request URI is passed to the server in the same form as sent by a client"*. So
`/api/users` arrives at the API as `/api/users`, and the API mounts its routes
under `/api`.

That is a deliberate simplification. Stripping the prefix in the proxy means the
API's own URLs, its redirects and its generated links all disagree with what the
browser sees, and every one of those becomes a bug you fix twice.

## Gotchas

**Symptom:** The proxy container starts and immediately exits, with no error.
**Cause:** A custom `CMD` that dropped `-g daemon off;`. nginx daemonised, PID 1
returned, and the container did what a container does when PID 1 exits.
**Fix:** Keep the image's `CMD`, or include `-g daemon off;` in your own — the
image documentation says so explicitly.

**Symptom:** The generated config has empty values where nginx variables should
be.
**Cause:** `envsubst` substituted a name the config wanted nginx to expand,
because a container environment variable shared that name and no
`NGINX_ENVSUBST_FILTER` narrowed the list.
**Fix:** Set the filter to a regex matching only your own variables. Remember the
`$$` escape so Compose does not eat the anchor.

**Symptom:** After rebuilding the API, the proxy returns 502 until it is
restarted.
**Cause:** The recreated container has the same name and a new IP, and the
`proxy_pass` value contained no variable, so no resolver was consulted at request
time.
**Fix:** `set $api http://${API_UPSTREAM};` plus `resolver 127.0.0.11;`. Restarting
the proxy is the workaround people ship instead, and it turns every API deploy
into a two-container dance.

**Symptom:** A hardened proxy with `read_only: true` ignores its template.
**Cause:** The entrypoint could not write to `/etc/nginx/conf.d`, logged
`ERROR: … is not writable`, and continued.
**Fix:** Mount a `tmpfs` at `/etc/nginx/conf.d`, and at `/var/cache/nginx` and
`/var/run`. Read the entrypoint's own output — it says exactly what it could not
do.

## Interview questions

**★ Why does the reverse proxy exist at all in a development stack?**
Because it makes one origin. The browser talks to a single host and port, the
proxy routes `/api/` to the API and everything else to the frontend, and CORS
never enters the project. It also means the frontend's API URL can be the relative
path `/api`, which is the only value that is correct in every environment — and
since Vite bakes that value into the bundle at build time, "correct everywhere" is
worth a lot. Finally it collapses the published surface to one port, so nothing
else has to be reachable from the host.

**★ You rebuild the API and the proxy starts returning 502. Why, and what is the
fix?**
The recreated container keeps its service name but gets a new IP — the Compose
documentation says as much. nginx only consults a `resolver` when the `proxy_pass`
value contains variables; with a literal name, the documentation does not
describe request-time re-resolution at all. So the proxy is still aimed at an
address that no longer exists. The fix is to put the upstream in a variable and
configure `resolver 127.0.0.11`, Docker's documented embedded DNS address. The
common workaround — restarting the proxy after every deploy — treats the symptom
and makes deploys a two-step dance.

**★ Why not strip the `/api` prefix in the proxy?**
Because the API then has two views of its own URLs: the one it generates and the
one the browser sees. Redirects, `Location` headers, cookie paths and any link the
API builds all come out wrong, and each is fixed separately. Passing the URI
through unchanged — which is what `proxy_pass` does when the value has no URI
component after the host — keeps one set of paths for everybody, at the cost of
mounting the API's routes under `/api`.

**Why does the image set `STOPSIGNAL SIGQUIT` instead of using the default?**
Because nginx's signal table maps QUIT to a graceful shutdown and TERM to a fast
one — the opposite of the container convention, where `SIGTERM` is the polite
signal. The image corrects for that so `docker compose stop` drains connections
instead of cutting them. The practical rule is not to set `stop_signal:` on this
service: an override written out of habit turns a graceful stop into an abrupt
one, and nothing in the logs will tell you.

**What do `valid=10s` and `ipv6=off` do on the `resolver` line?**
`valid=` overrides how long nginx caches an answer — by default it uses the
response's own TTL, which for the embedded DNS server is not something you
control. `ipv6=off` stops nginx also looking up AAAA records; on a network with no
IPv6 those lookups fail, and the documentation notes nginx looks up both families
by default. Neither is required, and both remove a category of surprise.

---

← Prev: [The API and the frontend](05-the-api-and-the-frontend.md) · Index: [Phase 9](../README.md) · Next → [The boot, and proving it](07-the-boot-and-proving-it.md)
