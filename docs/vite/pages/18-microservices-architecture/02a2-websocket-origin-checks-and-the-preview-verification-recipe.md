---
title: "Vite Documents That It Does Not Check WebSocket Origins Before Proxying, the HMR Connection Is a WebSocket Too and Can Be Shadowed by Your Own Proxy Rules, and vite preview Is the Only Local Way to Prove Any of This Before a Real Deploy"
sidebar_label: "02a2 · Websocket origin checks & the preview recipe"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against [Vite — Server Options](https://vite.dev/config/server-options.md)
> (`server.proxy`, `server.hmr`), fetched 2026-09-08. Documentation-validated; **no sandbox
> run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session vite-t18

**[02a](02a-cors-cookies-and-websockets-through-the-proxy.md) covered the CORS and cookie half
of what the dev proxy hides. This half covers the two websocket-specific gaps — Vite's own
documented statement that it does not check websocket origins before proxying, and the HMR
connection's exposure to a proxy config that's too broad — and closes with the one concrete
way to catch all of it, on both halves, before a real deploy: build the app and run
`vite preview` against a genuinely different origin.**

## Websocket proxying: `ws: true` and the origin-check gap

`ws: true` (covered mechanically in
[02b](02b-websockets-configure-and-the-proxys-dev-only-scope.md)) forwards the `Upgrade`
handshake to the target. The bank carries one security-relevant line about this, verbatim, and
it deserves to be a headline gotcha rather than a footnote:

> *"Vite does not check the origin of WebSocket requests before proxying."*

Concretely: any page, anywhere, that can get a browser to open a websocket connection to your
dev server will have that connection proxied through to the target service exactly as if it
came from your own app — Vite performs no origin check on its side before forwarding the
upgrade. Combined with `server.cors: true` or a permissive `server.allowedHosts`, this widens
the exposure of a dev server proxying live backend services considerably. The companion line —

> *"Exercise caution using `rewriteWsOrigin` as it can leave the proxying open to CSRF
> attacks."*

— says the same class of thing from the other direction: an option that exists specifically to
rewrite the origin on a proxied websocket request is, by the docs' own description, a CSRF
risk if used carelessly. Neither of these is a "someday" concern for a microservices dev setup
specifically, because a dev server proxying four real backend services is a materially more
valuable target than a dev server serving one app with no live backend behind it.

## The HMR websocket, and the proxy that swallows `/`

Vite's own Hot Module Replacement connection is *itself* a websocket, opened from the browser
back to the dev server. If a proxy entry is written broadly enough to match the root path —
something like a catch-all `'/': 'http://localhost:4000'` sitting alongside the service-specific
entries — it can intercept or interfere with the HMR websocket's own connection, since that
connection is also just a request to the dev server's own origin. `server.hmr` exists to
configure this connection independently:

```ts
// vite.config.ts — server.hmr, disabling only the error overlay
export default {
  server: {
    hmr: {
      overlay: false,
    },
  },
}
```

> *"Set `server.hmr.overlay` to `false` to disable the server error overlay."*

The documented option surface here is narrow — `boolean | { overlay?: boolean }` — so beyond
turning HMR off entirely or disabling its overlay, the practical defence against a proxy
config swallowing the HMR connection is the same one that applies to the match-ordering
gotcha on [02](02-the-dev-proxy-against-many-services.md): keep proxy keys scoped to real API
prefixes (`/api/*`, `/ws/*`) and never introduce a bare `/` or an overly broad catch-all key
that could shadow Vite's own internal routes.

## Prove it before you deploy: `vite build && vite preview` against a real origin

Because none of the CORS, cookie or websocket-origin behaviour on either half of this page is
exercised while `server.proxy` is doing its job, the only way to find these bugs before a real
deployment is to stop using the dev proxy and point the built app at a real service origin:

```sh
# vite preview does NOT apply server.proxy — this serves the actual
# build output and forces every request to be genuinely cross-origin
# against whatever origin the service is reachable at
vite build
vite preview
```

Run this against a service reachable at its **real** origin (staging, or a locally-run
instance bound to a different port with CORS actually configured) rather than `localhost` —
the whole point is to force the browser to treat the request as cross-origin the way
production will, which `vite dev`'s proxy never does no matter how the target is configured.
Anything that breaks here — a missing `Access-Control-Allow-Origin`, a cookie that stops
arriving, a preflight the service 404s on — is a bug the dev proxy was hiding, not a bug
`vite preview` introduced.

**What this recipe does not prove, and why that matters.** `vite preview` is a small static
file server for the built assets — it has no gateway, no reverse proxy, nothing standing in
front of it. Running `vite preview` against a real service origin proves the *frontend code
itself* doesn't secretly depend on proxy-only behaviour — relative-path assumptions, cookie
assumptions, missing credential flags. It does not prove that whatever production
infrastructure sits in front of the real deployment (a gateway, an nginx config, a mesh
ingress) is itself configured correctly — that's a separate, infrastructure-side check, and
treating a clean `vite preview` run as clearance for the whole deployment is its own way to get
surprised in production.

## Gotchas

**★ Symptom: a websocket connection from an unrelated page (or a malicious one) gets proxied
straight through to a live backend service while `vite dev` is running.** Cause: the docs state
outright that "Vite does not check the origin of WebSocket requests before proxying" — there is
no origin check to bypass, because none exists. Fix: this is a property of the dev server, not
a misconfiguration to patch — the mitigation is scoping `server.allowedHosts` and
`server.cors` tightly, not binding the dev server beyond `localhost` unless necessary, and
treating `rewriteWsOrigin` (an `http-proxy-3` option, documented by Vite only as a CSRF risk if
used carelessly) with the caution the docs explicitly ask for.

**★ Symptom: the HMR overlay disconnects, reconnects in a loop, or stops updating, and it
started right after a new proxy entry was added.** Cause: a proxy key broad enough to match
the dev server's own root or internal paths (a catch-all `/` entry is the classic shape) can
intercept the HMR websocket's own connection, since that connection is itself just a request
to the dev server's own origin. Fix: keep every proxy key scoped to a real API or websocket
prefix (`/api/*`, `/ws/*`) and never introduce a bare `/` proxy entry; `server.hmr.overlay:
false` only silences the symptom (the overlay), it does not fix a proxy config that is
shadowing the HMR connection itself.

**★ Symptom: a clean `vite build && vite preview` run gets treated as sign-off that the
deployment will work, and it still breaks in production.** Cause: `vite preview` has no
gateway or reverse proxy in front of it — it only proves the frontend's own code doesn't
secretly depend on proxy-only behaviour (relative paths, cookies, credential flags that only
worked because everything was same-origin through the dev proxy). It says nothing about
whether the *real* production gateway, load balancer or mesh ingress is itself configured
correctly. Fix: treat the `vite preview` check as necessary and not sufficient — it clears the
frontend's own assumptions; the infrastructure in front of the real deployment still needs its
own verification, separately.

## Interview questions

**★ What does the documented `"Vite does not check the origin of WebSocket requests before
proxying"` line mean in practice, and what is the mitigation?** It means there is no origin
verification step on Vite's side before a websocket upgrade request gets forwarded to a proxy
target — any page that can open a websocket to your dev server gets that connection proxied
through as if it were legitimate. There's no config flag that adds the missing check; the
mitigation is restricting what can reach the dev server in the first place —
`server.allowedHosts`, `server.cors`, not binding beyond `localhost` — and treating
`rewriteWsOrigin` with the caution its own documentation asks for, since it's called out as a
potential CSRF vector.

**★ How can a `server.proxy` entry interfere with Vite's own HMR connection, and how do you
avoid it?** HMR runs over its own websocket back to the dev server's own origin — a proxy key
broad enough to match the root path (a catch-all `/` entry) can intercept that connection the
same way it would intercept any other request to that origin. The fix is scoping every proxy
key to a real, specific prefix (`/api/*`, `/ws/*`) rather than ever adding a broad or root-level
catch-all key; `server.hmr` itself only configures the connection's own behaviour (like
disabling the overlay), it doesn't defend against a proxy config shadowing it.

**★ Why does `vite preview` matter specifically for catching CORS and cookie bugs, when
`vite dev` already runs the "real" app — and what does a clean `vite preview` run *not* prove?**
`vite dev`'s proxy makes every request same-origin, so it never exercises real cross-origin
behaviour no matter how correctly the proxy itself is configured. `vite preview` serves the
actual production build and does **not** apply `server.proxy`, so a request to a genuinely
different-origin service goes through the browser's real CORS and cookie logic — the only way
to find these bugs locally before a real deployment does. What it does *not* prove is that the
real production gateway or ingress is configured correctly, because `vite preview` has no
gateway in front of it either; that's a separate, infrastructure-side check.

---

← [CORS, cookies and websockets](02a-cors-cookies-and-websockets-through-the-proxy.md) · [Vite overview](../../README.md) · Next → [Websockets, configure and dev-only scope](02b-websockets-configure-and-the-proxys-dev-only-scope.md)
