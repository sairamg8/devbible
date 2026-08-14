---
title: "05.1 · What the browser is actually doing"
sidebar_label: "01 · What the browser does"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS), [Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy), [Origin (glossary)](https://developer.mozilla.org/en-US/docs/Glossary/Origin), [`Response.type`](https://developer.mozilla.org/en-US/docs/Web/API/Response/type). Documentation-validated.

MDN's definition is worth reading slowly, because every word of it is load-bearing:

> "**Cross-Origin Resource Sharing** (CORS) is an HTTP-**header based** mechanism that allows a
> **server** to indicate any origins (domain, scheme, or port) other than its own from which a
> **browser** should permit loading resources."

Three facts follow, and they resolve most CORS confusion on their own:

1. **CORS is a server decision, enforced by the browser.** Nothing you write in JavaScript can
   grant it. Every "how do I fix CORS in my React app" answer that is not "change the server or
   proxy through your own origin" is wrong.
2. **It is a relaxation, not a restriction.** The default — the same-origin policy — is what
   blocks you. CORS is the mechanism by which a server *opts out* of that default.
3. **It applies to what the browser lets your script read**, not to what other tools can do.
   `curl` has no CORS. Your server calling that API has no CORS. Only the browser enforces it,
   on behalf of the user whose cookies are in play.

## An origin is scheme + host + port

| URL | Same origin as `https://app.example.com/a`? |
|---|---|
| `https://app.example.com/b` | ✅ path is irrelevant |
| `https://app.example.com:443/b` | ✅ 443 is the default for `https` |
| `http://app.example.com/a` | ❌ different **scheme** |
| `https://api.example.com/a` | ❌ different **host** — a subdomain is a different origin |
| `https://app.example.com:8443/a` | ❌ different **port** |

🔴 **A subdomain is a different origin.** `app.example.com` and `api.example.com` are as
cross-origin as `example.com` and `evil.test`, and the fact that you own both changes nothing.
This is the single most common surprise: teams expect the shared parent domain to count, and it
does not.

`url.origin` gives you exactly this string — [04 · The URL
object](../04-url-and-searchparams/01-the-url-object.md) — which is why an origin comparison is
the right way to validate a redirect target.

## The request is still sent

🔴 **This is the thing that makes CORS errors feel irrational, and it is the key to debugging
them.** For a simple request, the browser sends it, the server processes it, and *then* the
browser refuses to hand the response to your script because the headers do not permit it.

Consequences you have to internalise:

- **A CORS-blocked `POST` may well have created the record.** "It failed" is a statement about
  your script's access to the response, not about the server's state. Retrying after a CORS
  error is exactly the duplicate-order scenario from
  [03 · 06 · Retries](../03-fetch-wrapper/06-retries.md).
- **The network tab shows a successful response** — status 200, headers, body — while the
  console shows an error. Both are correct, and the mismatch is the point where people conclude
  the tooling is lying to them.
- **CORS is not a server-side security control.** It does not stop a request from reaching your
  API. It stops *another site's JavaScript* from reading the answer. Authorisation still has to
  happen on the server; a CSRF token is still needed. CORS protects the user's data from other
  pages, not your API from clients.

The exception is a **preflighted** request, where the browser asks permission *before* sending
the real one — [02 · Simple versus preflighted](./02-simple-vs-preflighted.md). That is the only
case where a blocked request truly never reaches your handler.

## What you get instead of the response

From [01 · The critical surprise](../01-fetch/01-the-critical-surprise.md): the promise
**rejects** with a `TypeError`, and the message is deliberately unhelpful —
`TypeError: Failed to fetch` in Chrome, `NetworkError when attempting to fetch resource` in
Firefox.

🔴 **The vagueness is the security property, not a gap in the API.** If the error object told
your script "the server replied 403 with `Access-Control-Allow-Origin: https://other.test`", a
malicious page could probe an intranet server's responses by reading error details. So the
detail goes to the **console**, where a human can see it, and not to the code.

That means:

- **You cannot branch on "was it CORS?" in JavaScript.** A CORS block, an offline device and a
  DNS failure are all the same `TypeError`.
- **You cannot log the cause to your error tracker** from the client. The console message is not
  available to script.
- **The only diagnosis is the console and the network tab**, by a person, in a browser.

## `mode` and opaque responses

`fetch`'s `mode` option decides what the browser does about cross-origin:

| `mode` | Behaviour |
|---|---|
| `"cors"` | **the default** — CORS rules apply, and you can read the response if the server allows |
| `"same-origin"` | cross-origin requests fail immediately, before any network work |
| `"no-cors"` | the request is sent, and you get an **opaque** response you cannot read |

🔴 **`no-cors` is not a workaround, and it is proposed as one constantly.** It does not give you
the data; it gives you a `Response` whose `type` is `"opaque"`, with status `0`, no headers, and
an unreadable body. Reading it is *not* blocked by an error you can catch — the response is
simply empty. It also silently restricts you to simple requests, dropping any header the safelist
does not include.

`no-cors` exists for cases where you genuinely do not need to read the response: firing an
analytics beacon, or warming a cache. Using it to "fix" an API call converts a loud error into a
silent one that returns `null`.

**Response types worth recognising:** `"basic"` (same-origin), `"cors"` (cross-origin and
allowed), `"opaque"` (`no-cors`), `"opaqueredirect"`. Checking `res.type` is occasionally the
fastest way to discover you are looking at an opaque response rather than an empty API.

## The fixes that actually exist

Only three, and two are not yours to make:

1. **The server sends the CORS headers.** The correct fix.
2. **A proxy on your own origin** forwards the request — the standard development answer
   (Vite/Webpack dev server proxy) and a legitimate production pattern. The browser sees a
   same-origin request; your server makes the cross-origin one, where CORS does not apply.
3. **Move the call to your own backend.** Same principle, permanently.

⚠️ **A browser extension that disables CORS is a fourth thing people do, and it is a trap.** It
makes your machine work and everyone else's fail, and it hides the bug until production. Public
"CORS anywhere" proxies are worse: you are routing your users' authenticated requests through a
stranger's server.

## Gotchas

**Symptom:** A CORS error, but the network tab shows a 200
**Cause:** For simple requests the browser sends the request and blocks the *response*.
**Fix:** Nothing to fix in the client — read the console for the missing header, and change the
server.

**Symptom:** A "failed" `POST` created the record anyway
**Cause:** Same — the request was delivered and processed.
**Fix:** Do not retry blindly after a CORS error; treat the outcome as unknown.

**Symptom:** `api.example.com` is blocked from `app.example.com`
**Cause:** A subdomain is a different origin. Sharing a parent domain is irrelevant.
**Fix:** Send the CORS headers from the API, or proxy.

**Symptom:** It works on `http://localhost:3000` and fails on `https://localhost:3000`
**Cause:** Scheme is part of the origin.
**Fix:** Match the scheme, or allow both explicitly.

**Symptom:** The error message says nothing useful
**Cause:** Deliberate. Revealing the response would defeat the same-origin policy.
**Fix:** Read the console. There is no programmatic diagnosis.

**Symptom:** `mode: "no-cors"` "fixed" it and now the data is empty
**Cause:** An opaque response — `type: "opaque"`, status `0`, unreadable body.
**Fix:** Revert it. `no-cors` is for fire-and-forget only.

**Symptom:** It works for one developer and nobody else
**Cause:** A CORS-disabling browser extension or flag.
**Fix:** Remove it; fix the server or add a dev proxy.

**Symptom:** `curl` works, the browser does not
**Cause:** CORS is enforced only by browsers.
**Fix:** Expected. It tells you the server is fine and the headers are missing.

## Interview questions

**★ What problem does CORS solve, and who enforces it?**
The same-origin policy stops one site's JavaScript from reading another origin's responses —
which matters because the browser attaches the user's cookies. CORS is the **server's** way of
opting out of that default, via response headers, and the **browser** enforces the result. MDN:
*"an HTTP-header based mechanism that allows a server to indicate any origins … from which a
browser should permit loading resources."*

**★ Is `https://app.example.com` the same origin as `https://api.example.com`?**
No. An origin is scheme + host + port, and a subdomain is a different host. Shared ownership is
irrelevant.

**★ A cross-origin `POST` fails with a CORS error. Did it reach the server?**
For a simple request, yes — the browser sends it and blocks the *response*. The record may have
been created. Only a preflighted request is stopped before the real call goes out.

**★ Why is `TypeError: Failed to fetch` so uninformative?**
Because putting the reason in the error object would let a malicious page probe cross-origin
responses — exactly what the same-origin policy prevents. The detail goes to the console for a
human, not to script.

**★ Can you fix CORS from the client?**
No. The only fixes are server headers, a proxy on your own origin, or moving the call to your
backend. `mode: "no-cors"` is not a fix — it yields an opaque response with status `0` and no
readable body.

**★ Does CORS protect your API?**
No. It protects a *user's* data from other pages reading it in their browser. Any non-browser
client ignores it entirely, so authentication, authorisation and CSRF defences are still
required.

**Why does the network tab disagree with the console?**
They are describing different things: the exchange succeeded (network tab), and the browser
refused to expose the result to your script (console). Both are true.

---

[Topic index](./README.md) · Next → [02 · Simple versus preflighted](./02-simple-vs-preflighted.md)
