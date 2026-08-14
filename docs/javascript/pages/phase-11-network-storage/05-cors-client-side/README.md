---
title: "05 · CORS from the client side"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS), [CORS-safelisted request header](https://developer.mozilla.org/en-US/docs/Glossary/CORS-safelisted_request_header), [`Access-Control-Allow-Credentials`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Credentials), [`Access-Control-Expose-Headers`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Expose-Headers), [`Access-Control-Max-Age`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Max-Age), [`RequestInit.credentials`](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#credentials). Documentation-validated.

**CORS is a server decision that the browser enforces on your script.** The client's entire
contribution is one option and the choice of headers; everything else is reading someone else's
response headers accurately — which is exactly the skill this topic builds.

This is the row the syllabus singles out: with the `fetch` rows, it covers the majority of *"it
works in Postman but not in the browser"*.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What the browser is actually doing](./01-what-the-browser-is-doing.md)** | CORS as a **relaxation** of the same-origin policy, decided by the server and enforced by the browser; origin = scheme + host + port, so **a subdomain is cross-origin**; 🔴 **the request is still sent and the *response* is blocked** — so a "failed" `POST` may have created the record, and the network tab showing 200 is not a lie; why `TypeError: Failed to fetch` is deliberately uninformative and cannot be diagnosed from script; `mode` and why **`no-cors` is not a workaround** (opaque response, status `0`); and the only three real fixes |
| 2 | **[Simple versus preflighted](./02-simple-vs-preflighted.md)** | The exact safelist — methods, the five CORS-safelisted request headers, the three allowed `Content-Type` values — and the consequence that **`application/json` makes almost every real API call preflighted**; what an `OPTIONS` carries and what must answer it; 🔴 **the preflight carries no credentials**, so auth middleware in front of CORS breaks it; `Access-Control-Max-Age` and the browser cap; and how to read the four console messages you will actually meet |
| 3 | **[Credentials and exposure](./03-credentials-and-exposure.md)** | `credentials: "include"` and the server half that must agree; 🔴 **the wildcard is rejected once credentials are involved** — for origins, headers and methods alike; **`Vary: Origin`**, the bug that only appears behind a CDN and only for some users; the second allowlist — why `res.headers.get("x-total-count")` is `null` while the network tab shows it; **`SameSite` as an independent gate** from `credentials`; and same-site versus same-origin |

## The three sentences to keep

1. **The browser blocks the response, not the request.** A CORS-blocked `POST` may have
   succeeded server-side, so never retry one blindly.
2. **`Content-Type: application/json` triggers a preflight**, and most CORS bugs are really
   `OPTIONS` bugs — read the `OPTIONS` response, not the request you wrote.
3. **Credentials void the wildcard.** With cookies in play the server must name the origin, add
   `Access-Control-Allow-Credentials: true`, and send `Vary: Origin`.

## Phase gate

You are done with this topic when you can say why a `GET` succeeds and a `POST` to the same
endpoint fails, name the three content types that keep a request simple, explain why the
preflight must not require authentication, and list what a credentialed cross-origin request
needs on both sides.

## Where this connects

- [01 · `fetch`](../01-fetch/README.md) — the `TypeError` a CORS block produces
- [03 · A `fetch` wrapper worth reusing](../03-fetch-wrapper/README.md) — where `credentials` and the header choices are actually made
- [04 · `URL` and `URLSearchParams`](../04-url-and-searchparams/README.md) — `url.origin`, the value every CORS decision is made against
- The [Express syllabus](../../../../expressjs/README.md) owns the server half — the headers, the `OPTIONS` handler and the cookie attributes

---

Start → [01 · What the browser is actually doing](./01-what-the-browser-is-doing.md)
