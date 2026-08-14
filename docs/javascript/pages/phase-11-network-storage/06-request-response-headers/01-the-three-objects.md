---
title: "01 · The three objects"
sidebar_label: "01 · The three objects"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response), [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request), [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers), [`Response.clone()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/clone), [`Response.json()` static](https://developer.mozilla.org/en-US/docs/Web/API/Response/json_static). Documentation-validated; **no timings**.

`fetch()` is a thin function over three objects. Constructing them yourself is what makes a
`fetch` wrapper, a service worker and a test double all possible.

## `Request` — a request you can pass around

```js
const request = new Request('https://api.example.com/invoices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(invoice),
});

const response = await fetch(request);     // fetch takes a Request, not just a URL
```

Because a `Request` is a value, it can be built in one place and sent in another — which is how
interceptors, retries and request logging are written without wrapping `fetch` itself. A `Request`
can also be built **from another request**, which is the copy-with-changes idiom:

```js
const authed = new Request(request, {
  headers: new Headers([...request.headers, ['Authorization', `Bearer ${token}`]]),
});
```

## `Response` — and its properties

| Property | Is |
|---|---|
| `ok` | `true` for status **200–299** |
| `status` / `statusText` | `200`, `'OK'` |
| `headers` | a `Headers` object |
| `type` | `'basic'`, `'cors'`, `'opaque'`, … |
| `url` | the final URL |
| `redirected` | whether a redirect got you here |
| `bodyUsed` | 🔴 has the body already been read? |
| `body` | a `ReadableStream` |

🔴 **`ok` is the check that `fetch` does not do for you.** A 404 or a 500 resolves normally — the
promise rejects only on a network-level failure. That is the Master-tier surprise from
[01 · `fetch`](../01-fetch/README.md), and every wrapper starts by testing `response.ok`.

`type: 'opaque'` is worth recognising: it is what you get from a `no-cors` cross-origin request —
status `0`, no readable headers, no readable body. It is not an error, it is a response you are not
allowed to look at.

### Constructing responses

```js
new Response('plain text', { status: 200, headers: { 'Content-Type': 'text/plain' } });

Response.json({ ok: true }, { status: 201 });   // sets Content-Type for you
Response.redirect('/login', 302);
Response.error();                                // a network-error response
```

`Response.json()` is the concise static: it serialises and sets `Content-Type: application/json`.
These constructors are what a **service worker** returns from `respondWith()`, and what a test
double returns instead of hitting the network.

## Reading the body — once

| Method | Gives |
|---|---|
| `json()` | parsed JSON |
| `text()` | a string |
| `blob()` | a `Blob` |
| `arrayBuffer()` | an `ArrayBuffer` |
| `bytes()` | a `Uint8Array` |
| `formData()` | a `FormData` |

All return promises, and all are **mutually exclusive**:

```js
const res = await fetch(url);
const data = await res.json();
const text = await res.text();      // ❌ TypeError — the body is already used
```

🔴 **The body is a stream, and a stream is consumed by reading it.** `bodyUsed` tells you whether
that has happened. The fix when you genuinely need it twice is `clone()`, **before** reading:

```js
const res = await fetch(url);
const copy = res.clone();           // must happen before either body is read

