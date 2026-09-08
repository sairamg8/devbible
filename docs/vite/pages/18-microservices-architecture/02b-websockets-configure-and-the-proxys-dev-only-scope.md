---
title: "The Proxy's Remaining Surface — ws for Websockets, configure for Everything http-proxy-3 Exposes That Vite Doesn't — Only Ever Applies to vite dev, Never to the Build"
sidebar_label: "02b · Websockets, configure and dev-only scope"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against [Vite — Server Options](https://vite.dev/config/server-options.md)
> and [`http-proxy-3`](https://github.com/sagemathinc/http-proxy-3#options), fetched 2026-09-08.
> Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+
> / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session vite-t18

**[02](02-the-dev-proxy-against-many-services.md) covered the core routing mechanism —
`target`, `changeOrigin`, `rewrite`, a `RegExp` key. This chunk finishes the object: `ws` for
websocket upgrades, `configure` for the `http-proxy-3` surface Vite's own docs don't spell out,
a complete four-service `vite.config.ts`, and the fact that decides whether any of it survives
deployment — `server.proxy` exists only in `vite dev`.**

## `ws: true` — websockets and socket.io

A plain proxy entry only handles HTTP request/response. A service pushing notifications over a
websocket, or using socket.io (which upgrades an HTTP long-poll connection to a websocket),
needs the proxy to forward the **upgrade** handshake too:

```ts
// vite.config.ts — websocket service
export default {
  server: {
    proxy: {
      '/ws/notifications': {
        target: 'ws://localhost:4004',
        ws: true,
      },
    },
  },
}
```

Note the `target` scheme is `ws://`, not `http://` — match the scheme to the protocol the
target actually speaks. Socket.io in particular needs `ws: true` even though its initial
handshake is an ordinary HTTP request, because it upgrades to a websocket on the same
connection shortly after.

## `configure` — the escape hatch into `http-proxy-3` itself

Vite's docs describe it in one line:

> *"`configure` hands you the proxy instance for advanced customisation."*

`configure` is called once per proxy entry with the underlying `http-proxy-3` instance, letting
you attach listeners for anything the declarative options don't cover — logging every proxied
request, injecting a header conditionally, reacting to proxy errors:

```ts
// vite.config.ts — configure hook, logging proxy errors
export default {
  server: {
    proxy: {
      '/api/search': {
        target: 'http://localhost:4003',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.error('[proxy:search]', err.message);
          });
        },
      },
    },
  },
}
```

Anything reachable through `configure` — a `bypass` function to conditionally skip proxying
per-request, custom header injection, request/response rewriting beyond `rewrite` — is
**`http-proxy-3` surface, not something Vite's own docs describe**. Vite's server-options page
documents `target`, `changeOrigin`, `rewrite`, `ws` and `configure` itself; anything past that
is `http-proxy-3`'s own option set, referenced only by the link Vite gives
(`github.com/sagemathinc/http-proxy-3#options`), and should be verified against that project's
own documentation before relying on it, not assumed to be part of Vite's contract.

## Putting it together — four services, one `vite.config.ts`

```ts
// vite.config.ts — users (plain HTTP), orders (rewrite), search (configure hook),
// notifications (websocket)
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api/users': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
      '/api/orders': {
        target: 'http://localhost:4002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/orders/, ''),
      },
      '/api/search': {
        target: 'http://localhost:4003',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.error('[proxy:search]', err.message);
          });
        },
      },
      '/ws/notifications': {
        target: 'ws://localhost:4004',
        ws: true,
      },
    },
  },
});
```

Four distinct backend services, four ports, and the browser sees exactly one origin —
`localhost:5173` — for all of them. This is the entire value proposition of `server.proxy` in a
microservices frontend: it collapses N origins into 1 for the duration of `vite dev`, and that
collapse is what makes same-origin `fetch` calls, cookies and CORS-free requests work without
the frontend code knowing services are split at all.

## The proxy is a `vite dev` feature, and only that

Everything above runs inside Vite's own dev server process. `vite build` produces static
assets and (optionally) a manifest — nothing in that output represents `server.proxy` in any
form, because there is no server process left to intercept anything. `vite preview` starts a
small static file server to sanity-check the production build locally, but it is **not** the
dev server: it does not read `server.proxy` either, so a request that worked flawlessly under
`vite dev` will fail against `vite preview` unless something else is proxying it.

The consequence for a microservices frontend: `server.proxy` is not documentation of your
production request routing, and it never becomes one. Anything you rely on it for — path
prefixes, `changeOrigin`, websocket forwarding — has to be reproduced by a real piece of
production infrastructure: an API gateway, an nginx config, a service mesh ingress. That
infrastructure is configured entirely outside Vite, by hand, and nothing checks that it stays
in sync with `vite.config.ts` as the proxy rules evolve. The only reliable way to catch drift
before it reaches production is to stop trusting the dev proxy for verification once the build
is real:

```sh
# build the production artefact, then serve it with vite preview,
# pointed at the real (or a realistic staging) service origin —
# vite preview does not apply server.proxy, so this exercises the
# same code path a deployed frontend actually takes
vite build
vite preview
```

If a request that depended on the dev proxy's rewriting or header behaviour breaks under
`vite preview`, that is the proxy's protection disappearing exactly where it always was going
to — in the artefact that ships. `vite preview` still doesn't have a gateway in front of it
either, so this only proves the frontend code itself doesn't secretly depend on proxy-only
behaviour (relative paths that assumed same-origin, cookies that assumed same-origin) — it does
not prove the *real* gateway is configured correctly, which is a separate, infrastructure-side
check.

## Gotchas

**★ Symptom: a websocket connection to a proxied service never opens; it either falls straight
back to HTTP polling (socket.io) or the browser reports a failed upgrade.** Cause: `ws: true`
was left off the proxy entry, so `http-proxy-3` never forwards the `Upgrade: websocket` header
and the handshake fails or downgrades silently. Fix: add `ws: true` to any proxy entry whose
target speaks websockets, including socket.io targets — socket.io's initial request looks like
plain HTTP, which makes it easy to assume the plain HTTP proxy config is sufficient.

**★ Symptom: `configure`'s `bypass`-style tricks or header injection worked under one Vite
version and silently stopped, or behave differently, after an upgrade.** Cause: this surface
belongs to `http-proxy-3`, which Vite bundles/depends on as a separate package with its own
version and its own changelog — a Vite minor bump can carry an `http-proxy-3` bump with it, and
Vite's own release notes will not mention it because it is not Vite's own option. Fix: pin and
check `http-proxy-3`'s changelog directly when something in a `configure` hook changes
behaviour; do not assume Vite's changelog covers it.

**★ Symptom: this whole proxy config works flawlessly through `yarn dev`, and then the same
frontend, built and deployed, cannot reach a single backend service.** Cause: `server.proxy`
is a `vite dev`-only server middleware. It has no representation in the output of `vite build`
— no config file, no manifest entry, nothing — and `vite preview` **does not read it either**.
Fix: never treat `server.proxy` as documentation of your production routing. The real
production equivalent is a real gateway (nginx, an API gateway, a service mesh ingress) that
you configure separately and that has to reproduce every prefix, rewrite and websocket rule
you wrote here — run `vite build && vite preview` against the real service origins as a
sanity check before trusting the deploy, and treat CORS/cookie failures at that point as the
subject of [02a](02a-cors-cookies-and-websockets-through-the-proxy.md), not this page.

## Interview questions

**★ Why does a websocket-serving proxy entry need `ws: true` when an HTTP proxy entry
doesn't?** Because the initial websocket handshake is an HTTP request carrying an `Upgrade`
header, and `http-proxy-3` does not forward that upgrade by default — `ws: true` tells it to.
Without it, the handshake either fails outright or, for something like socket.io that has an
HTTP long-poll fallback, silently downgrades to polling instead of upgrading, which can look
like the feature "half-working" rather than obviously broken.

**★ What can `configure` do that the declarative proxy options (`target`, `changeOrigin`,
`rewrite`, `ws`) can't, and where is that documented?** `configure` hands you the raw
`http-proxy-3` instance, so anything that library exposes — event listeners for errors and
responses, a `bypass` function, arbitrary header rewriting — becomes reachable. None of that is
described on Vite's own server-options page; Vite documents only that `configure` exists and
gives you the instance. Relying on anything past that means reading `http-proxy-3`'s own
documentation, not Vite's.

**★ Why is `server.proxy` the wrong place to look for how requests get routed in production?**
Because it is dev-server-only middleware — it exists nowhere in the output of `vite build`,
and `vite preview` (which serves that build output) does not apply it either. Anything a team
depends on the proxy for in dev — path routing, prefix stripping, websocket forwarding — has to
be reproduced by a real piece of production infrastructure (gateway, mesh ingress), and that
reproduction is a manual, easy-to-forget step, not something Vite carries forward automatically.

**★ What does running `vite build && vite preview` against a real service origin actually
prove, and what does it not prove?** It proves the frontend's own code doesn't secretly depend
on proxy-only behaviour — relative paths that only worked because everything was same-origin
through the dev proxy, cookies or headers that assumed same-origin. It does not prove the real
production gateway is configured correctly, because `vite preview` has no gateway in front of
it either; that verification is a separate, infrastructure-side check.

---

{/* FOOTER */}
