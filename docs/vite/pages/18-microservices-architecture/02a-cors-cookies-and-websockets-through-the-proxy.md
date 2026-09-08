---
title: "The Dev Proxy Makes Every Request Same-Origin, Which Means It Hides Every CORS and Cookie Bug a Microservices Frontend Has Until the Day It Deploys Without the Proxy in Front of It"
sidebar_label: "02a · CORS, cookies and websockets"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against [Vite — Server Options](https://vite.dev/config/server-options.md)
> (`server.proxy`, `server.cors`, `server.origin`, `server.allowedHosts`, `server.hmr`),
> fetched 2026-09-08. Documentation-validated; **no sandbox run, no timings**. Target:
> **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session vite-t18

**Every request a proxied frontend makes to `/api/orders` looks, to the browser, like a
request to `localhost:5173` — the same origin the page itself was served from. No preflight,
no `Access-Control-Allow-Origin` check, no third-party cookie rules, because none of those
mechanisms activate for a same-origin request in the first place. That is exactly what makes
the dev proxy convenient and exactly what makes it dangerous: every CORS misconfiguration and
every cookie assumption a real multi-origin deployment will expose sits latent, invisible,
until the first time the same frontend talks to a service that is not sitting behind a proxy.**
This chunk covers the CORS and cookie half of that trap; websocket origin checks, the HMR
websocket collision, and the `vite build && vite preview` verification recipe continue in
[02a2](02a2-websocket-origin-checks-and-the-preview-verification-recipe.md).

## Why a proxied request never preflights

The browser decides whether a request is cross-origin, and therefore subject to CORS, by
comparing the scheme, host and port of the page against the scheme, host and port of the
request target — before the request goes anywhere. A `fetch('/api/orders/55')` issued from a
page at `http://localhost:5173` targets `http://localhost:5173/api/orders/55` as far as the
browser is concerned. It never sees `http://localhost:4002`; Vite's proxy layer only rewrites
the request **after** it leaves the browser, server-side, invisibly. So the browser applies
zero CORS logic: no preflight `OPTIONS` request, no `Origin` header check, no
`Access-Control-Allow-Origin` requirement on the response. The service on the other side of
the proxy can be completely unaware CORS exists and everything still works in dev.

## What breaks the day the built app calls the service directly

Once the frontend is built and deployed to its own origin — a CDN, a static host, its own
subdomain — and it calls a backend service at a *different* origin with no proxy in between,
every one of those dormant checks activates at once:

- **Missing `Access-Control-Allow-Origin`.** The service's response has to explicitly name
  (or wildcard) the frontend's origin, or the browser discards the response before JavaScript
  ever sees it — the request often still completes on the server side (visible in the
  service's own logs), which is precisely what makes this confusing: the backend team sees a
  successful request and the frontend team sees nothing.
- **Missing `Access-Control-Allow-Credentials`.** Any request sending cookies or an
  `Authorization` header cross-origin needs the response to carry
  `Access-Control-Allow-Credentials: true`, **and** the request's `Access-Control-Allow-Origin`
  can no longer be a wildcard `*` once credentials are involved — it has to name the exact
  origin.
- **A preflight the service never implemented.** Any request that is not a CORS "simple
  request" — a `PUT`, a `DELETE`, a `Content-Type: application/json` body, a custom header like
  `X-Request-Id` — triggers a preflight `OPTIONS` request first. A service that only ever
  received traffic through the dev proxy (or a production gateway that also strips
  cross-origin-ness) may never have had a route for `OPTIONS` at all, and the preflight itself
  fails before the real request is ever sent.

None of these are proxy bugs. They are real gaps in the service's own CORS configuration that
the proxy simply never exercised.

## `server.cors` — and the bank's own warning about `true`

Vite's dev server has its own CORS setting, separate from anything the *proxy target* does —
this governs whether Vite's own dev server responds to cross-origin requests **made directly
to it** (for example, another local dev server on a different port fetching from this one):

> *"Pass an [options object](https://github.com/expressjs/cors#configuration-options) to fine
> tune the behavior or `true` to allow any origin."*

Setting it to `true` is called out as a security risk — it allows any origin, unconditionally,
to make cross-origin requests to your dev server. That is a materially different exposure in a
microservices dev setup than in a single-app one: a dev server proxying four backend services
that also sets `server.cors: true` is effectively offering any page on the internet a path to
probe those backends through your machine while you have `vite dev` running. Scope it to an
explicit origin list rather than `true` whenever the dev server is reachable beyond
`localhost`.

## `server.origin` — where generated asset URLs point

> *"Defines the origin of the generated asset URLs during development."*

This exists for the backend-integration case (a traditional server rendering the HTML, Vite
only serving assets) — it is what makes asset `<script>`/`<link>` tags resolve to Vite's dev
server rather than relative to whatever origin served the HTML. It is not itself a CORS
setting, but it interacts with CORS by determining which origin those requests will look like
they're coming from.

## `server.allowedHosts` — and the leading-dot subdomain rule

`server.allowedHosts` controls which `Host` headers Vite's dev server will respond to at all —
this is a defence against DNS-rebinding-style attacks, evaluated **before** CORS even applies.
A plain string entry allows exactly that hostname; a string that **starts with a dot** allows
that domain **and all of its subdomains** — so `.example.com` covers `api.example.com`,
`app.example.com` and any other subdomain, not just the bare domain. In a microservices dev
setup where several services are exposed under sibling subdomains for realistic local testing,
the leading-dot form is the difference between allowlisting once and allowlisting every
subdomain by hand as services are added.

## Cookies: `SameSite`, third-party status, and what's genuinely unspecified

A cookie set by a backend service carries `SameSite=Lax` (the common default), `SameSite=None;
Secure`, or no attribute at all, plus its own `Domain` and `Path`. Through the dev proxy, every
one of those cookies is being set on a response that — from the browser's point of view —
came from `localhost:5173`, the same origin serving the page. It is therefore a **first-party**
cookie regardless of what `SameSite` says, because `SameSite` only restricts cross-*site*
sending and nothing about this request is cross-site as the browser sees it.

The instant that same service is called directly, from its own origin, in production, the
cookie it sets becomes a **third-party cookie** relative to the frontend's origin — and
`SameSite=Lax` (or the browsers that now default missing `SameSite` to `Lax`) will silently
stop sending it back on subsequent cross-site requests, `SameSite=None; Secure` becomes
mandatory just to have the cookie participate at all, and a `Domain` attribute scoped to the
service's own origin will never match a request made from the frontend's origin regardless of
`SameSite`.

🔴 **Vite's documentation does not describe this rewriting, and nothing here should be
presented as if it did.** `changeOrigin` is documented only as rewriting the outgoing `Host`
header on the request Vite sends *to* the target — nothing in Vite's server-options page states
that it rewrites the `Set-Cookie` header the target sends *back*, its `Domain` attribute, or
its `SameSite` attribute. Whether `http-proxy-3` performs any cookie-domain rewriting is not
settled by anything in this bank and is **left unspecified here** rather than guessed at. What
can be stated with confidence is only the *symptom*, verified against how `SameSite` and
third-party cookie rules work generally: a cookie flow that works through the proxy because
everything is same-origin can fail the moment the same two parties are genuinely cross-origin,
for reasons entirely independent of anything Vite's proxy does or doesn't rewrite.

Websocket proxying's own origin-check gap, the HMR websocket collision, and the
`vite build && vite preview` recipe that surfaces all of the above before a real deploy
continue in [02a2](02a2-websocket-origin-checks-and-the-preview-verification-recipe.md).

## Gotchas

**★ Symptom: everything works under `vite dev`; the first production deploy against real
service origins throws CORS errors in the console for requests that "worked yesterday."**
Cause: the dev proxy made every request same-origin, so no CORS check ever ran against the
real service; the service's own CORS configuration (or lack of one) was never exercised until
now. Fix: this is not a regression to bisect — it's a bug that was always there. Fix the
service's CORS headers (`Access-Control-Allow-Origin`, and `Access-Control-Allow-Credentials`
if cookies/auth headers are sent) and add an `OPTIONS` route if the service never had one, then
verify with `vite build && vite preview` before the next deploy, not after it.

**★ Symptom: a login cookie set by an auth service is present and working through
`localhost:5173`, and simply absent from every request the moment the frontend is deployed to
its own domain.** Cause: the cookie was first-party through the proxy (same apparent origin)
and becomes third-party the moment the two are genuinely different origins — `SameSite=Lax` or
a missing `SameSite` attribute (which browsers may default to `Lax`) stops it being sent
cross-site. Fix: the service has to set `SameSite=None; Secure` for a cookie that is
genuinely meant to be used cross-origin, and the `Domain` attribute has to actually cover the
origin making the request — neither of these is something Vite's proxy does or is documented
to do on the cookie's way back through it.

**★ Symptom: `server.cors: true` was set to "just make the CORS errors go away" during local
development, and stays in the config.** Cause: `true` allows any origin unconditionally — the
docs state this plainly — and it is easy to reach for as a blanket fix without registering that
it is a deliberate security trade-off, not a default-safe setting. Fix: use the options-object
form scoped to the actual origins that need to reach the dev server, and treat `server.cors:
true` as something that should never survive a code review, doubly so when the dev server is
proxying live backend services rather than just serving static assets.

**★ Symptom: a request that needs a preflight (`PUT`, a JSON body, a custom header) works
through the dev proxy and fails — not with a CORS error, but with a 404 or 405 — once deployed
directly against the service.** Cause: the preflight `OPTIONS` request never happened through
the proxy (no CORS logic runs on a same-origin request), so a service that has no route
handling `OPTIONS` never had that gap noticed. Fix: the service needs an actual `OPTIONS`
handler (most backend CORS middleware adds this automatically once configured) — this is
service-side work, not something any Vite setting can paper over, and it is exactly the kind
of gap [02a2](02a2-websocket-origin-checks-and-the-preview-verification-recipe.md)'s
`vite build && vite preview` recipe is meant to surface before a real user does.

## Interview questions

**★ Why does a request through Vite's dev proxy never trigger a CORS preflight, even when the
target service has strict CORS rules?** Because the browser decides cross-origin status by
comparing the page's origin to the request's *target URL as the browser sees it* — which is
still `localhost:5173`, since the proxy rewrites the request only after it leaves the browser,
server-side. The browser never learns the real target is a different origin, so none of the
CORS machinery (preflight, `Access-Control-Allow-Origin` checks, credential rules) ever
activates.

**★ What three things typically break the first time a proxied frontend calls its backend
service directly, without the proxy in front?** A missing `Access-Control-Allow-Origin` on the
service's response (the browser discards a response the server thinks succeeded); a missing
`Access-Control-Allow-Credentials` for any request carrying cookies or an auth header
cross-origin (which also forbids a wildcard `Access-Control-Allow-Origin`); and a preflight
`OPTIONS` request the service never implemented, for any request that isn't a CORS "simple
request" — a `PUT`/`DELETE`, a JSON body, or a custom header.

**★ Why is `server.cors: true` called out specifically as a risk, and does it have anything to
do with the proxy target's own CORS config?** It's a separate setting entirely — it governs
whether Vite's *own* dev server answers cross-origin requests made directly to it, not what the
proxied backend does. The docs state `true` "allows any origin," unconditionally — in a setup
proxying live backend services, that means any page on the internet that can reach your dev
server gets a path through to those services.

**★ Why does a cookie that works fine through the dev proxy stop being sent once the frontend
is deployed to a different origin than the service that set it?** Through the proxy, the
cookie is set on a response the browser considers same-origin (everything looks like it came
from `localhost:5173`), so it's a first-party cookie regardless of its `SameSite` value. Once
frontend and service are genuinely different origins, the same cookie is third-party, and
`SameSite=Lax` (or a missing `SameSite`, which some browsers default to `Lax`) stops it being
sent on cross-site requests — it needs `SameSite=None; Secure` to keep working, and Vite's docs
don't state anything about the proxy rewriting `Set-Cookie` on the way back, so that part of
the behaviour is genuinely undocumented, not just unfamiliar.

**★ What does the leading dot in a `server.allowedHosts` entry do, and why does it matter more
in a microservices dev setup than a single-app one?** A plain hostname entry allows exactly
that host; a string starting with `.` (like `.example.com`) allows that domain **and all its
subdomains**. In a setup where several services are exposed under sibling subdomains for
realistic local testing, the leading-dot form avoids having to add a new allowlist entry every
time a service moves to a new subdomain.

---

{/* FOOTER */}
