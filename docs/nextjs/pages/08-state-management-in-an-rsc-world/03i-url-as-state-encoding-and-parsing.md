---
title: "There are no numbers, booleans or dates in a URL — only text that resembles them — so URL state needs an encoding you chose on purpose and a normalising read that survives ?flag=false and a repeated key"
sidebar_label: "03i · Encoding and parsing query state"
sidebar_position: 127
description: "How to encode arrays, ranges, booleans, numbers and dates into a query string; repeated keys versus comma-separated values; the + and encodeURIComponent hazards; and the four normalising helpers every codebase ends up writing."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [`page.js`](https://nextjs.org/docs/app/api-reference/file-conventions/page) (`lastUpdated: 2026-06-09`),
> [`useSearchParams`](https://nextjs.org/docs/app/api-reference/functions/use-search-params) (`lastUpdated: 2026-07-14`) and
> [nuqs — Built-in parsers](https://nuqs.dev/docs/parsers/built-in) (`nuqs` **2.10.1**).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8**.
> Documentation-verified; **no sandbox run**.

**Every value in a query string is a string, or an array of strings, or absent. There are no numbers, no booleans, no dates — only text that resembles them, produced by a serialiser you either chose deliberately or improvised three different ways in three components. This page is the encoding decision and the normalising read that goes with it. The other half, turning a normalised value into one you can trust, is [03j](03j-url-as-state-validating-and-canonical-urls.md) — because a URL is user input, and shape is not meaning.**

## Encoding: pick a shape and write it down once

There is no standard for putting an array or a date range in a query string. There are conventions, and the only genuinely wrong move is having three of them in one codebase.

| State | Encoding | Example | Why |
|---|---|---|---|
| Single string | as-is | `?q=deploy` | — |
| Enum | as-is, checked against a literal list | `?status=blocked` | Readable, indexable, and the list *is* the validation |
| Number | decimal text | `?page=3` | Coerce on read; never trust the range |
| Boolean | `?archived=1`, or the key's presence | `?archived` | Avoid `true`/`false` — `'false'` is truthy |
| Small array | comma-separated | `?tags=api,ui,infra` | Compact, human-readable, one key |
| Array with commas in values | repeated key | `?tag=a,b&tag=c` | The native form; the page prop hands you `['a,b','c']` |
| Range | two keys | `?min=5&max=20` | Each half independently editable and validatable |
| Date | ISO 8601 date | `?from=2026-09-01` | Sorts as text, unambiguous, no timezone surprise |
| Date-time | ISO 8601 with offset | `?at=2026-09-01T09:00:00Z` | Never a locale-formatted string |
| Anything structured | a stable id, not the object | `?view=saved_17` | Length limits — [03j](03j-url-as-state-validating-and-canonical-urls.md) |

Two of those rows are worth arguing about.

### Booleans

`?archived=false` parsed with `Boolean(value)` gives `true`, because `'false'` is a non-empty string. This is a real production bug with a one-line fix, and it is why presence-based flags and `1`/`0` are both safer than the words. The App Router makes the presence form pleasant: a bare `?archived` resolves to `''` on the page prop, and to `''` from `useSearchParams().get()`, while an absent key is `undefined` on the server and `null` on the client.

### Arrays

Comma-separated wins on readability. Repeated keys win on correctness, because values containing commas need no escaping — and because the App Router already parses them for you:

| Example URL | `searchParams` resolves to |
|---|---|
| `/shop?a=1` | `Promise<{ a: '1' }>` |
| `/shop?a=1&a=2` | `Promise<{ a: ['1', '2'] }>` |

— from [`page.js`, `searchParams`](https://nextjs.org/docs/app/api-reference/file-conventions/page#searchparams-optional).

⚠️ The client hook does **not** match: `useSearchParams().get('a')` returns `'1'` for `?a=1&a=2` — *"use `getAll()` to get all values"* ([`useSearchParams`, Returns](https://nextjs.org/docs/app/api-reference/functions/use-search-params#returns)). A repeated-key array read with `.get()` on the client and destructured on the server disagrees about its own URL, and the disagreement only appears when a user actually selects two values.

`nuqs` ships both encodings, which is a fair cross-check that neither is wrong:

> *"All of the parsers on this page can be used to parse arrays of their respective types."* — with an optional custom separator, `parseAsArrayOf(parseAsInteger, ';')`
> *"If you want to use the native URL format for arrays, repeating the same key multiple times … you can now use `MultiParsers` like `parseAsNativeArrayOf` to read and write those values in a fully type-safe way."*
> — [nuqs, Built-in parsers](https://nuqs.dev/docs/parsers/built-in)

It also ships a pagination-specific parser worth stealing conceptually: *"Same as integer, but adds a `+1` offset to the serialized querystring (and `-1` when parsing). Useful for pagination indexes."* A `?page=1` in the URL and a `0` in your code is exactly the off-by-one everyone writes by hand once.

## Encoding hazards that produce real bugs

- **`+` means space in a query string.** `?q=a+b` is `a b`, not `a+b`. `URLSearchParams` handles this correctly in both directions; strings built with template literals do not.
- **`encodeURIComponent` on the whole query string is wrong.** It escapes the `&` and `=` that give the string its structure. Encode values only — or better, let `URLSearchParams.toString()` do it.
- **A comma is legal unescaped in a query string**, and so is a space once encoded. Do not infer that a value is "safe" because it survived a round trip.
- **Key order is not stable and must never be meaningful.** Two URLs differing only in key order are the same state and different cache keys.
- **An empty value is not the same as an absent key.** `?q=` gives `''`; no `q` at all gives `undefined` on the server and `null` on the client. Coercing all three the same way is a decision, so make it once.

## Parsing: normalise at the boundary, once

Every read has to answer three questions before the value is usable: is it there, is it singular, and is it the right shape?

```ts filename="lib/query.ts"
export function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function many(value: string | string[] | undefined): string[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

export function csv(value: string | string[] | undefined): string[] {
  return many(value)
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean)
}

export function flag(value: string | string[] | undefined): boolean {
  const v = one(value)
  return v === '' || v === '1' || v === 'true'   // presence, 1, or the word
}
```

`flag` deserves its explicit list. `?archived` with no value resolves to `''`, which is a legitimate "yes"; `?archived=0` and `?archived=false` are both "no", and neither would be under `Boolean(v)`.

`csv` handles both array encodings at once — it accepts `?tags=a,b`, `?tag=a&tag=b` and `?tag=a,b&tag=c` — which is usually the right defensive posture for a parameter that has existed long enough to have been written by two different versions of your own code.

## Serialising back out

The read helpers have a mirror, and it belongs in the same module so the two cannot drift:

```ts filename="lib/query.ts"
export function toQuery(state: {
  status?: string
  tags?: string[]
  page?: number
  archived?: boolean
}): string {
  const params = new URLSearchParams()
  if (state.status) params.set('status', state.status)
  if (state.tags?.length) params.set('tags', state.tags.join(','))
  if (state.page && state.page > 1) params.set('page', String(state.page))
  if (state.archived) params.set('archived', '1')
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}
```

Note what it never does: it never interpolates a value into a template literal, so encoding is `URLSearchParams`' problem rather than yours, and it never writes `archived=0` — a false flag is expressed by absence, which keeps the URL short and matches how `flag` reads it.

## Gotchas

**★ Symptom: `?archived=false` hides nothing — the archive filter is on.** Cause: `Boolean('false')` is `true`; every non-empty string is truthy. Fix: parse booleans against an explicit list of accepted tokens.

```ts
export function flag(value: string | string[] | undefined): boolean {
  const v = Array.isArray(value) ? value[0] : value
  return v === '' || v === '1' || v === 'true'
}
```

**★ Symptom: searching for `a+b` returns results for `a b`.** Cause: `+` is the query-string encoding of a space. Fix: never hand-build the query string; let `URLSearchParams` encode.

```ts
const params = new URLSearchParams()
params.set('q', 'a+b')          // serialises as q=a%2Bb
```

**★ Symptom: the page 404s because someone encoded the entire query string.** Cause: `encodeURIComponent` was applied to `status=open&sort=age`, escaping the `&` and `=` that give it structure. Fix: encode values, not the string.

```ts
// ❌ `?${encodeURIComponent('status=open&sort=age')}`
`?${new URLSearchParams({ status: 'open', sort: 'age' }).toString()}`   // ✅
```

**★ Symptom: selecting two tags highlights one chip on the client while the server filtered by both.** Cause: `useSearchParams().get()` returns only the first value of a repeated key; the server prop gives the array. Fix: `getAll()` on the client for any key that can repeat.

```tsx
const tags = searchParams.getAll('tag')     // ✅ ['api', 'ui']
// ❌ const tags = [searchParams.get('tag')]
```

**★ Symptom: a filter works from the filter bar and not from a bookmark a user built by hand.** Cause: two array encodings in one codebase — one component writes `?tags=a,b`, another reads `?tag=a&tag=b`. Fix: one shared reader that accepts both, and one shared writer that emits one.

```ts
export function csv(value: string | string[] | undefined): string[] {
  return (value === undefined ? [] : Array.isArray(value) ? value : [value])
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean)
}
```

**★ Symptom: `?q=` and no `q` at all behave differently in two places.** Cause: an empty value is `''` and an absent key is `undefined` on the server and `null` on the client — three states coerced inconsistently. Fix: one coercion, shared by both sides.

```ts
export function text(value: string | string[] | null | undefined): string {
  const v = Array.isArray(value) ? value[0] : value
  return v ?? ''            // '' , null and undefined all become ''
}
```

**★ Symptom: page numbers are off by one between the URL and the code.** Cause: the UI is 1-based and the query is 0-based, and the conversion lives at three call sites. Fix: convert once, in the parse and serialise pair.

```ts
export const pageFromUrl = (v: string | string[] | undefined) =>
  Math.max(0, (Number(Array.isArray(v) ? v[0] : v) || 1) - 1)   // ?page=1 -> 0
export const pageToUrl = (index: number) => String(index + 1)   // 0 -> ?page=1
```

**★ Symptom: a date filter works in London and is a day out in Auckland.** Cause: a `Date` was serialised with `toString()` or a locale format, so the value carried a timezone-dependent rendering rather than a date. Fix: serialise ISO 8601 date-only for a calendar day, ISO with an offset for an instant.

```ts
params.set('from', day.toISOString().slice(0, 10))   // 2026-09-01
params.set('at', instant.toISOString())              // 2026-09-01T09:00:00.000Z
```

## Interview questions

**★ Why is `?flag=false` a bug magnet?**
Because `'false'` is a non-empty string, and every non-empty string is truthy in JavaScript. `Boolean(searchParams.get('flag'))` is therefore `true` for the value that literally spells "no". The consequences are quiet — a filter that never turns off, an archive that is always included — and they survive code review because the code reads correctly in English. The fixes are all explicit: compare against a list of accepted tokens, use `1`/`0`, or use key presence, where the absent key is `undefined`/`null` and the present one is `''`. Whichever you choose, write it once in a helper rather than at each call site.

**★ Repeated keys or comma-separated values for an array?**
Repeated keys (`?tag=a&tag=b`) are the native form: the App Router resolves them to a real array on the page prop with no parsing, values containing commas need no escaping, and the semantics are unambiguous. Comma-separated (`?tags=a,b`) is shorter and more readable in the address bar, which matters when the URL is meant to be shared and eyeballed, but it needs a split, a trim and a decision about values that contain commas. Pick one per codebase and put it in the shared module — and note the asymmetry that makes mixing them dangerous: the server prop gives you the whole array for a repeated key while `useSearchParams().get()` gives only the first, so the two sides of your app can disagree about the same URL.

**★ What does `+` mean in a query string, and why does it matter?**
It is the historical encoding for a space, inherited from HTML form submission. `?q=a+b` therefore means the query `a b`, and a literal plus has to be written `%2B`. It matters because hand-built query strings — template literals, string concatenation — get this wrong in both directions: a user's `+` is swallowed on write, and a space is not restored on read unless the parser knows the convention. `URLSearchParams` implements the convention correctly on both `set` and `get`, which is the practical argument for never constructing a query string by interpolation.

**★ Why should the serialiser and the parser live in the same module?**
Because they are one format expressed twice, and every divergence is a bug that only appears on a URL nobody generated from the UI. If the writer emits `?tags=a,b` and a reader elsewhere expects `?tag=a&tag=b`, everything works until a user bookmarks a link, edits it, or receives one from a colleague running an older deploy. Colocating them makes the format a single definition with two directions, so a change to the encoding necessarily updates both. This is also the strongest structural argument for a library — a typed parser object that generates the reader, the writer and the type from one declaration.

**★ How should a date be encoded in a URL?**
As ISO 8601: date-only (`2026-09-01`) when the value is a calendar day, and a full instant with an offset (`2026-09-01T09:00:00Z`) when it is a moment in time. Both sort correctly as plain text, both are unambiguous across locales, and both survive a round trip through any HTTP client. What must never appear is a locale-formatted string or the output of `Date.prototype.toString()`, because those encode the *server's* or *browser's* timezone into a value that will later be read somewhere else — the classic symptom being a date filter that is correct in one office and a day out in another.

---

← [03h · Shallow updates and the History API](03h-url-as-state-shallow-updates-and-the-history-api.md) · [Chapter 8 overview](01-explanation.md) · Next → [03j · Validating query state, and canonical URLs](03j-url-as-state-validating-and-canonical-urls.md)
