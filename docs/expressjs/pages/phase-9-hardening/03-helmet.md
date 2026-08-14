---
title: "Helmet"
sidebar_label: "03 · Helmet"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

**Helmet mounts secure default headers. APIs may disable noisy browser-only policies; still review each toggle.**

> Verified: 2026-08-14 — **no sandbox run**. Helmet is a **third-party package**, listed
> under [Resources → Middleware](https://expressjs.com/en/resources/middleware/); Express
> ships no security headers of its own. The one header Express *does* control is
> `X-Powered-By`, which is **on by default** and turned off with
> `app.disable('x-powered-by')`
> ([application settings](https://expressjs.com/en/5x/api/application/),
> [Phase 0](../phase-0-express-basics/05-application-settings.md)) — Helmet also removes it.
> The headers themselves are **browser** mechanisms specified elsewhere (CSP, COOP, COEP
> and friends are W3C/WHATWG work, documented on
> [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)), which is the basis for
> the API-versus-page argument below: a header a JSON client never reads does nothing.
>
> **This page also covers syllabus topic 7, "security headers beyond defaults"** —
> COOP/COEP awareness and which headers an API-only app can skip. That row had no page of
> its own; it belongs here, and the phase README's Coverage table records the merge.

```js
import helmet from 'helmet';
app.use(helmet());
```

CSP matters more for HTML apps than pure JSON APIs. Do not treat Helmet as a full security program.

## Which headers actually do something for you

The useful question is not "did I mount Helmet?" but **"who reads these?"** A header
is instructions to a browser; a JSON API's clients are frequently not browsers.

| Header | Protects | Worth it for a JSON API? |
|---|---|---|
| **`Strict-Transport-Security`** | Downgrade to HTTP | **Yes** — applies to any browser-reachable host |
| **`X-Content-Type-Options: nosniff`** | MIME sniffing turning JSON into script | **Yes** — cheap, no downside |
| **`Content-Security-Policy`** | XSS in *rendered HTML* | Mostly no — but see below |
| `X-Frame-Options` / `frame-ancestors` | Clickjacking of *pages* | No — a JSON response cannot be framed usefully |
| `Referrer-Policy` | URL leakage from *page* navigation | Marginal |
| **`X-Powered-By` removal** | Fingerprinting | **Yes**, and it is one Express setting |

The nuance on CSP: it is close to useless for JSON responses that no browser
renders — **but if your API ever serves HTML, including an error page, a Swagger
UI, or a redirect landing page, it is rendering.** `default-src 'none'` on API
responses is a cheap way to say "nothing here should ever execute", and it costs
nothing to send.

**Do not disable a header because a tutorial said APIs do not need them.** Decide
per header, and write down why — that note is what stops the next person
re-enabling or re-disabling it blindly.

## COOP and COEP — what they are for

Two headers people encounter without context, usually because a browser feature
refused to work.

- **`Cross-Origin-Opener-Policy` (COOP)** severs the `window.opener` relationship
  with cross-origin pages, so a page you open — or that opens you — cannot reach
  into your window object.
- **`Cross-Origin-Embedder-Policy` (COEP)** requires every cross-origin subresource
  to explicitly opt in to being embedded.

Together they put a document in a **cross-origin isolated** state, which is what
browsers require before granting `SharedArrayBuffer` and high-resolution timers —
the mitigation surface that followed Spectre.

The practical position for this stack:

- **A JSON API needs neither.** They constrain document and window behaviour; there
  is no document.
- **An HTML app needs them only if it wants cross-origin isolation**, and enabling
  COEP is genuinely disruptive: every third-party image, font, script and iframe
  must send `Cross-Origin-Resource-Policy` or `Access-Control-Allow-Origin`, or it
  simply stops loading.

Knowing they exist is the syllabus bar here. Reach for them the day a feature
demands cross-origin isolation, not before.

## Helmet is a floor, not a program

Everything Helmet sets is a **header** — instructions to a browser about how to
treat a response. That means it cannot touch:

- authentication or authorisation ([Phase 8](../phase-8-validation-authz/README.md));
- injection, which happens in your handlers and queries;
- ownership checks, rate limits, secrets management, dependency vulnerabilities.

A green header-scanner score and an IDOR in the same codebase is an entirely normal
state of affairs. **Headers are the cheapest layer to get right and the least
valuable to get right** — do them in one line and spend the attention elsewhere.

## Trade-off

`app.use(helmet())` is one line for a sensible default set, and for a JSON API the
defaults are close to free — most of what it sets is inert for non-browser clients
and harmless for browser ones.

The cost appears when you serve HTML: Helmet's CSP default is strict enough to
break inline scripts and styles, third-party widgets, and analytics. The tempting
fix — `contentSecurityPolicy: false` — removes the one header that actually
mitigates XSS. The correct fix is a policy tuned to your app, which is real work
and worth it *for HTML*.

**Mount it, keep the defaults, and tune CSP deliberately if you render pages.**
Disabling a header should be a decision with a comment, not a way to make an error
go away.

## Gotchas

**Symptom:** The front end breaks after adding Helmet — inline scripts blocked  
**Cause:** The default CSP  
**Fix:** Tune the policy for your app. Turning CSP off removes the mitigation entirely

**Symptom:** A header scanner reports missing headers despite Helmet being mounted  
**Cause:** Mounted after the routes, so responses were already sent  
**Fix:** Mount it near the top, before routers

**Symptom:** `X-Powered-By: Express` still present  
**Cause:** Something re-enabled it, or a proxy adds its own branding header  
**Fix:** `app.disable('x-powered-by')`, and check the whole response chain — Express is
not the only thing writing headers

**Symptom:** Images and fonts stop loading after enabling COEP  
**Cause:** COEP requires every cross-origin subresource to opt in  
**Fix:** Do not enable it unless you need cross-origin isolation; then fix each resource

**Symptom:** HSTS locked a subdomain out over plain HTTP  
**Cause:** `includeSubDomains` with a long `max-age`  
**Fix:** Start with a short max-age, confirm every subdomain serves TLS, then raise it.
HSTS is remembered by browsers and hard to walk back

**Symptom:** A team disabled several headers "because it is an API", then added a docs UI  
**Cause:** The API-only assumption stopped being true  
**Fix:** Re-review the toggles whenever the app starts rendering anything

## Interview questions

**★ What problem does Helmet address?**  
Common missing security headers (and related defaults), not auth or injection by itself.

**★ Which headers matter for a pure JSON API, and which do not?**  
Worth it: HSTS and `nosniff` — plus removing `X-Powered-By`, which is an Express
setting. Largely inert: `X-Frame-Options`, `Referrer-Policy`, and CSP *unless* the app
ever serves HTML — an error page or a docs UI counts.

**★ What do COOP and COEP do, and when would you need them?**  
COOP severs the opener relationship with cross-origin windows; COEP requires
cross-origin subresources to opt in. Together they produce cross-origin isolation,
which browsers require for `SharedArrayBuffer` and high-resolution timers. A JSON API
needs neither, and COEP is disruptive — every third-party resource must opt in.

**Why is a perfect header score not much of a security signal?**  
Because headers are instructions to browsers. They cannot address authentication,
authorisation, injection, ownership checks or secrets. A green scanner result and an
IDOR routinely coexist.

**What is the wrong way to fix a CSP that breaks your front end?**  
`contentSecurityPolicy: false`. That removes the one header in the set that actually
mitigates XSS. Tune the policy instead.


---

← Prev: [CORS](02-cors.md) · Next → [Rate limiting](04-rate-limiting.md)
