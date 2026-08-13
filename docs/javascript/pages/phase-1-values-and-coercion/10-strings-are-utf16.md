---
title: "10 · Strings are UTF-16"
sidebar_label: "10 · Strings are UTF-16"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (ICU 78.3, Unicode 17.0).
> Script: `sandbox/js-p1/ex7-strings-symbols-bigint.mjs`.

**A JavaScript string is a sequence of UTF-16 code units, not characters.** For
ASCII the difference never shows. The moment a user types an emoji, an accented
name or a script outside the Latin alphabet, `.length` starts lying and naive
slicing corrupts data.

## Measured

```
string            : café🛒
.length (UTF-16)  : 6
[...s].length     : 5
Segmenter graphemes: 5

family emoji      : 👨‍👩‍👧 | .length 8 | spread 5 | graphemes 1
naive slice(0,2)  : "🛒" <- one full emoji, 2 code units
broken slice(0,1) : "\ud83d" <- half a surrogate pair
café NFC vs NFD   : false | after normalize: true
```

**`👨‍👩‍👧` is one character to a human, 8 to `.length`, 5 to spread, and 1 to
`Intl.Segmenter`.** All four numbers are correct answers to different questions.

## The three levels

| Level | Counted by | `café🛒` | `👨‍👩‍👧` |
|---|---|---|---|
| **Code units** (UTF-16) | `.length`, `charAt`, `slice`, `[i]` | 6 | 8 |
| **Code points** | `[...str]`, `for…of`, `codePointAt` | 5 | 5 |
| **Graphemes** (what a user calls a character) | `Intl.Segmenter` | 5 | 1 |

- A **code unit** is 16 bits. Characters above U+FFFF need **two** — a
  *surrogate pair*.
- A **code point** is one Unicode value. `🛒` is one code point, two code units.
- A **grapheme cluster** is what renders as one glyph. `👨‍👩‍👧` is three people
  joined by zero-width joiners — 5 code points, 1 grapheme.

## Why `.length` is still the right default

For a `maxlength` check on an SKU, a database column limit, or a byte budget,
code units are exactly what you want. `.length` is O(1) and correct for those.

It is wrong for **anything a user reads as "characters"** — a tweet-style
counter, truncating a product title, or reversing a string.

## Slicing safely

```
naive slice(0,2)  : "🛒" <- one full emoji, 2 code units
broken slice(0,1) : "\ud83d" <- half a surrogate pair
```

`slice(0, 1)` produced `\ud83d` — **half a surrogate pair**, a lone code unit
that is not a valid character. It renders as `�`, breaks JSON round-trips, and
corrupts anything downstream.

```js
// WRONG — can split a surrogate pair
title.slice(0, 20) + '…';

// Better — code points
[...title].slice(0, 20).join('') + '…';

// Correct — graphemes, so families and flags stay whole
const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
const graphemes = [...seg.segment(title)].map(s => s.segment);
graphemes.slice(0, 20).join('') + '…';
```

The same applies to reversing:

```js
[...'café🛒'].reverse().join('');       // works at code-point level
'café🛒'.split('').reverse().join('');  // corrupts the emoji
```

## `Intl.Segmenter`

Available in Node 24 and all current browsers. Three granularities:

```js
const words = new Intl.Segmenter('en', { granularity: 'word' });
[...words.segment('Buy 2 t-shirts')].filter(s => s.isWordLike).length;   // word count

const sentences = new Intl.Segmenter('en', { granularity: 'sentence' });
```

Word segmentation is locale-aware — it handles languages without spaces, which
`split(' ')` cannot.

## Normalisation: two identical-looking strings that are not equal

```
café NFC vs NFD   : false | after normalize: true
```

`é` can be stored two ways: one code point (U+00E9, **NFC**), or `e` followed by
a combining acute accent (U+0065 U+0301, **NFD**). They render identically and
are **not** `===`.

This is real: macOS filenames use NFD, most web input is NFC. A search for a
customer named "José" can fail to match the stored record.