const data = await res.json();
logRawBody(await copy.text());
```

⚠️ **Cloning buffers.** The clone's body has to be held in memory until both are read, so cloning a
large download to peek at it costs that much memory. For logging, prefer reading once as text and
parsing yourself:

```js
const raw = await res.text();
const data = raw ? JSON.parse(raw) : null;    // one read, and empty bodies survive
```

That shape also solves the commonest wrapper bug: **`res.json()` throws on an empty body** — a 204,
or a 500 that returned nothing — because `''` is not valid JSON.

## `Headers`

```js
const headers = new Headers({ Accept: 'application/json' });
headers.append('Accept', 'text/plain');   // append ADDS; set() replaces
headers.get('accept');                    // 'application/json, text/plain'
headers.has('Authorization');
headers.getSetCookie();                   // all Set-Cookie values, as an array
```

- 🔴 **Header names are case-insensitive.** `get('Content-Type')`, `get('content-type')` and
  `get('CONTENT-TYPE')` are the same lookup — do not build a `Map` keyed by header name yourself.
- **`append` versus `set`:** append adds another value, `set` replaces. Repeated `append` calls are
  how a header ends up with a comma-joined value you did not expect.
- **`getSetCookie()`** exists because `Set-Cookie` is the one header that legitimately appears
  several times and must not be comma-joined.
- `Headers` is iterable: `[...headers]` gives `[name, value]` pairs, lower-cased.

⚠️ **You cannot read every header cross-origin.** Only the CORS-safelisted response headers are
exposed unless the server sends `Access-Control-Expose-Headers` — so a missing `X-Total-Count` is
usually a server configuration issue, not a client bug
([05 · CORS from the client side](../05-cors-client-side/README.md)).

Some request headers are **forbidden** — `Host`, `Content-Length`, `Origin` and others — and the
browser silently ignores attempts to set them. Nothing throws; the header simply does not appear.

## Where this shape pays off

- **A wrapper** builds a `Request`, adds auth headers, and hands it to `fetch`
  ([03 · A `fetch` wrapper](../03-fetch-wrapper/README.md)).
- **A service worker** intercepts a `Request` and answers with a constructed `Response`.
- **Tests** return `Response.json({...})` instead of running a server.
- **Retries** re-send the same `Request` — but note a request with a body is also single-use, so
  clone it if you may need to send it twice.

## Gotchas

**Symptom: `TypeError: body stream already read`.**
Cause — two body-reading methods called on the same response.
Fix — read once and reuse the value, or `clone()` **before** the first read.

**Symptom: `res.json()` throws `Unexpected end of JSON input`.**
Cause — an empty body (204, or an error response with nothing in it).
Fix — read `text()` first and parse only when non-empty.

**Symptom: a failed request never reaches your `catch`.**
Cause — `fetch` resolves for 404 and 500; only network failures reject.
Fix — check `response.ok` and throw yourself.

**Symptom: a response header you know was sent is `null`.**
Cause — cross-origin, and it is not CORS-safelisted.
Fix — the server must list it in `Access-Control-Expose-Headers`.

**Symptom: a request header you set never arrives.**
Cause — it is a forbidden header name; the browser ignores it silently.
Fix — set it server-side, or use a header the browser permits.

**Symptom: `headers.get('accept')` returns two values joined by a comma.**
Cause — `append` was called more than once.
Fix — `set` when you mean to replace.

**Symptom: a retry sends an empty body the second time.**
Cause — the `Request`'s body is also a single-use stream.
Fix — clone the request, or rebuild it from the original data.

## Interview questions

**★ Why can a response body only be read once?**
Because it is a `ReadableStream`, and reading consumes it — `bodyUsed` reports that. `clone()`
before the first read gives you a second readable copy, at the cost of buffering the body in memory.

**★ What does `response.ok` mean, and why does it matter?**
It is `true` only for status 200–299. `fetch` resolves for 404 and 500 and rejects only on network
failure, so without an `ok` check an error response flows through as success.

**★ How do you read a JSON response that might be empty?**
Read `text()` and parse only if it is non-empty. `json()` on an empty body throws, which is why
204 responses break naive wrappers.

**★ Why can't you read some response headers cross-origin?**
Only CORS-safelisted headers are exposed by default; anything else needs the server to list it in
`Access-Control-Expose-Headers`.

**★ What is an opaque response?**
The result of a `no-cors` cross-origin request: `type: 'opaque'`, status 0, no readable headers or
body. It is a deliberate restriction, not a failure.

**Why construct `Request` and `Response` yourself?**
They are values: a wrapper builds requests, a service worker answers with constructed responses, and
tests return `Response.json(...)` instead of running a server.

---

[Topic index](./README.md) · [Phase 11 index](../README.md) →
