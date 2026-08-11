---
title: "node:url"
sidebar_label: "05 · node:url"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`URL` and `URLSearchParams` are globals implementing the WHATWG standard —
the same objects the browser has. They handle the encoding, the escaping and the
relative resolution that string manipulation gets wrong.**

The legacy `url.parse()` API is <strong>⚠ Deprecated</strong> (DEP0169) and has
known parsing differences from the standard that have caused SSRF bypasses. Use
`new URL()`.

## Parsing

```js
// url.mjs
const u = new URL('https://api.example.com:8443/v1/orders?limit=50&q=a+b&tag=x&tag=y#frag');
for (const k of ['href', 'protocol', 'host', 'hostname', 'port', 'pathname', 'search', 'hash', 'origin']) {
  console.log(k.padEnd(9), JSON.stringify(u[k]));
}
```

```console
$ node url.mjs
href      "https://api.example.com:8443/v1/orders?limit=50&q=a+b&tag=x&tag=y#frag"
protocol  "https:"
host      "api.example.com:8443"
hostname  "api.example.com"
port      "8443"
pathname  "/v1/orders"
search    "?limit=50&q=a+b&tag=x&tag=y"
hash      "#frag"
origin    "https://api.example.com:8443"
```

Two distinctions that cause real bugs:

- **`host` includes the port; `hostname` does not.** An allowlist check against
  `host` fails the moment a port appears. Compare `hostname`.
- **`protocol` keeps the colon** — `'https:'`, not `'https'`.

## Query strings

```js
// params.mjs
const u = new URL('https://a.test/x?limit=50&q=a+b&tag=x&tag=y');
console.log('get   :', u.searchParams.get('q'));       // decoded
console.log('getAll:', u.searchParams.getAll('tag'));  // repeated keys
u.searchParams.set('limit', '100');
u.searchParams.delete('tag');
console.log('after :', u.href);

const sp = new URLSearchParams({ a: '1', b: 'x y' });
console.log('serialised:', sp.toString(), '| space became +');
console.log('encodeURIComponent:', encodeURIComponent('x y'));
```

```console
$ node params.mjs
get   : a b
getAll: [ 'x', 'y' ]
after : https://a.test/x?limit=100&q=a+b
serialised: a=1&b=x+y | space became +
encodeURIComponent: x%20y
```

**`searchParams` decodes on read and encodes on write**, so you never call
`encodeURIComponent` yourself for query values. Note the asymmetry it inherits
from the form-encoding standard: a space serialises as `+` in a query string and
as `%20` via `encodeURIComponent`. Both decode back to a space; mixing them
manually is how you end up with a literal `+` in someone's search term.

`getAll` matters because **`get` silently returns only the first value.** A
handler reading `?id=1&id=2` with `get('id')` processes one and ignores the
other — which is a real authorisation bypass shape when one value is checked and
another is used.

## Building URLs, not concatenating them

```js
// build.mjs
const base = 'https://api.example.com/v1/';
console.log(new URL('orders', base).href);
console.log(new URL('/orders', base).href);          // leading slash resets the path
console.log(new URL('../v2/x', 'https://a.test/v1/y/z').href);

const search = new URL('/search', base);
search.searchParams.set('q', 'coffee & cake');
search.searchParams.set('page', '2');
console.log(search.href);
```

```console
$ node build.mjs
https://api.example.com/v1/orders
https://api.example.com/orders
https://a.test/v1/v2/x
https://api.example.com/search?q=coffee+%26+cake&page=2
```

The second line is the trap in the two-argument form: **a leading `/` discards
the base's path.** `new URL('/orders', 'https://api.example.com/v1/')` is
`/orders`, not `/v1/orders`. Same rule as an HTML `<a href>`, and the same
surprise.

The `&` in the query value was escaped to `%26` automatically — the thing string
concatenation gets wrong and that turns into a parameter-injection bug.

## Relative URLs need a base

```js
// nobase.mjs
try { new URL('/just/a/path'); } catch (err) { console.log(err.code, '|', err.message); }
console.log('URL.canParse:', URL.canParse('nope'), URL.canParse('https://a.test'));
```

```console
$ node nobase.mjs
ERR_INVALID_URL | Invalid URL
URL.canParse: false true
```

`new URL()` **throws** on invalid input. For user-supplied URLs use
`URL.canParse(input)` (Node 18.17+) or `URL.parse(input)` (Node 22+, returns
`null` instead of throwing) rather than a `try`/`catch` in a hot path.

## File URLs — the ESM bridge

```js
// fileurl.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';

console.log('import.meta.url     :', import.meta.url);
console.log('fileURLToPath       :', fileURLToPath(import.meta.url));
console.log('directory           :', fileURLToPath(new URL('.', import.meta.url)));
console.log('pathToFileURL       :', pathToFileURL('/tmp/my file.txt').href);
console.log('naive concatenation :', 'file://' + '/tmp/my file.txt');
```

