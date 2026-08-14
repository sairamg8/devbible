---
title: "03.3 · Headers and bodies"
sidebar_label: "03 · Headers and bodies"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers), [`Headers.set()`](https://developer.mozilla.org/en-US/docs/Web/API/Headers/set), [`Headers.append()`](https://developer.mozilla.org/en-US/docs/Web/API/Headers/append), [Using FormData Objects](https://developer.mozilla.org/en-US/docs/Web/API/FormData/Using_FormData_Objects). Documentation-validated.

**This is the chunk where a wrapper usually breaks uploads.** The header logic looks trivial,
and the two ways it goes wrong — always setting `Content-Type`, and letting per-call headers
replace the defaults rather than merge with them — are the two most common bugs in hand-rolled
clients.

## The body decides the header, so the wrapper must ask

From [02 · Choosing a body](../02-request-bodies/01-choosing-a-body.md): `FormData`,
`URLSearchParams` and `Blob` set their own `Content-Type`; a **string** does not. A wrapper that
serialises everything to JSON and stamps `application/json` on every request therefore breaks
every file upload the moment one is added.

MDN's warning is unusually direct:

> "**Warning:** … ***do not* explicitly set the `Content-Type` header on the request**. Doing so
> will prevent the browser from being able to set the `Content-Type` header with the **boundary
> expression** it will use to delimit form fields in the request body."

So the wrapper needs one branch:

```js
function encodeBody(body) {
  if (body === undefined || body === null) return { body: undefined, type: undefined };

  const browserSetsIt =
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof Blob ||                 // File extends Blob
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body) ||             // TypedArray and DataView
    body instanceof ReadableStream;

  if (browserSetsIt)          return { body, type: undefined };   // 🔴 no header
  if (typeof body === "string") return { body, type: undefined }; // caller's business

  return { body: JSON.stringify(body), type: "application/json" };
}
```

🔴 **The `undefined` return is the important part.** It is not "no opinion" — it is an active
decision *not* to send a header, so the browser can generate `multipart/form-data;
boundary=----WebKitFormBoundary…`. And because the server then reports **an empty form** rather
than a header problem, the wrapper is the last place anyone looks.

**Why plain strings are left alone:** a caller sending a hand-built string usually knows what it
is — NDJSON, XML, `text/csv`, a signed payload — and will pass the header themselves. Guessing
here is worse than doing nothing, because a wrong `Content-Type` is harder to debug than a
missing one.

**`ArrayBuffer.isView`** rather than listing `Uint8Array`, `DataView` and the other nine typed
array constructors — it is true for every one of them, and it is the check that does not need
updating.

## Merging headers, not replacing them

This is the second bug, and it is quieter:

```js
// ❌ per-call headers replace the defaults entirely
const res = await fetch(url, { headers: options.headers ?? defaultHeaders });

// ❌ also wrong — object keys are case-sensitive, header names are not
const merged = { ...defaultHeaders, ...options.headers };
```

The spread version looks right and is not, because **header names are case-insensitive**. MDN:

> "In all methods of this interface, header names are matched by case-insensitive byte
> sequence."

A plain object is case-*sensitive*. So `{ "Content-Type": "application/json" }` spread with
`{ "content-type": "text/csv" }` produces an object with **both** keys, and what `fetch`
ultimately sends depends on how the object is enumerated. The `Headers` object exists to make
that impossible:

```js
function mergeHeaders(...sources) {
  const out = new Headers();
  for (const source of sources) {
    if (!source) continue;
    new Headers(source).forEach((value, name) => out.set(name, value));
  }
  return out;
}
```

`new Headers(source)` accepts an object literal, an array of pairs, or another `Headers` — MDN
shows the first two forms explicitly:

```js
let myHeaders = new Headers({ "Content-Type": "text/xml" });
myHeaders = new Headers([["Content-Type", "text/xml"]]);
```

So callers can pass whichever they like and the merge still works. Skipping falsy sources with
`if (!source) continue` is what lets the call site pass `null` for "no header from this layer"
without a conditional at every position.

## `set` versus `append` is a real decision

MDN:

> "the difference between `Headers.set()` and `Headers.append()` is that if the specified header
> does already exist and does accept multiple values, `Headers.set()` will overwrite the existing
> value with the new one, whereas `Headers.append()` will append the new value onto the end of
> the set of values."

For merging defaults, **`set` is what you want** — a later source should replace an earlier one,
not accumulate. Use `append` deliberately, and only for headers that are genuinely multi-valued
(`Accept`, `Accept-Language`, `Accept-Encoding`).

Using `append` in a merge loop is how a request ends up with
`Accept: application/json, application/json, application/json` after three layers of wrapper —
harmless-looking, and then one day a server parses only the first value, or rejects the
duplicate, and the bug is four years old.

## Headers you cannot set

`Host`, `Origin`, `Referer`, `Connection`, `Content-Length`, `Cookie` and the rest of the
**forbidden header names** are controlled by the browser; assignments from page code do not
reach the wire. MDN also notes that the mutation methods throw:

> "All of the Headers methods will throw a `TypeError` if you try to pass in a reference to a
> name that isn't a valid HTTP Header name … The mutation operations will throw a `TypeError` if
> the header is immutable."

Two practical consequences:

- **If a header you set is not arriving, check the forbidden list before blaming the server.**
  This costs people hours, because the code visibly sets it and the network tab visibly does not
  show it.
- **`Cookie` is on that list.** You do not attach cookies by setting a header — you opt into
  sending them with `credentials`, which is [04 · Auth and the 401 refresh](./04-auth-and-refresh.md).

Also note the response side: a **`Headers` object from a cross-origin response only exposes the
safelisted headers** unless the server sends `Access-Control-Expose-Headers`. So
`res.headers.get("x-request-id")` returning `null` is usually a CORS configuration fact, not a
missing header — [05 · CORS from the client side](../05-cors-client-side/README.md).

## Version 3 — headers wired in

```js
export function createClient({ baseUrl, defaultHeaders } = {}) {
  return async function request(path, { method = "GET", body, headers, ...rest } = {}) {
    const url = new URL(String(path).replace(/^\/+/, ""), baseUrl);
    const { body: encoded, type } = encodeBody(body);

    const finalHeaders = mergeHeaders(
      { Accept: "application/json" },
      type ? { "Content-Type": type } : null,   // 🔴 absent for FormData
      defaultHeaders,
      headers,                                   // per-call wins
    );

    const res = await fetch(url, { method, body: encoded, headers: finalHeaders, ...rest });
    if (!res.ok) { /* 01 · typed HttpError */ }
    return parse(res);
  };
}
```

**Order encodes precedence.** Later sources overwrite earlier ones, so a call site can override
`Accept`, or force a `Content-Type` when it really does know better. Putting `headers` last is
the entire reason the merge is a function rather than an object literal.

`Accept: application/json` is worth sending as a default: it is what makes a well-behaved server
return a JSON error body instead of an HTML error page — which is exactly the body the wrapper's
error path wants to read.

## Gotchas

**Symptom:** File uploads break, but only through the shared wrapper
**Cause:** The wrapper sets `Content-Type: application/json` unconditionally, destroying the
`multipart` boundary.
**Fix:** Skip the header entirely for `FormData`/`Blob`/`URLSearchParams`/stream bodies. MDN:
*"do not explicitly set the `Content-Type` header."*

**Symptom:** The server reports an empty form, not a header error
**Cause:** Same bug. Without the boundary the parser finds no fields at all.
**Fix:** Same fix — and look at the wrapper first, since the server's message points elsewhere.

**Symptom:** A per-call header is ignored
**Cause:** Defaults were applied *after* the caller's headers, or `headers` replaced the
defaults wholesale.
**Fix:** Merge with `Headers` and put the per-call source last.

**Symptom:** Two `Content-Type` headers, or an unpredictable one
**Cause:** Object spread merged `"Content-Type"` and `"content-type"` as different keys.
**Fix:** Merge through `new Headers()` — MDN: *"header names are matched by case-insensitive
byte sequence."*

**Symptom:** `Accept: application/json, application/json, application/json`
**Cause:** The merge used `append` instead of `set`.
**Fix:** `set` for merging defaults; `append` only for genuinely multi-valued headers.

**Symptom:** A header you set never arrives
**Cause:** It is a forbidden header name (`Host`, `Origin`, `Referer`, `Connection`,
`Content-Length`, `Cookie`), which the browser controls.
**Fix:** Use a custom name, or the right mechanism — `credentials` for cookies.

**Symptom:** `res.headers.get("x-request-id")` is `null` although the server sends it
**Cause:** Cross-origin responses expose only safelisted headers.
**Fix:** The server must send `Access-Control-Expose-Headers`.

**Symptom:** A binary upload gets JSON-stringified into `{}`
**Cause:** The encode branch checked only `FormData` and `Blob`, missing typed arrays.
**Fix:** `ArrayBuffer.isView(body)` covers every typed array and `DataView`.

## Interview questions

**★ Why does adding a file upload break an app that previously worked?**
The shared wrapper sets `Content-Type: application/json` on every request. For a `FormData` body
that destroys the boundary the browser would have generated, so the server parses no fields —
MDN: *"do not explicitly set the `Content-Type` header … Doing so will prevent the browser from
being able to set the `Content-Type` header with the boundary expression."* The symptom is an
empty form, which points away from the wrapper.

**★ Why merge headers through `Headers` rather than object spread?**
Because header names are case-insensitive — MDN: *"header names are matched by case-insensitive
byte sequence"* — while object keys are not. Spreading `"Content-Type"` and `"content-type"`
keeps both, and what gets sent depends on enumeration order.

**★ `set` or `append` when merging defaults with per-call headers?**
`set`. `append` accumulates values on headers that accept multiples, so three layers of wrapper
produce three copies of `Accept`. `append` is for deliberately multi-valued headers only.

**★ You set `Origin` on a request and it never arrives. Why?**
It is a forbidden header name — the browser controls it, precisely because CORS decisions on the
server depend on it being trustworthy. The same applies to `Host`, `Referer`, `Connection`,
`Content-Length` and `Cookie`.

**★ Which body types must the wrapper leave unlabelled?**
`FormData`, `URLSearchParams`, `Blob`/`File`, `ArrayBuffer` and typed arrays, and
`ReadableStream` — the browser derives the header (and, for `FormData`, the boundary). Only a
plain object being serialised to JSON gets a header from the wrapper; a caller-supplied string
gets none, because only the caller knows what it is.

**Why does `res.headers.get("x-total-count")` return `null` cross-origin?**
Only CORS-safelisted response headers are exposed to script unless the server lists others in
`Access-Control-Expose-Headers`. The header is on the wire; it is hidden from JavaScript.

---

← [02 · URLs and parsing](./02-urls-and-parsing.md) · [Topic index](./README.md) ·
Next → [04 · Auth and the 401 refresh](./04-auth-and-refresh.md)
