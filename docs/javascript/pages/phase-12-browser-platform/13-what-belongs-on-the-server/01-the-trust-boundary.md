---
title: "01 · The trust boundary"
sidebar_label: "01 · The trust boundary"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Website security](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Server-side/First_steps/Website_security), [Client-side form validation](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Form_validation), [Cross-site scripting](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/XSS), [`Set-Cookie` — `HttpOnly`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie), [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP), [Permissions Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy). Documentation-validated; **no timings and no console output**.

Everything in this phase has been about what the browser can do. This topic is the boundary of
that: **the client is not a participant you can trust, it is an input you must validate.**

## 🔴 The one sentence

**Anything the browser computes, the user can change.** Not "a determined attacker" — anyone with
DevTools, a proxy, `curl`, or a modified build of your own app. Your JavaScript is a *convenience
running on someone else's computer*, and the server has to behave as though the request came from
a hostile stranger, because sometimes it did.

Concretely, all of the following are trivially forged:

| Assumption | How it breaks |
|---|---|
| "The form validated, so the data is valid" | the request never went through the form |
| "The button is disabled for non-admins" | the endpoint is called directly |
| "The price came from our own page" | the payload is edited before sending |
| "The client sent a real user id" | any id can be sent |
| "The rate limiter in our code prevents abuse" | it runs in the attacker's browser |
| "The token is hidden in the bundle" | the bundle is a text file the user already downloaded |

**Obfuscation, minification and "it's an SPA so nobody sees the endpoints" are not controls.**
The network tab lists every endpoint you call, with the exact payload.

## The honest list

| Concern | The client may | The server must |
|---|---|---|
| **Authentication** | show a login form, hold a session cookie it cannot read | verify credentials, issue and validate the session, expire it |
| **Authorisation** | hide what the user cannot use, for tidiness | check permissions **on every request**, per resource |
| **Validation** | give instant feedback | re-validate everything, as the only validation that counts |
| **Prices and totals** | display them, compute a preview | compute the authoritative total from its own catalogue |
| **Discounts and coupons** | show the applied badge | verify eligibility, limits and expiry |
| **Inventory and availability** | show a cached number | decide at the moment of purchase |
| **Business rules** | mirror them for UX | own them; the client's copy is decoration |
| **Secrets and API keys** | hold nothing | keep them, and proxy the call |
| **Rate limiting and abuse** | debounce, for politeness | enforce, by identity and IP |
| **Ordering, ids, sequence numbers** | generate a correlation id | assign anything security- or money-relevant |
| **Time** | display it | timestamp events; a client clock is unreliable and forgeable |
| **File type and size** | filter the picker, warn early | sniff the content, enforce the limit, decide where it is stored |
| **Entitlements / feature access** | hide a feature | refuse the endpoint |
| **Which fields a user may see** | render what it is given | decide what to send — never send and hide |

🔴 **"Never send and hide" is the one people miss.** Returning the full object and filtering in the
UI puts the hidden fields in the network response, permanently. Every "we accidentally exposed
emails" incident is this line.

## Client-side validation is a UX feature

```html
<input type="email" required maxlength="120" />
```

Constraint validation is genuinely valuable: instant feedback, no round trip, correct keyboard on
mobile, accessible messages for free. **What it is not is a check.** The server re-validates
type, length, range, format, referential integrity and permission — and does so as though the
client had never run.

⚠️ **A mismatch between the two is a bug in itself.** If the client accepts what the server
rejects, the user sees an unexplained failure; if the client is stricter, some legitimate input
becomes impossible. Sharing one schema between the two is the fix — the same JSON Schema or Zod
definition imported by both sides
([02 · Getting it right in practice](./02-getting-it-right.md)).

## What "in the browser" means for secrets

**There is no such thing as a secret in a browser bundle.** Not in an environment variable
inlined at build time, not behind a minifier, not in a service worker, not in `IndexedDB`.