```console
$ node fileurl.mjs
import.meta.url     : file:///…/p4/fileurl.mjs
fileURLToPath       : /…/p4/fileurl.mjs
directory           : /…/p4/
pathToFileURL       : file:///tmp/my%20file.txt
naive concatenation : file:///tmp/my file.txt
```

**`file://` + path is wrong** — a space must be `%20`, and on Windows the drive
letter and backslashes need converting. `fileURLToPath` and `pathToFileURL` are
the only correct conversions.

In practice `import.meta.dirname` ([page 03](03-path.md)) covers most of what
people used `fileURLToPath` for. It is still needed to build a path *relative to
the current module*:

```js
const templates = fileURLToPath(new URL('./templates/', import.meta.url));
// or, equivalently on Node 21.2+:
const templates2 = path.join(import.meta.dirname, 'templates');
```

Most `fs` functions accept a `file:` URL directly, so you can often skip the
conversion entirely:

```js
const config = JSON.parse(await readFile(new URL('./config.json', import.meta.url), 'utf8'));
```

## Validating URLs from users (SSRF)

Parsing is not validation. If your server fetches a user-supplied URL, check the
parsed parts:

```js
// ssrf.mjs — the minimum
const ALLOWED_PROTOCOLS = new Set(['https:']);

function assertSafeUrl(input) {
  const u = URL.parse(input);                       // null instead of throwing
  if (!u) throw new Error('invalid url');
  if (!ALLOWED_PROTOCOLS.has(u.protocol)) throw new Error('protocol not allowed');
  if (u.username || u.password) throw new Error('credentials in url');
  if (/^(localhost|\[?::1\]?|0\.0\.0\.0)$/i.test(u.hostname)) throw new Error('loopback');
  if (/^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname)) throw new Error('private range');
  return u;
}
```

This is the *shape*, not a complete defence — DNS can still resolve a public
name to a private address, so production SSRF protection also pins the resolved
IP. Phase 8 covers it properly. What belongs here: **check `protocol` and
`hostname` on the parsed object, never with a regex on the raw string.**

## Gotchas

**Symptom:** `TypeError [ERR_INVALID_URL]` on user input
**Cause:** `new URL()` throws for relative or malformed URLs.
**Fix:** `URL.canParse()` / `URL.parse()`, or supply a base.

**Symptom:** `new URL('/orders', base)` lost the base path
**Cause:** A leading slash resets to the origin root.
**Fix:** Drop the leading slash for a relative join, and end the base with `/`.

**Symptom:** A hostname allowlist rejects valid requests with a port
**Cause:** Compared against `host` instead of `hostname`.
**Fix:** Use `hostname`; check `port` separately if it matters.

**Symptom:** Query values with `&`, `=` or `+` arrive mangled
**Cause:** Built the query with string concatenation.
**Fix:** `searchParams.set` and let it encode.

**Symptom:** Only the first of repeated parameters is seen
**Cause:** `get` returns the first value.
**Fix:** `getAll`, and decide explicitly whether repeats are allowed.

**Symptom:** Spaces become `+` where `%20` was expected
**Cause:** Query strings use form encoding; path segments use percent-encoding.
**Fix:** `searchParams` for the query, `encodeURIComponent` for path segments.

**Symptom:** `ERR_UNSUPPORTED_ESM_URL_SCHEME` or a path with `%20` in it
**Cause:** String-built `file://` URL, or a `file:` URL passed where a path was
expected.
**Fix:** `pathToFileURL` / `fileURLToPath`.

## Interview questions

**★ Why is `url.parse()` deprecated?**
It predates the WHATWG standard and parses some inputs differently from browsers
and from `new URL()` — differences that have been used for SSRF and open-redirect
bypasses. `new URL()` is the standard-conformant parser.

**★ What is the difference between `host` and `hostname`?**
`host` includes the port (`api.example.com:8443`); `hostname` does not. Allowlist
checks should use `hostname`.

**★ How do you add a query parameter safely?**
`url.searchParams.set(key, value)` — it percent-encodes the value. Concatenating
`?q=` + value breaks on `&`, `=` and spaces and can inject extra parameters.

**★ Why not build a `file://` URL by concatenation?**
Because paths need percent-encoding (a space is `%20`) and Windows drive letters
and backslashes need conversion. `pathToFileURL` handles both;
`'file://' + path` produces an invalid URL.

**What happens with repeated query parameters?**
`get` returns the first only; `getAll` returns them all. Reading with `get` while
something downstream uses the last value is a genuine bypass pattern.

**How do you parse a URL that might be invalid, without try/catch?**
`URL.canParse(input)` to test, or `URL.parse(input)` (Node 22+) which returns
`null` instead of throwing.

---

← Prev: [Path traversal](04-path-traversal.md) · Next → [File streams](06-file-streams.md)