```js
const key = (s) => s.normalize('NFC');
key(userInput) === key(storedValue);
```

**Normalise on the way in**, once, at the same boundary where you do everything
else ([page 09](./09-explicit-conversion.md)). NFC is the right default for
storage and comparison.

For case-insensitive comparison, `toLowerCase()` is not enough across locales —
use `localeCompare` with sensitivity, or `Intl.Collator` for sorting:

```js
'straße'.localeCompare('strasse', 'de', { sensitivity: 'base' });   // 0 in German
new Intl.Collator('en', { sensitivity: 'base' }).compare(a, b);
```

`Intl.Collator` is the correct way to sort product names — a plain `sort()`
compares code units, which puts `Z` before `a` and mangles accented letters.

## Escapes and code points

```js
'é'        // 'é'  — 4 hex digits, BMP only
'\u{1F6D2}'     // '🛒' — braces allow any code point
'🛒'.codePointAt(0);   // 128722
'🛒'.charCodeAt(0);    // 55357 — just the high surrogate
String.fromCodePoint(128722);   // '🛒'
```

Use `codePointAt`/`fromCodePoint`. The `charCodeAt`/`fromCharCode` pair operates
on code units and breaks on anything outside the BMP.

## Gotchas

**Symptom:** a character counter shows 2 for one emoji.
**Cause:** `.length` counts UTF-16 code units.
**Fix:** `[...str].length` for code points, `Intl.Segmenter` for what users see.

**Symptom:** a truncated title ends in `�`.
**Cause:** `slice` split a surrogate pair — measured as the lone `\ud83d`.
**Fix:** slice an array of code points or graphemes, not the raw string.

**Symptom:** a reversed string is corrupted.
**Cause:** `split('')` splits code units.
**Fix:** `[...str].reverse().join('')`. Combining marks still need
`Intl.Segmenter`.

**Symptom:** two visually identical strings are not equal.
**Cause:** different Unicode normalisation forms — NFC vs NFD.
**Fix:** `.normalize('NFC')` on both, at the boundary.

**Symptom:** sorting puts `Z` before `a`, or misplaces accented names.
**Cause:** `sort()` compares UTF-16 code units.
**Fix:** `Intl.Collator` or `localeCompare`.

**Symptom:** a string truncated to fit a database column still overflows.
**Cause:** the column limit is in **bytes**; UTF-8 uses up to 4 bytes per code
point.
**Fix:** measure with `new TextEncoder().encode(s).length`.

## Interview questions

**★ Why is `'🛒'.length` 2?**
Strings are sequences of UTF-16 code units. Code points above U+FFFF need two
code units — a surrogate pair — so `.length` counts 2. `[...'🛒'].length` is 1,
because spread iterates code points.

**★ How long is `👨‍👩‍👧`?**
Four defensible answers, all measured: 8 code units (`.length`), 5 code points
(spread), 1 grapheme (`Intl.Segmenter`), and 18 bytes in UTF-8. The right one
depends on the question — a database limit wants bytes or code units, a user
counter wants graphemes.

**★ How do you truncate a string safely?**
Not with `slice` — it can split a surrogate pair, measured as producing the lone
code unit `\ud83d`. Split into graphemes with `Intl.Segmenter`, slice that array,
and join. Code points via spread are an acceptable middle ground.

**Why might two identical-looking strings not be equal?**
Unicode normalisation. `é` can be one code point (NFC) or `e` plus a combining
accent (NFD); they render the same and are not `===`. Normalise both with
`.normalize('NFC')` — measured as turning `false` into `true`.

**How should you sort user-visible strings?**
`Intl.Collator` or `localeCompare`. The default `sort()` compares UTF-16 code
units, which places all uppercase before lowercase and misorders accented
characters for every locale.

---

← [09 · Explicit conversion](./09-explicit-conversion.md) · [Phase index](./) · Next: [11 · `NaN`](./11-nan.md) →
