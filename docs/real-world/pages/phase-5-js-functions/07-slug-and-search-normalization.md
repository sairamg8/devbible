---
title: "Slug and search normalization"
sidebar_label: "07 · Slug & search normalization"
sidebar_position: 7
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against MDN —
> [`String.prototype.normalize()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize)
> and [Unicode character class escapes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Unicode_character_class_escape).
> Concept homes: **Unicode encoding and comparison** are
> [JavaScript 5·12](../../../javascript/pages/phase-5-built-in-library/12-string-searching/02-comparing-and-sorting.md)
> and [1·10](../../../javascript/pages/phase-1-values-and-coercion/10-strings-are-utf16.md);
> **server-side search** is [chapter 1·05](../phase-1-database/05-full-text-search.md).
> This chapter owns only what the *client* does to a string.

## The problem: two jobs that look like one

Both of these turn `"Café Crème — 250g"` into something tamer, and it is
tempting to write one function for both:

- **A slug** — `cafe-creme-250g` — goes in a URL and into a
  `slug text not null unique` column ([the schema](../phase-1-database/01-the-schema/01-conventions-identity-catalog.md)).
- **A search term** — what the user typed, cleaned up before it is sent to the
  search endpoint.

They have **opposite requirements**, and a shared helper gets one of them
wrong:

| | Slug | Search term |
|---|---|---|
| Lifetime | **Permanent** — it is an identifier, and links to it exist | **Transient** — it lives for one request |
| Losing information is | Fine, and the point | **Dangerous** — it may be the thing being searched for |
| Computed | **Once, at write time**, then stored | Every keystroke |
| Wrong result costs | A dead URL, forever | One bad result page |

**A slug is an identifier that happens to be readable. A search term is data.**
Everything below follows from that.

## Slugify

```js
// src/lib/slug.js
const NON_ALNUM = /[^a-z0-9]+/g;

export function slugify(input) {
  const base = input
    .normalize('NFD')          // é -> e + U+0301
    .replace(/\p{M}/gu, '')    // drop the combining marks
    .toLowerCase()
    .replace(NON_ALNUM, '-')   // everything else becomes a separator
    .replace(/^-+|-+$/g, '');  // no leading or trailing separator
  return base;                 // may be '' — see "when it returns nothing"
}
```

**`normalize('NFD')` then strip marks** is what folds accents. NFD is
*canonical* decomposition: `é` becomes `e` followed by the combining acute
accent, which the next line removes. The letter survives; the accent does not.

🔴 **The `u` flag on `/\p{M}/gu` is not optional.** MDN is explicit that `\p`
outside Unicode-aware mode is an *identity escape* — `/\p{M}/` without `u`
matches the literal text `p{M}`, so the accents are never stripped and nothing
throws. The function silently returns `café` instead of `cafe`, and the bug
surfaces as a duplicate-slug error weeks later.

⚠️ **Use NFD, not NFKD.** NFKD is *compatibility* decomposition and MDN warns
it is lossy in a way that changes appearance: the ligature `ﬀ` (U+FB00) becomes
two `f` characters, and superscripts flatten into ordinary digits. For a slug
that is arguably fine; the reason to avoid it is consistency — the same helper
must never be reached for by search code, where flattening `²` to `2` changes
what the user asked for.

## The slug is written once and then frozen

The unique constraint means the slug is an identifier, and identifiers do not
change because an editor fixed a typo in a product title. If the title changes
and the slug follows it, **every link anyone has ever shared breaks.**

So the rule for the admin surface is:

- **On create:** derive the slug from the title, then store it.
- **On update:** leave it alone. Editing the slug is a separate, deliberate
  action with a warning attached — and it should write a redirect from the old
  value rather than dropping it.

```js
// generate once; the DB's unique constraint is the arbiter, not a pre-check
export async function uniqueSlug(client, title, {table}) {
  const base = slugify(title) || 'item';
  for (let n = 0; ; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const {rowCount} = await client.query(
      `select 1 from ${table} where slug = $1`, [candidate],
    );
    if (rowCount === 0) return candidate;
  }
}
```

⚠️ **That loop is a suggestion, not a guarantee.** Two concurrent creates can
both see `cafe-creme` free and both try to insert it; one gets a `23505`. That
is correct and expected — the constraint is the real arbiter, and the insert
should catch `23505` and retry with the next suffix. Checking first is a
courtesy that makes the common case pretty, not a substitute for the
constraint. The same argument the
[checkout transaction](../phase-1-database/06-the-checkout-transaction/README.md)
makes about `ON CONFLICT`.

## When slugify returns nothing

`slugify('日本語の商品')` is `''`. Every character is stripped, because none of
them are `[a-z0-9]`. So is `slugify('---')`, and so is `slugify('™')`.

An empty slug is not a cosmetic problem: it produces the URL `/products/` and
violates `not null`. **Never let it reach the database.** The options, in the
order this app prefers them:

1. **Fall back to the id** — `product-4821`. Ugly, unique, and it never fails.
2. **Transliterate** — a library that maps scripts to Latin. Real dependency,
   real quality questions, and it is a product decision whether
   `nihongo-no-shohin` is better than a number for a Japanese-speaking customer
   who cannot read it either.
3. **Allow the script through** — modern browsers and Postgres handle Unicode
   URLs, and `/products/日本語の商品` is genuinely the most readable option for
   the audience that will read it. The costs are percent-encoding in logs, in
   analytics and in anything that copies a URL into a plain-text field.

This app takes option 1, because the storefront's slug is a routing key and its
readability is a nicety. **That is a decision, not a default** — and the empty
check is what forces someone to make it:

```js
const slug = slugify(title) || `${kind}-${id}`;
```

## Search normalization does much less

The search box sends the user's text to the API, and
[Postgres FTS](../phase-1-database/05-full-text-search.md) already lowercases,
stems and (with `unaccent`) folds accents using dictionaries that know the
language. **Doing that work again on the client makes results worse, not
better** — the client does not know the search configuration, and two
normalizations applied in sequence are not the same as one.

So the client's job is limited to what is unambiguously safe:

```js
// src/lib/search.js
export function normalizeQuery(raw) {
  return raw
    .normalize('NFC')            // one canonical spelling for equal text
    .replace(/\s+/gu, ' ')       // collapse runs of whitespace
    .trim()
    .slice(0, 128);              // bound it before it reaches the API
}
```

**`NFC`, not `NFD`.** Here the goal is that two visually identical strings
compare equal, which is composition, not decomposition — and NFC is what MDN
gives as the default form for exactly this reason. No case folding, no accent
stripping, no punctuation removal: `C++` and `Ω` and `naïve` all reach the
server intact, and the server decides what they mean.

⚠️ **The length cap is a boundary check, not cosmetics.** It belongs here
*and* on the server; this copy exists to avoid sending a megabyte of pasted
text on every keystroke through the
[debounced search box](../phase-4-react-ui/02-usedebounce-and-search.md).

## Sorting is a third job again

Neither helper sorts. `['Äpfel', 'Zebra', 'Apfel'].sort()` compares UTF-16 code
units, so `Ä` (U+00C4) sorts after `Z` (U+005A) — which is wrong in every
locale that has the letter. Sorting uses a collator:

```js
const collator = new Intl.Collator(locale, {sensitivity: 'base', numeric: true});
items.sort((a, b) => collator.compare(a.title, b.title));
```

`numeric: true` is what makes `item-2` sort before `item-10`. The full argument
— why `sort()` on strings is not alphabetical, and what `sensitivity` selects —
is [JavaScript 5·12 chunk 2](../../../javascript/pages/phase-5-built-in-library/12-string-searching/02-comparing-and-sorting.md).

## Gotchas

**Symptom:** Accents survive slugification — `café-crème`
**Cause:** `/\p{M}/g` without the `u` flag, which MDN specifies as an identity
escape matching the literal `p{M}`
**Fix:** `/\p{M}/gu`. It fails silently, so a test with an accented title is
the only thing that catches it

**Symptom:** `null value in column "slug" violates not-null constraint`
**Cause:** Every character was stripped — a non-Latin title, or punctuation only
**Fix:** The `|| \`${kind}-${id}\`` fallback; never let `''` leave `slugify`

**Symptom:** Shared links 404 after an editor fixed a typo in a title
**Cause:** The slug was recomputed on update
**Fix:** Derive on create only; slug edits are deliberate and write a redirect

**Symptom:** Duplicate key `23505` on slug during a bulk import
**Cause:** Concurrent inserts both passed the pre-check
**Fix:** Expected — catch `23505` and retry with the next suffix. The
constraint is the arbiter

**Symptom:** A product slug shadows a route — `/products/new` opens a product
**Cause:** No reserved-word list; a product genuinely titled "New" slugs to it
**Fix:** A reserved set checked in `uniqueSlug`, or a route shape that cannot
collide (`/products/p/:slug`). Decide once, at routing design time

**Symptom:** Searching `naïve` finds nothing, but `naive` works
**Cause:** The client stripped accents and the server's dictionary did not
expect it, or vice versa — the two normalizations disagree
**Fix:** The client sends NFC and nothing else; folding is the server's job

**Symptom:** Two identical-looking search terms return different results
**Cause:** One was NFC and one NFD — same text, different code points, and the
cache key differs
**Fix:** `normalize('NFC')` before the term is used as a cache key, which is
what `normalizeQuery` is for

**Symptom:** `RangeError` from `normalize`
**Cause:** A typo'd form string — MDN specifies `RangeError` when the form is
not one of the four
**Fix:** The four are `NFC`, `NFD`, `NFKC`, `NFKD`, and they are case-sensitive

**Symptom:** Sorted product lists put `Äpfel` last
**Cause:** `Array.prototype.sort()` comparing code units
**Fix:** `Intl.Collator` with the request's locale

**Symptom:** `item-10` sorts before `item-2`
**Cause:** Lexicographic comparison of digits
**Fix:** `numeric: true` on the collator

## Interview questions

1. **★ Why should the slug function and the search-normalization function not
   be the same function?** Because their requirements are opposite. A slug is a
   permanent identifier where losing information is the point; a search term is
   transient data where losing information may delete the thing being searched
   for. Sharing an implementation means one of them is over- or
   under-normalized, and the slug side's mistakes are permanent.
2. **★ What does `normalize('NFD')` followed by stripping marks actually do,
   and why that order?** NFD is canonical decomposition: it splits a precomposed
   character like `é` into a base letter plus a combining accent. Stripping
   marks then removes the accent and leaves the letter. Reversed, there are no
   separate marks to strip yet, so nothing happens.
3. **★ What breaks if you forget the `u` flag on `\p{M}`?** Nothing throws —
   `\p` becomes an identity escape and the pattern matches the literal string
   `p{M}`, which never occurs. Accents pass through untouched, so the failure
   shows up much later as a duplicate slug or an unexpected URL.
4. **Why NFD for slugs but NFC for search terms?** The slug wants
   decomposition so marks can be removed. The search term wants the opposite —
   a single canonical spelling so that two identical-looking strings compare
   and cache equal — and composition is what produces that.
5. **Why avoid NFKD here?** It is compatibility decomposition, which MDN warns
   is lossy in ways that change appearance: the `ﬀ` ligature becomes `ff`,
   superscripts flatten to digits. Acceptable for a slug, wrong for anything
   that must preserve what the user typed — and having one lossy helper in the
   codebase invites its use on the wrong side.
6. **`slugify` returns an empty string for a Japanese product title. What are
   the options?** Fall back to an id-based slug, transliterate with a library,
   or allow the script through in the URL. Each is a real trade — readability
   for the audience, a dependency and its quality, or percent-encoding
   everywhere the URL is copied. The important part is that the empty case is
   detected rather than reaching a `not null` column.
7. **Why check for slug uniqueness in the app if the database has a unique
   constraint?** Only to make the common case produce a tidy suffix. It is not
   a correctness mechanism — two concurrent creates can both pass the check —
   so the insert must still handle `23505` and retry. The constraint is the
   arbiter.
8. **Why not lowercase and strip punctuation before sending a search query?**
   Because the server's full-text configuration already does language-aware
   folding and stemming, and the client does not know which configuration is in
   use. Normalizing twice is not idempotent: the client can destroy
   distinctions the dictionary needed, and `C++` is the standard casualty.
9. **Where else does `normalize('NFC')` earn its place in a search flow?**
   As the cache key. Two visually identical queries in different normal forms
   are different strings, so without it the client-side cache misses and the
   same search is issued twice.
10. **Why does sorting need a third mechanism rather than reusing either
    helper?** Because sorting must not modify the strings at all — it compares
    them. `sort()` alone compares UTF-16 code units, which puts `Ä` after `Z`;
    `Intl.Collator` applies locale rules, and `numeric: true` additionally
    fixes `item-10` versus `item-2`.

---

← Prev: [Money and dates](06-money-and-dates/README.md) ·
Next → **Feature flags with a local override** *(not written yet)*
