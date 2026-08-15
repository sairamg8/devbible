---
title: "09 · Cookies"
sidebar_label: "Overview"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies), [`Document.cookie`](https://developer.mozilla.org/en-US/docs/Web/API/Document/cookie), [`Set-Cookie`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie), [`SameSite` attribute](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#samesitesamesite-value), [CSRF](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/CSRF), [`CookieStore`](https://developer.mozilla.org/en-US/docs/Web/API/CookieStore). Documentation-validated; **no timings**.

**A cookie is the only client-side storage the browser attaches to requests for you.**
That single property is why sessions are built on them, and it is also the source of every
problem in this topic: something sent automatically is sent whether or not you meant it.

🔴 **`document.cookie` is one of the worst APIs on the platform.** Reading it returns every
cookie mashed into one string with no attributes; writing to it sets exactly one cookie
without clearing the rest; deleting is done by setting a cookie that has already expired,
and it silently fails if you get the path wrong. None of that is going to change — the API
is load-bearing for the entire web.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The API and the attributes](./01-the-api-and-the-attributes.md)** | Why reading and writing `document.cookie` are asymmetric; parsing and encoding values; every attribute — `Domain`, `Path`, `Expires`/`Max-Age`, `Secure`, `HttpOnly`, `SameSite`, `Partitioned`; 🔴 **deletion, and why it usually fails silently**; the size and count limits; and the modern async `CookieStore` |
| 2 | **[Tokens, `SameSite` and the real decision](./02-tokens-and-samesite.md)** | `SameSite` in full and what each value blocks; CSRF and why `Lax` is not the whole answer; cookies through CORS and why `credentials: "include"` forbids a wildcard origin; and 🔴 **the honest version of the "token in `localStorage` or a cookie" argument** — what each actually defends against, and what neither does |

## The two halves of a cookie

**A cookie has a name and a value the server sees on every request, and attributes it
never does.**

```
Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600
            ^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
            sent back        instructions to the browser — never sent back
```

⚠️ **The request only ever carries `name=value`.** The browser keeps the attributes to
decide *whether* to send it; the server cannot read them back, which is why you cannot ask
"when does this cookie expire" from either side after the fact.

## Phase gate

You are done with this topic when you can say **why deleting a cookie often does nothing**,
and **what `HttpOnly` protects against and what it does not**.

## Where this connects

- [05 · CORS from the client side](../05-cors-client-side/README.md) — why credentialed requests cannot use a wildcard origin
- [01 · `fetch`](../01-fetch/README.md) — `credentials` and what it changes
- **10 · Web storage** *(next in this phase)* — the alternative, and what it cannot do
- **15 · Content Security Policy** *(later in this phase)* — the defence that actually reduces XSS risk
- [Phase 9 · 06 · Sanitising HTML](../../phase-9-dom/06-sanitising-html/README.md) — the attack that makes the storage question matter

---

Start → [1 · The API and the attributes](./01-the-api-and-the-attributes.md)