| Thing | Where it lives |
|---|---|
| Third-party API key with any privilege | server; the browser calls **your** endpoint, which calls theirs |
| Publishable/anon keys designed for clients | fine in the browser, **if** the provider's rules are actually configured |
| Signing keys, webhook secrets, DB credentials | server, always |
| Session token | an `HttpOnly` cookie the script cannot read |

🔴 **`HttpOnly` exists because of XSS.** A token in `localStorage` is readable by any script that
gets injected — a compromised dependency is enough
([02 · Client-side security](../02-client-side-security/README.md)). A cookie marked `HttpOnly`,
`Secure` and `SameSite` is not readable by script at all, which changes what a successful XSS can
steal.

## The headers that only a server can set

Some protections are, by construction, not available to client code — which is why "we handled
security in the front end" is never a complete sentence:

| Header | Protects against |
|---|---|
| `Content-Security-Policy` | injected script, and where resources may come from |
| `Strict-Transport-Security` | downgrade to plain HTTP |
| `X-Content-Type-Options: nosniff` | content-type confusion |
| `X-Frame-Options` / CSP `frame-ancestors` | clickjacking |
| `Set-Cookie` flags — `HttpOnly`, `Secure`, `SameSite` | token theft and CSRF |
| `Permissions-Policy` | what embedded content may request |
| `Timing-Allow-Origin`, CORS headers | who may read your responses and timings |

A `<meta>` CSP exists but is weaker and later; the header is the real one.

## Gotchas

**Symptom: a user granted themselves admin.**
Cause — the check was "hide the button", and the endpoint trusted the caller.
Fix — authorise per request on the server; UI hiding is cosmetic.

**Symptom: an order went through at the wrong price.**
Cause — the total was computed client-side and posted.
Fix — post ids and quantities; the server prices the order from its own data.

**Symptom: personal data appeared in a response the UI never displayed.**
Cause — the API returned everything and the client filtered.
Fix — the server decides what to send, per requester.

**Symptom: a third-party API key was found in the bundle.**
Cause — inlined at build time in the belief that a build step hides it.
Fix — proxy through your own endpoint; rotate the key, because it is compromised.

**Symptom: XSS in one dependency drained sessions.**
Cause — the token was in `localStorage`, readable by any script.
Fix — `HttpOnly` cookies, plus CSP.

**Symptom: two users' events are out of order.**
Cause — client timestamps.
Fix — the server stamps; the client's clock is unsynchronised and forgeable.

**Symptom: an upload of a "PNG" turned out to be a script.**
Cause — the extension and the picker `accept` were the only checks.
Fix — sniff the content server-side, enforce size there, and serve uploads from a separate origin.

## Interview questions

**★ Why can't the client be trusted, even in an internal app?**
Because the code runs on someone else's machine and the network is open: DevTools, a proxy and
`curl` all bypass every check you wrote. Internal only narrows who can do it, not whether it works.

**★ Then why validate on the client at all?**
For the user: instant feedback, no round trip, the right mobile keyboard, accessible error
messages. It is a UX feature that happens to look like a check — the server's validation is the
one that decides.

**★ Where should prices and totals be calculated?**
On the server, from its own catalogue, at the moment of the order. The client may compute a
preview; it must never submit the number that gets charged.

**★ Where do you keep an API token in a single-page app?**
Not in the bundle and not in `localStorage`. A session in an `HttpOnly`, `Secure`, `SameSite`
cookie, with third-party keys held server-side and calls proxied through your own endpoint.

**★ What is wrong with returning a full user object and hiding fields in the UI?**
The hidden fields are in the response, visible in the network tab and in any log or cache that
touched it. Filtering is a server responsibility; the client renders what it is given.

**Name a protection the front end simply cannot provide.**
Any response header — CSP, HSTS, `nosniff`, `frame-ancestors`, cookie flags, CORS. They are set by
the server by definition, which is why front-end-only security is never complete.

---

[Topic index](./README.md) · [02 · Getting it right in practice](./02-getting-it-right.md) →
