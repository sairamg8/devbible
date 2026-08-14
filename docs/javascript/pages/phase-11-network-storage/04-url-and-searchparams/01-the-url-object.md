---
title: "04.1 · The URL object"
sidebar_label: "01 · The URL object"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`URL`](https://developer.mozilla.org/en-US/docs/Web/API/URL), [`URL()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL), [`URL.parse()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/parse_static), [`URL.canParse()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/canParse_static). Documentation-validated.

**A URL is a structure, not a string.** Every bug in this area comes from treating it as one:
concatenating paths, regexing out a query parameter, or checking `startsWith("https://admin.")`
to decide whether a redirect is safe.

## Parsing one

```js
const url = new URL("https://user:pw@api.example.com:8443/v2/orders?status=open&page=2#top");
```

MDN's descriptions of the parts, which are worth reading as a set because several are *not*
what the name suggests:

| Property | MDN |
|---|---|
| `href` | "A stringifier that returns a string containing the whole URL." |
| `origin` | "the origin of the URL, that is its scheme, its domain and its port." **Read only** |
| `protocol` | "the protocol scheme of the URL, **including the final `':'`**" |
| `host` | "the domain (that is the *hostname*) followed by (if a port was specified) a `':'` and the *port*" |
| `hostname` | "the domain of the URL" |
| `port` | "the port number of the URL" |
| `pathname` | "an initial `'/'` followed by the path of the URL, **not including** the query string or fragment" |
| `search` | "if any parameters are provided, this string includes all of them, **beginning with the leading `?`**" |
| `searchParams` | "A `URLSearchParams` object which can be used to access the individual query parameters found in `search`." **Read only** |
| `hash` | "a `'#'` followed by the fragment identifier" |
| `username` / `password` | "specified before the domain name" |

🔴 **Three of these trip people constantly:**

- **`protocol` includes the colon.** `url.protocol === "https"` is always false. It is
  `"https:"`. Every "why is my scheme check failing" is this.
- **`host` and `hostname` are different.** `host` carries the port when one is present,
  `hostname` never does. A security check written against `host` passes for
  `evil.com:8443`-shaped input differently than one written against `hostname`.
- **`search` and `hash` include their leading punctuation** — `"?status=open&page=2"` and
  `"#top"`. Slicing them off by hand (`search.slice(1)`) is a sign you should be using
  `searchParams` instead.

**`origin` is read-only**, as is `searchParams`. Everything else is writable, and writing to one
part reserialises the rest:

```js
url.pathname = "/v2/customers";
url.hash = "";
url.port = "";                       // drops :8443, and origin updates with it
String(url);                         // https://user:pw@api.example.com/v2/customers?status=open
```

That is the property that makes `URL` worth using: **you can change one component without
re-deriving the string**, and the serialisation stays correct — including the percent-encoding
you would otherwise have to remember.

## Invalid input throws — and that is a feature

```js
new URL("not a url");                // TypeError: Invalid URL
new URL("/orders");                  // TypeError — relative with no base
new URL("/orders", "https://api.example.com");   // fine
```

The constructor **throws** rather than producing a broken object. In a wrapper that means an
invalid URL fails at the line that built it, before a request goes out, instead of surfacing as
a confusing 404 from a server that never should have been asked.

When throwing is not what you want, two newer statics replace the `try`/`catch`:

> "**`URL.parse()`**: Creates and returns a `URL` object from a URL string and optional base URL
> string, **or returns `null`** if the passed parameters define an invalid URL."

> "**`URL.canParse()`**: Returns a boolean indicating whether or not a URL defined from a URL
> string and optional base URL string is parsable and valid."

```js
const url = URL.parse(userInput, BASE);
if (!url) return showInvalidUrlMessage();
```

Prefer `URL.parse()` over `canParse()` followed by `new URL()` — the latter parses twice and,
worse, invites a check-then-use gap where the two calls disagree because the input changed.

## Relative resolution, in one place

The second argument is a **base**, and the rules are RFC 3986's — the same ones a browser uses
for `<a href>`:

```js
const base = "https://api.example.com/v2/orders/";

new URL("42", base)             // …/v2/orders/42
new URL("./42", base)           // …/v2/orders/42
new URL("../customers", base)   // …/v2/customers
new URL("/health", base)        // https://api.example.com/health   ← path discarded
new URL("//cdn.example.com/x", base)  // https://cdn.example.com/x  ← scheme-relative
new URL("https://other.com/x", base)  // https://other.com/x        ← base ignored entirely
```

🔴 **The two that cost time**, already met in
[03 · URLs and parsing](../03-fetch-wrapper/02-urls-and-parsing.md):

- **A base with no trailing slash loses its last segment.** `new URL("42",
  "https://api.example.com/v2/orders")` → `…/v2/42`. The final component is treated as a file
  name and replaced, exactly as a relative link on a web page would.
- **A leading slash discards the base's whole path.** Only the origin survives.

Neither is a quirk of `URL`; both are how relative references have always resolved. But in a
client wrapper they present as "my API version prefix disappeared", which sounds like a bug in
your code and is not.

## What `URL` is not

⚠️ **It is not a validator.** `new URL("https://exaple.com")` succeeds — the typo is a perfectly
valid URL. It parses; it does not judge. Nor does it check that the host resolves, that the
scheme is one you support, or that the path exists.

⚠️ **It is not a security boundary by itself.** The classic open-redirect bug is:

```js
// ❌ user-controlled redirect target
if (target.startsWith("https://myapp.com")) location = target;
```

`https://myapp.com.evil.test/` passes that check. The structured version does not:

```js
const url = URL.parse(target);
if (url && url.origin === "https://myapp.com") location = url.href;   // ✅ compares origin
```

**Compare `origin`, not a prefix of the string.** `origin` is scheme + domain + port as a unit,
which is exactly the thing the same-origin policy reasons about — and it is read-only, so it
cannot be spoofed by a component the attacker controls.

⚠️ **`URL` is not the same as the URL a server sees.** The browser normalises: it lowercases the
scheme and host, resolves `.` and `..`, punycodes internationalised domains, and drops a default
port (`:443` on `https`). Two strings that differ can produce identical `href` values — which is
usually helpful, and is occasionally the reason a signature computed over the "same" URL does
not match.

## Where it comes for free

- `location` **is** a `URL`-like object in the browser, and `new URL(location.href)` gives you a
  real one you can mutate without navigating.
- `document.baseURI` is the correct base for resolving a link the way the page would.
- `fetch` accepts a `URL` object directly — no `.toString()` needed, as in
  [03 · URLs and parsing](../03-fetch-wrapper/02-urls-and-parsing.md).
- In Node, `URL` is a global with the same semantics, and `import.meta.url` gives a module its
  own URL to resolve against — the ESM replacement for `__dirname`
  ([Phase 8 · 01 · ES modules](../../phase-8-modules-errors/01-es-modules/README.md)).

## Gotchas

**Symptom:** `url.protocol === "https"` is never true
**Cause:** MDN: `protocol` includes *"the final `':'`"*.
**Fix:** Compare against `"https:"`.

**Symptom:** A host check passes for an unexpected port
**Cause:** `host` includes `:port`; `hostname` does not.
**Fix:** Pick deliberately — `hostname` for identity, `host` when the port matters, `origin` for
security comparisons.

**Symptom:** A query string arrives with a stray `?`
**Cause:** `search` includes its leading `?` by definition.
**Fix:** Use `searchParams` rather than slicing `search`.

**Symptom:** `TypeError: Invalid URL` on a path like `/orders`
**Cause:** A relative reference needs a base.
**Fix:** `new URL("/orders", base)` — or `URL.parse()` if you want `null` instead of a throw.

**Symptom:** The base URL's path segment disappears
**Cause:** No trailing slash on the base, or a leading slash on the reference.
**Fix:** Normalise: base ends with `/`, reference does not start with one.

**Symptom:** An open redirect gets through the check
**Cause:** `target.startsWith("https://myapp.com")` also matches
`https://myapp.com.evil.test/`.
**Fix:** Parse and compare `url.origin`.

**Symptom:** A URL signature/HMAC does not match on the server
**Cause:** The browser normalised the URL — case, default port, `.`/`..`, punycode.
**Fix:** Sign the normalised form, or sign the components rather than the string.

**Symptom:** `canParse()` says yes and `new URL()` still throws
**Cause:** Two parses of an input that changed in between, or a different base passed to each.
**Fix:** One call — `URL.parse()`.

## Interview questions

**★ Why use `URL` instead of string manipulation?**
Because a URL is a structure with escaping rules. `URL` gives you named components, correct
percent-encoding on serialisation, RFC 3986 relative resolution, and an immediate `TypeError`
on invalid input — none of which a template literal or a regex gets right for long.

**★ What is the difference between `host`, `hostname` and `origin`?**
`hostname` is the domain alone; `host` is domain plus port when one is present; `origin` is
scheme + domain + port, and is read-only. Security comparisons should use `origin`, because
that is the unit the same-origin policy is defined over.

**★ Why does a scheme check against `"https"` always fail?**
`protocol` includes the trailing colon — MDN: *"including the final `':'`"*. The value is
`"https:"`.

**★ How would you validate a user-supplied redirect target?**
Parse it with `URL.parse()` (returns `null` instead of throwing) and compare `url.origin`
against an allowlist. A `startsWith` check on the string is the classic open-redirect bug:
`https://myapp.com.evil.test/` passes it.

**★ `new URL("42", "https://api.example.com/v2/orders")` — what do you get?**
`https://api.example.com/v2/42`. Without a trailing slash the base's last segment is treated as
a file name and replaced. With the slash you get `/v2/orders/42`.

**★ `URL.parse()` versus `new URL()` in a `try`/`catch`?**
`URL.parse()` returns `null` on invalid input instead of throwing, so validation reads as a
normal branch. Prefer it to `canParse()` + `new URL()`, which parses twice and opens a
check-then-use gap.

**Is a URL that parses a valid URL?**
It is well-formed, nothing more. `https://exaple.com` parses fine. `URL` is a parser, not a
validator, and never a reachability check.

---

[Topic index](./README.md) · Next → [02 · URLSearchParams](./02-urlsearchparams.md)
