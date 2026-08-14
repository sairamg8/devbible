---
title: "02.1 · The trust boundary"
sidebar_label: "01 · The trust boundary"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Website security](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Server-side/First_steps/Website_security), [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS), [Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy). Documentation-validated.

**Everything you ship to a browser belongs to the user.** Not figuratively — the code, the
config, the API calls and the values in memory are all inspectable, editable and replayable by
whoever has the page open. Client-side security is the discipline of knowing which guarantees
survive that and which do not.

## The one sentence the whole topic rests on

> **A check that runs in the browser is a user-experience feature, not a security control.**

It makes the good path pleasant — instant validation, a disabled button, a hidden admin menu.
It stops nobody, because the attacker is not using your UI. They are using `curl`, or your own
`fetch` from the console, or a proxy that rewrites the request on the way out.

Everything below is a corollary.

## Validation

Client-side validation exists so a user learns about a bad email address before waiting for a
round trip. It is not a filter on what reaches your database.

```js
if (!isValidEmail(email)) return showError();   // ✅ helpful
await api.post("users", { email });             // the server validates again, or you have no validation
```

🔴 **Server validation is not "belt and braces" — it is the only validation.** The client copy
is the redundant one. Teams routinely have this backwards, and the giveaway is a server endpoint
whose input handling assumes the shape the form produced.

The same applies to anything derived on the client: a computed total, a discount, a "user is
allowed to do this" boolean. **Send inputs, not conclusions.** A checkout that posts
`{ items, couponCode }` can be trusted to the extent the server recomputes; one that posts
`{ total: 4.99 }` is a price the user chose.

## Secrets

⚠️ **There is no such thing as a secret in a browser bundle.** Not in an environment variable
inlined at build time, not in a minified constant, not fetched at runtime and held in a closure.
`VITE_`- or `NEXT_PUBLIC_`-prefixed variables are *documented* as public, and the prefix is the
framework warning you.

- **An API key in the bundle is published.** If a third-party service gives you a key that must
  stay private, the call belongs on your server, with your server holding the key.
- **A "public" key that is genuinely public is fine** — a Stripe publishable key, a Google Maps
  browser key. The distinction is whether the *provider* designed it to be exposed, and those
  keys come with origin restrictions for exactly this reason.
- **Obfuscation is not a control.** Minified, mangled, string-encoded code is one devtools
  session away from readable, and the network tab shows the request regardless of how the code
  that made it looks.

## Hidden UI is not access control

```js
{user.isAdmin && <DeleteEverythingButton />}    // ✅ good UX
```

Rendering the button conditionally is right. **Believing it protects the endpoint is not.**
`DELETE /users/42` is reachable whether or not a button exists, and the flag deciding whether to
render it usually came from the same API the attacker can call directly.

🔴 **Every authorisation decision must be re-made on the server, per request.** A role in a JWT
is a claim to verify, not a permission — and the client's copy of it is a rendering hint.

This is also why "we hide the pricing page from unauthenticated users" is not a data control:
the data arrives over an API that answers anyone who asks unless the API itself checks.

## What CORS does and does not protect

From [Phase 11 · 05](../../phase-11-network-storage/05-cors-client-side/README.md), because it
is misunderstood in exactly this context:

- **CORS protects a *user's* data from other sites' JavaScript.** It stops `evil.test` reading
  your API's authenticated responses in the victim's browser.
- **It does not protect your API.** Any non-browser client ignores it entirely. A restrictive
  `Access-Control-Allow-Origin` is not an authentication mechanism.
- **It does not stop the request.** For a simple request the server still receives and processes
  it — which is why CSRF is a separate problem with a separate defence.

## The honest list

Things the client must never be trusted with, in the order they are most often got wrong:

| Never | Because |
|---|---|
| Authorisation decisions | the flag came from a response the user can forge or replay |
| Prices, totals, discounts | recompute server-side from ids the user cannot invent |
| Validation as a filter | the request need not come from your form |
| Secrets and API keys | the bundle is public by construction |
| Rate limiting | a client-side throttle is a suggestion |
| Anything about "which user am I" | derive it from the session or token **on the server** |
| Business rules that cost money | the client is the one part of the system the attacker owns |

Things the client legitimately owns: **presentation, ergonomics, and defending the user from
other pages** — the sinks in
[Phase 9 · 06 · Sanitising HTML](../../phase-9-dom/06-sanitising-html/README.md), the window
and frame boundaries in [02 · Other windows and frames](./02-windows-and-frames.md), and not
leaking data into places it should not go.

## Gotchas

**Symptom:** A malformed record reaches the database despite form validation
**Cause:** The request did not come from the form.
**Fix:** Validate server-side; treat the client copy as UX only.

**Symptom:** An order is placed at a price nobody offered
**Cause:** The client sent a computed total.
**Fix:** Send item ids and quantities; recompute server-side.

**Symptom:** A non-admin performs an admin action
**Cause:** The button was hidden, and the endpoint was not protected.
**Fix:** Authorise every request on the server, independent of what was rendered.

**Symptom:** A third-party API key is being abused
**Cause:** It was in the bundle — inlined at build time or fetched and held in memory.
**Fix:** Proxy the call through your server; use provider-issued *public* keys with origin
restrictions where they exist.

**Symptom:** "We minify, so the logic is hidden"
**Cause:** Obfuscation is not a control; the network tab shows the requests regardless.
**Fix:** Move anything that must stay secret to the server.

**Symptom:** A restrictive CORS policy is treated as API protection
**Cause:** CORS is enforced only by browsers, on behalf of the user.
**Fix:** Authenticate and authorise. CORS is not a substitute.

**Symptom:** Client-side rate limiting is bypassed
**Cause:** It runs in code the attacker controls.
**Fix:** Rate limit at the server or edge.

## Interview questions

**★ What is client-side validation for, if not security?**
User experience — telling someone their email is malformed before a round trip. It filters
nothing, because a request does not have to come from your form. Server-side validation is the
only validation; the client copy is the redundant one.

**★ Where do you put an API key that must stay private in a SPA?**
Nowhere in the SPA. Anything shipped to the browser is public — build-time inlining, minification
and runtime fetching all end up inspectable. Proxy the call through your own server so the key
never leaves it.

**★ Is hiding the admin button an access control?**
No. It is good UX. The endpoint is reachable regardless, and the flag that hid the button came
from an API the attacker can call. Every authorisation decision is re-made server-side per
request.

**★ A checkout posts `{ total: 4.99 }`. What is wrong?**
The client chose the price. Send inputs the server can verify — item ids, quantities, a coupon
code — and recompute the total server-side. Send inputs, never conclusions.

**★ Does a strict CORS policy protect your API?**
No. CORS is enforced by browsers to protect the *user's* data from other sites' scripts. Any
non-browser client ignores it, and for simple requests the server still processes the request
before the response is blocked. Authentication, authorisation and CSRF defences are unaffected.

**★ What does the client legitimately own, security-wise?**
Not creating injection sinks (XSS), not leaking data to other windows or frames, and not handing
the user's session to a third party. Those are real client responsibilities — everything about
trust and money belongs to the server.

**Why is "we obfuscate the bundle" not an answer?**
Because the observable behaviour — the requests, the endpoints, the values — is visible in
DevTools no matter what the source looks like. Obfuscation raises effort slightly and changes
nothing about what is possible.

---

[Topic index](./README.md) · Next → [02 · Other windows and frames](./02-windows-and-frames.md)
