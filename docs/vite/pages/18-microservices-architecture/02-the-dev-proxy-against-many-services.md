---
title: "server.proxy Is What Makes Forty Backend Services Look Like One Origin at localhost:5173, and Every One of Its Options Exists Because Some Real Deployment Shape Needed It"
sidebar_label: "02 · The dev proxy across services"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against [Vite — Server Options](https://vite.dev/config/server-options.md)
> and [`http-proxy-3`](https://github.com/sagemathinc/http-proxy-3#options), fetched 2026-09-08.
> Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+
> / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session vite-t18

**A microservices frontend talks to a user service, an orders service, a search service and a
websocket notification service — four different origins, four different ports, in production
probably four different subdomains behind a gateway. The browser only ever needs to see one:
`localhost:5173`. `server.proxy` is the dev-time mechanism that makes that true, and it is not
a toy — Vite states outright that it extends `http-proxy-3`, so every option below is a real
`http-proxy-3` option Vite is passing through, not a Vite invention.** This chunk covers the
core routing mechanism — the two config forms, `target`, `changeOrigin`, `rewrite`, and a
`RegExp` key. Websockets, the `configure` escape hatch, a worked four-service config and the
proxy's dev-only scope continue in
[02b](02b-websockets-configure-and-the-proxys-dev-only-scope.md).

## The two forms, and what `server.proxy` actually is

Vite's docs give the type precisely:

> *"Configure custom proxy rules for the dev server. Expects an object of `{ key: options }`
> pairs."*

> *"Extends [`http-proxy-3`](https://github.com/sagemathinc/http-proxy-3#options)."*

The type is `Record<string, string | ProxyOptions>`. The **string** form names a target
directly and nothing else:

```ts
// vite.config.ts — string shorthand
export default {
  server: {
    proxy: {
      '/api': 'http://localhost:4567',
    },
  },
}
```

Any request whose path starts with `/api` is forwarded to `http://localhost:4567`, path
included — `GET /api/users/42` becomes `GET http://localhost:4567/api/users/42`. That is the
whole behaviour of the string form: no header rewriting, no path stripping, no websocket
support. It is correct when the target's own routes are already mounted under `/api` and you
are proxying to a **single** service, on `localhost`, over plain HTTP.

The **object** form is `ProxyOptions`, which is where every real deployment shape gets
handled:

```ts
// vite.config.ts — object form, one service
export default {
  server: {
    proxy: {
      '/api/users': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
    },
  },
}
```

## `target` — where the request actually goes

`target` is the origin `http-proxy-3` forwards to. It is not optional in the object form and
it is always an origin (`scheme://host:port`), never a path — the path comes from the
incoming request (optionally rewritten) and is appended to `target`.

## `changeOrigin` — the header it rewrites, precisely

Vite's own description is one line:

> *"`changeOrigin` modifies the origin header on the proxied request."*

Concretely: without it, the proxied request still carries the `Host` header the browser sent —
`Host: localhost:5173` — even though the TCP connection is now going to `localhost:4001`. Many
backends (anything doing virtual-host routing, anything validating `Host` against an allowlist,
anything behind its own reverse proxy that routes on `Host`) reject or misroute that. With
`changeOrigin: true`, `http-proxy-3` rewrites the outgoing `Host` header to match `target`, so
the service sees a request that looks like it arrived at `localhost:4001` directly. For a
microservices setup where every one of the four services independently validates or routes on
`Host`, `changeOrigin: true` is close to mandatory — set it on every entry unless you have
confirmed the target doesn't care.

## `rewrite` — stripping the prefix, and when not to

Path prefixes exist for **routing at the proxy**, not because the backend service wants them in
its own route table. The idiom:

```ts
// vite.config.ts — strip /api/orders before forwarding
export default {
  server: {
    proxy: {
      '/api/orders': {
        target: 'http://localhost:4002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/orders/, ''),
      },
    },
  },
}
```

`GET /api/orders/55` arrives at the frontend, the prefix `/api/orders` is routed on, then
stripped, and the orders service receives `GET /55` — its own routes never need to know the
prefix existed. This is the right call whenever the prefix is purely a dev-proxy routing key
and the target service was written standalone (which is the normal case for an independently
deployable microservice — it should not have `/orders` baked into its route table just to
satisfy one frontend's proxy layout).

**When NOT to strip:** if the target is itself proxied by something in production that expects
the prefix — for example a real API gateway that forwards `/api/orders/*` to the orders service
*without* stripping, so the service's own routes are already written expecting `/api/orders/55`.
Stripping in dev and not stripping in production means the dev-only code path and the
production code path hit different routes on the same service, which is exactly the kind of
divergence that passes locally and 404s in staging. The rule: match whatever the **real**
gateway does, not whatever is convenient to type.

## String key vs `RegExp` key

The proxy object's keys are not limited to path-prefix strings — a key can be a `RegExp`,
matched against the request path:

```ts
// vite.config.ts — RegExp key, one entry covering two similarly-shaped routes
export default {
  server: {
    proxy: {
      '^/api/(users|profiles)': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
}
```

Use a `RegExp` key when one service legitimately owns more than one top-level path segment and
writing out every prefix as a separate string key would just be repeating the same `target`
and `changeOrigin` four times.

The next chunk, [02b](02b-websockets-configure-and-the-proxys-dev-only-scope.md), builds a
complete `vite.config.ts` combining these idioms across four real services, adds `ws: true` and
the `configure` hook, and closes with the fact that decides whether any of this survives
deployment: `server.proxy` exists only in `vite dev`.

## Gotchas

**★ Symptom: two services both respond, but the wrong one, or one service silently swallows
another's requests.** Cause: the docs do not state a match order between overlapping proxy
keys — `/api` and `/api/orders` as separate keys is exactly the shape where this bites, since
every `/api/orders/*` request also matches `/api`. Fix: **this ordering is not documented by
Vite** — write it explicitly as uncertain in your own notes rather than relying on it, and
structure the config so it doesn't matter: put the most specific prefix first if your mental
model assumes first-match-wins, but do not depend on that assumption holding across a Vite
upgrade. Prefer non-overlapping prefixes (`/api/orders`, `/api/users`, never also a bare
`/api`) so there is nothing for match order to resolve.

**★ Symptom: proxied request works from the browser's `fetch`, but a raw `curl` to the same
service on its own port behaves differently — different `Host`, different rejected/accepted
status.** Cause: `changeOrigin` only takes effect through the proxy; hitting the service
directly on its own port never goes through Vite's proxy layer at all, so nothing rewrites
anything. Fix: this is expected, not a bug — but it means testing "does the service accept
this request" has to go through `localhost:5173`, not the service's own port, if you want to
reproduce what the frontend actually experiences.

**★ Symptom: 404 from the target service on every request, even though the service is up and
the path looks right in the browser's network tab.** Cause: the browser's network tab shows
the *original* request path (`/api/orders/55`), not the rewritten one — if `rewrite` strips
`/api/orders` and the service's own routes still expect `/api/orders/55`, the service 404s on
`/55` and nothing in the browser tells you the path was rewritten. Fix: check the target
service's own access log (or, lacking one, add a `configure` hook — covered in
[02b](02b-websockets-configure-and-the-proxys-dev-only-scope.md) — that logs the rewritten
path) rather than trusting the browser's devtools network panel, which only ever shows what
the browser sent, not what the proxy forwarded.

## Interview questions

**★ What is `server.proxy`, and what is it built on?** It is Vite dev server configuration —
`Record<string, string | ProxyOptions>` — that intercepts requests matching a path prefix or
`RegExp` and forwards them to another origin during `vite dev` only. Vite's own docs state it
"extends `http-proxy-3`", meaning the object form's options (`target`, `changeOrigin`,
`rewrite`, `ws`, `configure`, and anything reachable through `configure`) are largely
`http-proxy-3`'s own option surface, not a Vite invention.

**★ What does `changeOrigin: true` actually change, mechanically?** It rewrites the outgoing
`Host` header on the proxied request to match `target`'s host, instead of forwarding the
browser's original `Host: localhost:5173`. It matters for any backend that validates or routes
on `Host` — which is common for services behind their own reverse proxy or doing virtual-host
routing.

**★ Why strip a path prefix with `rewrite` in some cases and not others?** The prefix exists to
route at the proxy layer; whether the target service's own routes expect it depends on whether
something in production (a real gateway) also strips it before forwarding. Strip when the
service was written standalone and the prefix is purely a dev-proxy routing key; don't strip
when a real gateway forwards the prefix intact and the service's routes are written expecting
it — the dev config has to match whatever the production gateway actually does, or the two
environments exercise different routes on the same service.

**★ Does `server.proxy` say anything about which key wins when two prefixes overlap, like
`/api` and `/api/orders` as separate keys?** No — Vite's server-options documentation does not
state a match order for overlapping proxy keys, and that has to be treated as unspecified
rather than assumed. The defensive answer is to avoid overlapping prefixes in the first place
(never define both a broad `/api` and a narrower `/api/orders`), and if a broader prefix truly
must exist, put the most specific key first as a defensive convention while explicitly not
relying on that ordering surviving a Vite upgrade.

---

← [The BFF and browser fan-out](01a-the-bff-and-the-browser-fan-out.md) · [Vite overview](../../README.md) · Next → [CORS, cookies and websockets](02a-cors-cookies-and-websockets-through-the-proxy.md)
