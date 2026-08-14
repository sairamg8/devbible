---
title: "04 · URL and URLSearchParams"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`URL`](https://developer.mozilla.org/en-US/docs/Web/API/URL), [`URL()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL), [`URL.parse()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/parse_static), [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams), [`encodeURIComponent()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent), [`encodeURI()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURI). Documentation-validated.

**A URL is a structure with escaping rules, not a string.** Treat it as a string and the bugs
arrive in a predictable order: a doubled slash, then a truncated value at an `&`, then a `#` that
swallows half the query, then an id with a slash in it that 404s.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The URL object](./01-the-url-object.md)** | Every component and the three that mislead — `protocol` **includes the colon**, `host` carries the port while `hostname` does not, `search`/`hash` include their punctuation; mutating one part and letting the rest reserialise; why the constructor **throws** and when `URL.parse()`/`canParse()` are better; relative resolution in one table, including the two rules that make a version prefix vanish; and what `URL` is **not** — a validator, a security boundary on its own (the open-redirect `startsWith` bug), or the exact string the server sees |
| 2 | **[URLSearchParams](./02-urlsearchparams.md)** | Why a query string is a **multimap**; four constructor forms and the two traps — it *"does not parse full URLs"*, and the object form cannot repeat a key (`{tag:["a","b"]}` becomes `tag=a%2Cb`); `get` vs `getAll`, `null` vs `""`; `set` **deleting the other values** vs `append` accumulating them; iteration order, `sort()` for canonical forms, and `Object.fromEntries` silently dropping duplicates; the **live, read-only** link with `url.searchParams` |
| 3 | **[Encoding rules](./03-encoding-rules.md)** | The two percent-encode sets side by side, and the one difference that corrupts data — **space as `+` versus `%20`**, and why plus signs turn up in stored emails; which encoder for which position (params → `URLSearchParams`, **path segment → `encodeURIComponent` by hand, because `URL` will not escape a `/`**, whole URL → almost never `encodeURI`); the lossless `+` round trip; `URIError` from lone surrogates and `toWellFormed()`; and `decodeURIComponent` throwing on a bare `%` |

## The three sentences to keep

1. **Build with `new URL()` and `URLSearchParams`.** Every hand-built query string is correct
   until a value contains `&`, `=`, `#`, `+`, a space or a non-ASCII character.
2. **`set` replaces every value for a key; `append` adds one.** Getting this backwards makes
   parameters accumulate on every interaction, or silently drops a multi-select.
3. **`URLSearchParams` encodes space as `+`, `encodeURIComponent` as `%20`.** Decode with the
   same rules you encoded with, or `+` becomes a literal plus in your database.

## Phase gate

You are done with this topic when you can name the difference between `host`, `hostname` and
`origin` and say which one a redirect check must use; predict what
`new URL("42", "https://x.test/v2/orders")` resolves to; explain why `{tag: ["a","b"]}` does not
produce two parameters; and say which encoder belongs in a path segment and why.

## Where this connects

- [03 · A `fetch` wrapper worth reusing](../03-fetch-wrapper/README.md) — where the base-URL rules land in practice
- [02 · Request bodies](../02-request-bodies/README.md) — the same `URLSearchParams` as a form-encoded body
- [Phase 5 · 09 · JSON](../../phase-5-built-in-library/09-json/README.md) — the other serialisation boundary user data crosses
- [Phase 9 · 06 · Sanitising HTML](../../phase-9-dom/06-sanitising-html/README.md) — the neighbouring "escape for the right context" problem

---

Start → [01 · The URL object](./01-the-url-object.md)
