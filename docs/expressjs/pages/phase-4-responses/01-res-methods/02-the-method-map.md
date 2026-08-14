---
title: "The method map"
sidebar_label: "02 · The method map"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**Twenty-two methods on `res`, and only about seven of them end the request.
Knowing which are terminal, which are chainable and which quietly go through
`res.send` is most of what you need.**

> Verified: 2026-08-14 on **Express 5.2.1**. The method list is every
> `res.<name> =` assignment in `express@5.2.1`'s `lib/response.js`, in
> `sandbox/express-verify/node_modules/`; `res.redirect`, `res.location`,
> `res.append`, `res.set` and `res.type` are quoted from that file by function.
> **Reading source is not a run: nothing was executed for this page and it carries
> no console block.** Cross-checked against the
> [response reference](https://expressjs.com/en/5x/api/response.html), which
> documents `res.redirect`'s default of **302**.

## Terminal, chainable, or neither

**Terminal** — the request is over after these. Exactly one per request:

| Method | Sends | Goes through `res.send`? |
|---|---|---|
| `res.json(obj)` | JSON | ✅ yes |
| `res.jsonp(obj)` | JSONP, or JSON if no callback param | ✅ yes |
| `res.send(body)` | type-dispatched | — it *is* it |
| `res.sendStatus(code)` | the status text as `text/plain` | ✅ yes |
| `res.end([data])` | raw bytes — Node's own | ❌ no |
| `res.redirect([status,] url)` | a small negotiated body + `Location` | ❌ **no** |
| `res.sendFile(path, [opts], [cb])` | a file, with ranges and caching | ❌ no |
| `res.download(path, [name], [opts], [cb])` | `sendFile` + `Content-Disposition` | ❌ no |
| `res.render(view, [locals], [cb])` | a rendered template | ✅ via `send` |
| `res.format(obj)` | whatever the matched branch sends | depends on the branch |

**Chainable** — they return `res` and send nothing:

`res.status(code)` · `res.set(field, val)` / `res.header(…)` ·
`res.type(mime)` / `res.contentType(…)` · `res.append(field, val)` ·
`res.vary(field)` · `res.location(url)` · `res.links(obj)` ·
`res.cookie(name, val, [opts])` · `res.clearCookie(name, [opts])` ·
`res.attachment([filename])`

**Neither** — `res.get(field)` reads a header you set and returns a value.

🔴 **`res.status` and `res.set` are the two most commonly mistaken for terminal.**
`return res.status(400)` hangs; `return res.set('X-Foo', 'bar')` hangs. Both
return `res` so they chain, and a `return` in front of them reads as an ending
that never happens
([Phase 2 · 03 · chunk 02](../../phase-2-middleware/03-next-semantics/02-the-hang.md)).

## The three that do **not** go through `res.send`

Worth separating out, because everything chunk 01 described — ETag generation,
the `req.fresh` 304 downgrade, the 204 header stripping — **does not apply** to
them:

- **`res.end()`** is Node's. No content type, no length, no ETag, no negotiation.
  It is the right call when you have already written the response yourself, and
  the wrong one for anything you want Express's behaviour on.
- **`res.sendFile` / `res.download`** delegate to `send`/`serve-static`, which do
  their own `ETag`, `Last-Modified`, range and caching handling — a different and
  more capable implementation than `res.send`'s
  ([page 08](../08-streaming-and-downloads.md)).
- **`res.redirect`** builds its own body and calls `res.end` directly.

## `res.redirect` in full

```js
// express/lib/response.js — res.redirect()
var status = 302;
if (arguments.length === 2) { status = arguments[0]; address = arguments[1] }

address = this.location(address).get('Location');

this.format({
  text: () => { body = statuses.message[status] + '. Redirecting to ' + address },
  html: () => { body = '<p>' + statuses.message[status] + '. Redirecting to ' + escapeHtml(address) + '</p>' },
  default: () => { body = '' }
});

this.status(status);
this.set('Content-Length', Buffer.byteLength(body));

if (this.req.method === 'HEAD') this.end(); else this.end(body);
```

Four things people do not expect:

- **The default is 302**, i.e. "found / temporary". For a permanent move you must
  say `res.redirect(301, url)`, and for a redirect that must not change the method
  you want **307** or **308**. A 301/302 on a POST is permitted by clients to
  become a GET, which is how "the redirect lost my form data" happens.
- **It content-negotiates a body.** A redirect is not empty: it carries a
  one-line explanation as text or HTML depending on `Accept`, with a
  `Content-Length`. Harmless, occasionally surprising in tests that assert an
  empty body.
- **HEAD gets the headers without the body**, consistently with `res.send`.
- 🔴 **`res.location` percent-encodes and does not validate.**

```js
res.location = function location(url) { return this.set('Location', encodeUrl(url)); };
```

`encodeUrl` makes the URL safe to put in a header. It does **not** check where it
points. `res.redirect(req.query.next)` is an open redirect, and
`startsWith('/')` does not save you — `//evil.example` is protocol-relative and
`/\evil.example` is treated as protocol-relative by some clients. **Map a key to
a known path** rather than validating a URL
([Phase 9 · 05](../../phase-9-hardening/05-csrf-and-injection.md)).

## `res.set` and its sharp edges

```js
var value = Array.isArray(val) ? val.map(String) : String(val);

if (field.toLowerCase() === 'content-type') {
  if (Array.isArray(value)) throw new TypeError('Content-Type cannot be set to an Array');
  value = mime.contentType(value)
}
```

- **Everything is stringified.** `res.set('X-Count', 5)` sends `"5"`. A `null` or
  `undefined` becomes the literal strings `"null"` / `"undefined"` — which is
  almost never what you meant, and is a real way to leak a bug into a header.
- **Arrays are allowed** for multi-value headers, and **`Content-Type` as an array
  throws**.
- **`Content-Type` gets a charset added** by `mime.contentType`, which is why
  `res.set('Content-Type', 'text/html')` produces
  `text/html; charset=utf-8`.
- **The object form** — `res.set({'X-A': '1', 'X-B': '2'})` — just loops.

**`res.set` replaces; `res.append` accumulates.** For headers that legitimately
repeat — `Set-Cookie`, `Vary`, `Link` — `append` builds an array rather than
clobbering:

```js
res.append('Vary', 'Accept');
res.append('Vary', 'Accept-Encoding');    // both survive
```

Using `set` twice for `Vary` silently drops the first value, and that is a
cache-correctness bug rather than a cosmetic one.

## `res.type`

```js
var ct = type.indexOf('/') === -1
  ? (mime.contentType(type) || 'application/octet-stream')
  : type;
```

- **A value with no `/` is treated as an extension** and looked up:
  `res.type('json')` → `application/json; charset=utf-8`, `res.type('txt')` →
  `text/plain; charset=utf-8`.
- **An unknown extension falls back to `application/octet-stream`** rather than
  throwing — so a typo (`res.type('jsonn')`) produces a binary download prompt in
  a browser, with no error anywhere.
- **A value containing `/` is used verbatim**, with no charset added.

## Gotchas

**Symptom:** `return res.status(400)` or `return res.set(...)` hangs the request
**Cause:** Both are chainable, not terminal — they return `res` and send nothing
**Fix:** Chain a terminal call: `return res.status(400).json({…})`

**Symptom:** A POST redirect arrives at the target as a GET with no body
**Cause:** 301/302 permit a client to change the method. That is specified
behaviour, not a bug
**Fix:** 307 or 308, which preserve the method and body

**Symptom:** `Location` points at an attacker's site
**Cause:** `res.location`/`res.redirect` encode the URL but never validate it, and
`startsWith('/')` does not exclude protocol-relative `//evil.example`
**Fix:** Map a key to a known path; never redirect to a raw user-supplied URL

**Symptom:** Only the last `Vary` value is sent
**Cause:** `res.set` replaces
**Fix:** `res.append('Vary', …)`, or `res.vary(field)`, which is built for exactly
this

**Symptom:** A header contains the literal text `undefined`
**Cause:** `res.set` calls `String(val)` on whatever you passed
**Fix:** Guard before setting. Express will not warn you

**Symptom:** A response downloads as a file instead of rendering
**Cause:** `res.type` fell back to `application/octet-stream` for an unrecognised
extension — usually a typo
**Fix:** Check the string. There is no error for an unknown type

## Interview questions

**★ Which `res` methods are terminal?**
`json`, `jsonp`, `send`, `sendStatus`, `end`, `redirect`, `sendFile`, `download`,
`render`, and whichever branch `format` selects. Everything else — `status`,
`set`, `type`, `append`, `vary`, `cookie`, `location`, `links`, `attachment` —
is chainable and sends nothing.

**★ Which terminal methods skip `res.send`, and why does it matter?**
`end`, `redirect`, `sendFile` and `download`. It matters because everything
`res.send` does — content-type dispatch, `Content-Length`, ETag generation, the
`req.fresh` 304 downgrade, the 204 header stripping — does not happen for them.
`sendFile` has its own, richer caching implementation.

**★ What status does `res.redirect` default to, and when is that wrong?**
302. It is wrong when the move is permanent (301/308) and when the method must be
preserved — a 301 or 302 lets a client turn a POST into a GET, so use 307 or 308
if the body must survive.

**★ Is `res.redirect(req.query.next)` safe?**
No. `res.location` runs `encodeUrl`, which makes the value safe to put in a
header and says nothing about where it points. `//evil.example` is
protocol-relative and passes a `startsWith('/')` check. Map a key to a known path
instead.

**What is the difference between `res.set` and `res.append`?**
`set` replaces the header; `append` accumulates into an array. For headers that
may legitimately repeat — `Set-Cookie`, `Vary`, `Link` — `set` silently discards
the previous value, which for `Vary` is a cache-correctness bug.

**What does `res.type('jsonn')` do?**
Sets `application/octet-stream`. A value without a `/` is looked up as an
extension and an unknown one falls back to binary rather than throwing, so a typo
turns a JSON response into a download prompt with no error.

---

← Prev: [What `res.send` does](01-what-res-send-does.md) · Index: [res methods](README.md) · Next → [Choosing and shaping](03-choosing-and-shaping.md)
