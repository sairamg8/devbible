---
title: "fetch"
sidebar_label: "05 · fetch"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`fetch` is global and stable. It is undici, bundled into Node, exposing the same
`Request` / `Response` / `Headers` / `FormData` objects the browser has. It is the
default way a Node service calls another service — and it has two behaviours that
cause outages if you do not know them.**

```js
const res = await fetch('https://api.example.com/orders/7', {
  headers: { accept: 'application/json' },
  signal: AbortSignal.timeout(5000),          // page 06 — never omit this
});
if (!res.ok) throw new Error(`orders API ${res.status}`);
const order = await res.json();
```

## It does not throw on 4xx or 5xx

```console
$ node fetchb.mjs
500 -> threw? no | ok: false | status: 500 | body: {"error":"boom"}
```

A rejected promise means the request never completed — DNS, TCP, TLS, abort. An
HTTP error is a *successful* exchange that happens to carry a bad status. Check
`res.ok` (true for 200–299) on every call. Code that goes straight to
`res.json()` will parse the error payload and treat it as data.

```js
// the wrapper worth having exactly once in a codebase
async function json(url, init) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(5000) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw Object.assign(new Error(`${init?.method ?? 'GET'} ${url} -> ${res.status}`), {
      status: res.status, body: body.slice(0, 500),
    });
  }
  return res.json();
}
```

Keeping the status on the error is what lets a caller distinguish "retry this"
from "this will never work" ([page 08](08-outbound-client-discipline.md)).

## The body is a stream, and it is single-use

```console
$ node fetchb.mjs
second read -> TypeError: Body is unusable: Body has already been read
```

`json()`, `text()`, `arrayBuffer()`, `blob()`, `bytes()` and `formData()` each
consume the body once. To read it twice, `res.clone()` before the first read —
which buffers, so it costs memory.

**And an unread body holds its connection open.** With a pool of one:

```console
$ node unread.mjs
   62 ms request 1: status 200 — body NOT read
(hangs — request 2 never starts)
```

That is the failure mode behind "the service works, then stops responding after a
while". Every response must be consumed or explicitly released:

```js
const res = await fetch(url);
if (!res.ok) { await res.body?.cancel(); throw new Error(res.status); }  // release it
```

`res.text()` counts as consuming. `res.body.cancel()` is the discard. Doing
neither leaks a connection per request — see [page 07](07-keep-alive-and-agents.md).

## Redirects, headers, bodies

```console
$ node fetchb.mjs
redirect -> status 200 | redirected: true | url: /json | json: {"id":7,"name":"ada"}
manual   -> status 302 | location: /json
```

Redirects are followed automatically, up to 20. `res.url` is the *final* URL and
`res.redirected` says whether it moved — worth checking when the target matters,
because a redirect to another host is an SSRF pivot.
`{ redirect: 'manual' }` returns the 3xx untouched; `'error'` rejects.

```js
new Headers({ accept: 'application/json' });     // case-insensitive get/set
headers.get('content-type');                     // null when absent, never undefined
headers.getSetCookie();                          // the array form — page 04
```

| `body` accepts | Content-Type Node sets |
|---|---|
| `string` | `text/plain;charset=UTF-8` |
| `URLSearchParams` | `application/x-www-form-urlencoded;charset=UTF-8` |
| `FormData` | `multipart/form-data; boundary=…` |
| `Blob` | the blob's own `type` |
| `Uint8Array` / `ArrayBuffer` | none — set it yourself |
| `ReadableStream` | none — requires `duplex: 'half'` |

```console
$ node fetchb.mjs
  server: content-type = multipart/form-data; boundary=----formda | bytes 265
```

**Never set `Content-Type` by hand alongside `FormData`** — you will overwrite the
generated boundary and the receiver cannot parse a single field. For JSON you set
it yourself, because a plain string defaults to `text/plain`:

```js
await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});
```

Streaming a request body needs `duplex: 'half'`, and it disables automatic
retries in the dispatcher because the body cannot be replayed.

## Request as a value

```js
const req = new Request(url, { method: 'GET', headers: { accept: 'application/json' } });
const res = await fetch(req);
```

A `Request` is a reusable description — handy for building a client where one
place applies auth and tracing headers, and callers pass an already-shaped
request. `new Request(req, { headers })` clones with overrides.

## Errors

```console
$ node causes.mjs
refused -> TypeError: fetch failed | cause.code: ECONNREFUSED | cause.syscall: connect
bad dns -> TypeError: fetch failed | cause.code: ENOTFOUND | cause.syscall: getaddrinfo
timeout -> TimeoutError: The operation was aborted due to timeout
```

Every transport failure is the same opaque `TypeError: fetch failed`. **The
diagnosis is in `err.cause`** — log it, or every outage looks identical. Aborts
are the exception: they reject with the signal's reason, so a `TimeoutError`
from `AbortSignal.timeout` or your own error object from `controller.abort(err)`.

## Gotchas

**Symptom:** A 500 from an upstream is stored as if it were data
**Cause:** `fetch` does not throw on HTTP errors.
**Fix:** Check `res.ok` before reading the body.

**Symptom:** The service stops making outbound calls after a while, no errors
**Cause:** Response bodies are never consumed, so pooled connections are never
released.
**Fix:** Read or `cancel()` every body, including on error paths.

**Symptom:** `Body is unusable`
**Cause:** The body was already consumed.
**Fix:** `res.clone()` before the first read, or read once into a variable.

**Symptom:** The receiver sees an empty multipart body
**Cause:** A hand-set `Content-Type` destroyed the generated boundary.
**Fix:** Let `FormData` set the header.

**Symptom:** POST body arrives as a string the server cannot parse
**Cause:** `JSON.stringify` without a `content-type` header — it goes as
`text/plain`.
**Fix:** Set `content-type: application/json`.

**Symptom:** Every outbound failure logs as `TypeError: fetch failed`
**Cause:** `err.cause` was not logged.
**Fix:** Log `err.cause?.code` alongside the message.

## Interview questions

**★ Does `fetch` throw on a 404?**
No. It rejects only when the exchange fails — DNS, connect, TLS, abort, malformed
response. A 404 is a completed exchange, so you get a `Response` with `ok: false`.
Every wrapper must check `res.ok` explicitly.

**★ What happens if you never read a response body?**
The connection stays checked out of the pool. With undici's default per-origin
pool it eventually exhausts and outbound calls hang with no error at all —
demonstrated above with `connections: 1`, where the second request never started.
Consume the body or call `res.body.cancel()`.

**★ Why can you only read a body once?**
It is a `ReadableStream` over the socket, not a buffer. Reading drains it. Use
`res.clone()` if you genuinely need two readers, accepting the memory cost of
buffering.

**★ How do you diagnose `TypeError: fetch failed`?**
Read `err.cause`. It carries the underlying `code` — `ECONNREFUSED`, `ENOTFOUND`,
`UND_ERR_SOCKET`, certificate errors — which is the only thing distinguishing a
DNS problem from a firewall problem.

**Why must you not set `Content-Type` when posting `FormData`?**
The boundary token is generated with the body. Overwriting the header leaves the
receiver without it, so the multipart payload cannot be parsed.

**What is `fetch` actually implemented by?**
undici, bundled inside Node. That is why the tuning knobs — pool size, keep-alive,
retries — live on an undici `Dispatcher` rather than on `fetch` itself.

---

← Prev: [Cookies](04-cookies.md) · Next → [Outbound timeouts](06-outbound-timeouts.md)
