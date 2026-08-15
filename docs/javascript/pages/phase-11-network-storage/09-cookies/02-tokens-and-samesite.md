---
title: "2 · Tokens, `SameSite` and the real decision"
sidebar_label: "2 · Tokens and SameSite"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`SameSite` attribute](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#samesitesamesite-value), [Using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies), [CSRF](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/CSRF), [XSS](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/XSS), [`fetch()` credentials](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#credentials), [`Access-Control-Allow-Credentials`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Credentials), [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP), [Third-party cookies](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies). Documentation-validated; **no timings**.

## `SameSite` — what each value blocks

**The problem it solves: a cookie is sent on every matching request, including requests
your site did not make.** A form on `evil.example` posting to `bank.example` carries the
user's `bank.example` session cookie, because the browser attaches cookies by destination,
not by origin of the request.

| Value | Sent on same-site requests | Sent on cross-site requests |
|---|---|---|
| `Strict` | ✅ | ❌ never |
| `Lax` **(default)** | ✅ | only on **top-level navigations** using a safe method |
| `None` | ✅ | ✅ — and **requires `Secure`** |

🔴 **`Lax` is the modern default**, and it is a good one: a cross-site `POST`, an `iframe`,
an `img`, a `fetch` — none of them carry the cookie. What still does is the user *clicking
a link* to your site, which is why `Lax` keeps you logged in when arriving from a search
result while `Strict` does not.

⚠️ **`Strict` is not simply "more secure, use it".** With `Strict`, a user following a link
from anywhere — an email, a chat, another site — arrives logged out, sees a login page, and
often gives up. That is a real cost, and the usual answer is `Lax` for the session cookie
and `Strict` for anything genuinely dangerous.

🔴 **`None` without `Secure` is rejected outright.** If you need a cookie in a cross-site
context — an embedded widget, an SSO iframe — it must be `SameSite=None; Secure`, and it is
also the category browsers are actively restricting under third-party cookie deprecation.
`Partitioned` (CHIPS) is the supported path for embedded cases: the cookie still works but
is stored separately per top-level site, so it cannot track across them.

## CSRF, and why `SameSite` is not the whole answer

**Cross-site request forgery is the attack `SameSite` was retrofitted to stop:** a page you
do not control causes the browser to send an authenticated request to a site you are logged
into. The attacker never reads the response — they only need the side effect.

**`Lax` blocks the classic form-post version.** But defence in depth still matters:

- **`Lax` still allows top-level `GET` navigations**, so any `GET` with a side effect is
  still reachable. **Never put a state change behind a `GET`** — that was always true and
  `SameSite` does not fix it.
- **Same-site is not same-origin.** `evil.example.com` and `app.example.com` are the same
  *site*, so a compromised or user-content subdomain can send cookies to your app.
- **Older browsers** may not apply the default.

✅ **So the usual production shape is layered:** `SameSite=Lax` or `Strict`, plus a CSRF
token or the double-submit pattern for state-changing routes, plus checking `Origin` on the
server. Any one of those alone is thinner than it looks.

## Cookies through CORS

**Cross-origin `fetch` does not send cookies by default:**

```js
fetch("https://api.example.com/me");                             // 🔴 no cookies
fetch("https://api.example.com/me", { credentials: "include" }); // ✅ sends them
```

🔴 **And the server must opt in with two headers, one of which forbids the wildcard:**

```
Access-Control-Allow-Credentials: true
Access-Control-Allow-Origin: https://app.example.com     ← ✅ a specific origin
Access-Control-Allow-Origin: *                            ← 🔴 rejected with credentials
```

⚠️ **`*` is not allowed on a credentialed request** — the browser rejects the response even
though the server answered. That is the single most common credentialed-CORS failure, and
the fix is echoing the specific allowed origin rather than loosening anything
([05 · CORS from the client side](../05-cors-client-side/README.md)).

**And the cookie itself must be `SameSite=None; Secure`** to be sent cross-site at all — so
a credentialed cross-origin setup needs *both* halves right, which is why it fails in two
different ways.

## 🔴 The real decision: token in a cookie, or in `localStorage`?

**This is argued badly almost everywhere.** The honest version:

| | `HttpOnly` cookie | `localStorage` |
|---|---|---|
| Readable by injected script | ❌ **no** | ✅ **yes** |
| Sent automatically | ✅ — including on requests you did not make | ❌ you attach it |
| Vulnerable to CSRF | ✅ — needs `SameSite` and/or a token | ❌ |
| Works cross-origin | needs `SameSite=None; Secure` + CORS credentials | ✅ trivially |
| Survives XSS | 🔴 **no** — see below | 🔴 no |

**The two halves of the trade:**

- **An `HttpOnly` cookie cannot be *read* by injected script.** That is real and it is the
  strongest single argument for cookies: an XSS payload cannot exfiltrate the token to the
  attacker's server, so it cannot be replayed later or from elsewhere.
- **But injected script does not need to read it.** Running on your origin, it can simply
  *make requests*, and the browser attaches the cookie. The attacker acts as the user for
  as long as the page is open.

🔴 **So "HttpOnly protects you from XSS" is false, and "it makes no difference" is also
false.** It converts *token theft* — persistent, portable, replayable elsewhere — into
*session riding*, which is bounded by the page's lifetime and observable server-side. That
is a genuine reduction in blast radius and worth having. It is not a fix.

⚠️ **The conclusion the table points at: if you have XSS, you have a breach either way.**
Which means the effort that actually moves the needle is preventing injection —
[Phase 9 · 06 · Sanitising HTML](../../phase-9-dom/06-sanitising-html/README.md), a strict
**Content Security Policy** *(topic 15 in this phase, not written yet)*, and framework
escaping — not choosing a storage bucket.

✅ **A defensible default for a first-party web app:** an `HttpOnly; Secure; SameSite=Lax`
session cookie, short-lived, plus CSRF protection on state-changing routes. It gets the
theft protection, and `SameSite` handles the cost that cookies bring with them.

✅ **When `localStorage` is the reasonable answer:** a token for a *different* origin's API
where cookies would need `SameSite=None` and credentialed CORS anyway; a native or hybrid
client; a public API token that is not a session. Then keep the lifetime short and accept
that XSS is total.

🔴 **What is not defensible either way:** a long-lived refresh token readable by JavaScript.
The longer the lifetime, the more a single injection is worth.

## Gotchas

**Symptom:** Cookies stopped being sent from an embedded iframe or widget
**Cause:** `SameSite` defaults to `Lax`, which excludes embedded contexts — and third-party
cookies are being restricted regardless.
**Fix:** `SameSite=None; Secure`, and consider `Partitioned` for genuinely embedded cases.

**Symptom:** `SameSite=None` was ignored
**Cause:** It requires `Secure`; without it the cookie is rejected.
**Fix:** Add `Secure` and serve over HTTPS.

**Symptom:** Users arriving from an email link were logged out
**Cause:** `SameSite=Strict` withholds the cookie on cross-site navigation.
**Fix:** `Lax` for the session cookie; reserve `Strict` for high-risk actions.

**Symptom:** A cross-origin `fetch` was authenticated in Postman but not in the browser
**Cause:** No `credentials: "include"`, or the server sends `Access-Control-Allow-Origin: *`
with credentials.
**Fix:** Both halves — the option on the request, a specific origin plus
`Access-Control-Allow-Credentials: true` on the response.

**Symptom:** A CSRF token was added and cross-site requests still succeeded
**Cause:** The route is a `GET` with a side effect, which `Lax` still permits on a top-level
navigation.
**Fix:** State changes belong behind non-safe methods.

**Symptom:** A subdomain was able to act on the main app's session
**Cause:** Same-*site* includes sibling subdomains; `SameSite` does not distinguish them.
**Fix:** Do not treat subdomain isolation as a security boundary; check `Origin` server-side.

**Symptom:** An XSS incident with `HttpOnly` cookies still resulted in fraudulent actions
**Cause:** The script did not need to read the cookie — it made requests and the browser
attached it.
**Fix:** There is no storage fix. Prevent injection: CSP, escaping, sanitising.

## Interview questions

**★ What does `SameSite` do, and what is each value for?**
It controls whether a cookie rides on cross-site requests. `Strict` never sends it
cross-site; `Lax` — the modern default — sends it only on top-level navigations with safe
methods, so a link from an email keeps you logged in but a cross-site form post does not;
`None` sends it always and requires `Secure`. `Lax` is the right default for a session
cookie because `Strict` logs users out whenever they arrive from anywhere else.

**★ Does `SameSite=Lax` mean you can drop CSRF tokens?**
No. It still permits top-level `GET` navigations, so any `GET` with a side effect is
reachable; same-site includes sibling subdomains, so a compromised subdomain is inside the
boundary; and older browsers may not apply the default. The production shape is `SameSite`
plus a CSRF token on state-changing routes plus an `Origin` check.

**★ Why does a credentialed cross-origin request fail with `Access-Control-Allow-Origin: *`?**
Because the wildcard is not permitted when credentials are included — the browser rejects
the response even though the server replied. The server must echo the specific allowed
origin and send `Access-Control-Allow-Credentials: true`, and the cookie must additionally
be `SameSite=None; Secure`.

**★ Is an `HttpOnly` cookie safe from XSS?**
No, and this is the question most often answered wrongly in both directions. Injected script
cannot *read* the cookie, so it cannot exfiltrate a token to replay elsewhere — that is
real. But it can *make requests* from your origin, and the browser attaches the cookie, so
the attacker acts as the user while the page is open. It converts token theft into session
riding: a smaller blast radius, not a fix.

**★ Where should an access token live?**
For a first-party web app, an `HttpOnly; Secure; SameSite=Lax` short-lived session cookie
with CSRF protection. `localStorage` is reasonable when the token targets a different
origin's API, or for a hybrid client, accepting that XSS is total. What is indefensible
either way is a long-lived refresh token readable by JavaScript.

**If the storage choice does not solve XSS, what does?**
Preventing injection: framework escaping, sanitising any HTML you insert, and a strict
Content Security Policy. That is where the effort belongs; the storage debate is a smaller
lever than it is usually presented as.

---

← [1 · The API and the attributes](./01-the-api-and-the-attributes.md) · [Topic index](./README.md) · [Phase index](../README.md) →
