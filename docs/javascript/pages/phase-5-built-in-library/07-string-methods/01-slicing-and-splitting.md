---
title: "07.1 · Slicing and splitting"
sidebar_label: "01 · Slicing and splitting"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`String.prototype.substring`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/substring), [`slice`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/slice), [`at`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/at), [`split`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/split). Documentation-validated.

**Strings are immutable.** Every method on this page returns a **new** string and
leaves the original alone — there is no in-place edit, and no method here mutates. That
one fact removes a whole category of worry that arrays have.

What remains is choosing between three nearly-identical extractors, one of which
behaves surprisingly.

## `slice` versus `substring`

They take the same arguments and disagree on both edge cases. MDN documents each.

**Negative arguments.** `substring` *"treats negative or `NaN` arguments as if they were
`0`"*; `slice` *"counts backwards from the end of the string"*:

```js
const text = "Mozilla";
text.substring(-5, 2);  // "Mo"
text.substring(-5, -2); // ""

text.slice(-5, 2);      // ""
text.slice(-5, -2);     // "zil"
```

**Start greater than end.** `substring` *"swaps its two arguments"*; `slice` *"returns
an empty string"*:

```js
text.substring(5, 2);   // "zil"
text.slice(5, 2);       // ""
```

🔴 **Use `slice`.** It behaves like `Array.prototype.slice`, so one mental model covers
both, and its negative-index support is genuinely useful:

```js
filename.slice(-4);        // the last four characters
path.slice(0, -1);         // everything but the last character
```

`substring`'s argument-swapping is the dangerous half: a bug that produces `start > end`
returns a *plausible-looking substring* instead of an empty string, so the mistake never
surfaces. There is no case where you want that.

(`substr` — no "ing" — is a third, deprecated method with a `(start, length)` signature.
Do not use it.)

## `at` for single characters

```js
"Mozilla".at(0);    // "M"
"Mozilla".at(-1);   // "a"  ← the last character
"Mozilla"[-1];      // undefined
```

`at` accepts negative indices; bracket notation does not. `str[str.length - 1]` is the
old idiom and `str.at(-1)` replaces it. Both return `undefined` for an out-of-range
index — neither throws.

`charAt` is the legacy equivalent, and differs in returning an **empty string** rather
than `undefined` when out of range.

## `split`

```js
"a,b,c".split(",");        // ["a", "b", "c"]
"a,b,c".split(",", 2);     // ["a", "b"]  — the limit
"abc".split("");           // ["a", "b", "c"]
"abc".split();             // ["abc"]     — no separator: one element
"".split(",");             // [""]        — NOT an empty array
```

Three of those are worth holding:

- **`split()` with no separator returns a single-element array** containing the whole
  string. It does not split into characters.
- **`"".split(",")` is `[""]`, not `[]`.** So `csv.split(",").length` is `1` for empty
  input, and a "count the fields" check needs a guard. This is the shape behind
  countless off-by-one bugs in CSV and query-string parsing.
- **The `limit` argument truncates the result**, it does not stop splitting and keep the
  remainder. `"a,b,c".split(",", 2)` is `["a","b"]` — `"c"` is discarded, not appended.
  If you want "split on the first comma only", you want `indexOf` plus two `slice`s.

### `split("")` and Unicode

```js
"héllo".split("");         // splits into UTF-16 code units
[..."héllo"];              // splits into code POINTS
Array.from("héllo");       // same as spread
```

`split("")` splits by **code unit**, so any character outside the Basic Multilingual
Plane — emoji, many CJK extensions, mathematical symbols — is torn into two meaningless
halves. Spread and `Array.from` use the string iterator, which yields **code points**
and keeps such characters whole.

```js
"👍".length;          // 2   — two code units
"👍".split("").length; // 2  — broken into surrogate halves
[..."👍"].length;      // 1  — one code point
```

Even the code-point view is not the final answer: an emoji with a skin-tone modifier, or
a family emoji, is several code points that display as one grapheme. `Intl.Segmenter` is
the tool for true user-perceived characters. **For reversing a string, counting
"characters", or truncating for display, `split("")` is wrong.**

`str.length` has the same caveat — it counts **UTF-16 code units**, which is why `"👍"`
has length 2.

## Splitting with a regex

```js
"a1b22c".split(/\d+/);      // ["a", "b", "c"]
"a1b22c".split(/(\d+)/);    // ["a", "1", "b", "22", "c"]  — capture groups included
```

A capturing group in the separator puts the captured text **into the result**. That is
occasionally exactly what you want (tokenising while keeping the delimiters) and
occasionally a surprise.

## `join` is the inverse, with one trap

```js
["a", "b"].join("-");            // "a-b"
["a", null, undefined, "b"].join("-"); // "a---b"
```

`null` and `undefined` become **empty strings** in `join`, not the text `"null"`. So a
missing value silently becomes an empty field rather than an obvious marker — worth
knowing when building a CSV line.

## Gotchas

**Symptom:** `substring(a, b)` returned text when you expected an empty string
**Cause:** MDN: `substring` *"swaps its two arguments if `indexStart` is greater than
`indexEnd`"*, so a bug producing `start > end` yields a plausible result.
**Fix:** Use `slice`, which returns `""` and lets the bug surface.

**Symptom:** A negative index gave the wrong part of the string
**Cause:** `substring` treats negatives as `0`; only `slice` counts from the end.
**Fix:** `slice`.

**Symptom:** `str[-1]` is `undefined`
**Cause:** Bracket notation does not accept negative indices.
**Fix:** `str.at(-1)`.

**Symptom:** `"".split(",")` gave a length of `1`
**Cause:** It returns `[""]`, not `[]`.
**Fix:** Guard the empty case before splitting.

**Symptom:** `split(",", 2)` lost the rest of the string
**Cause:** `limit` **truncates the result array**; it does not keep the remainder.
**Fix:** `indexOf` plus two `slice`s for "split on the first occurrence only".

**Symptom:** An emoji turned into two broken characters
**Cause:** `split("")` and `length` work on **UTF-16 code units**; characters outside
the BMP occupy two.
**Fix:** `[...str]` or `Array.from(str)` for code points; `Intl.Segmenter` for
user-perceived characters.

**Symptom:** `join` produced empty fields where values were missing
**Cause:** `null` and `undefined` are converted to **empty strings** by `join`.
**Fix:** Map them to an explicit placeholder first.

## Interview questions

**★ Difference between `slice` and `substring`?**
Two documented differences: `substring` treats **negative arguments as `0`** while
`slice` counts back from the end, and `substring` **swaps its arguments** when
`start > end` while `slice` returns `""`. Use `slice` — it matches
`Array.prototype.slice`, and the swapping behaviour hides bugs.

**★ How do you get the last character of a string?**
`str.at(-1)`. Bracket notation does not accept negative indices, and the older
`str[str.length - 1]` still works. `at` returns `undefined` out of range;
`charAt` returns `""`.

**★ What does `"".split(",")` return?**
`[""]` — an array of one empty string, **not** an empty array. So a field count is `1`
for empty input, which is the source of a lot of off-by-one CSV bugs.

**★ Why is `split("")` wrong for splitting into characters?**
It splits by **UTF-16 code unit**, so anything outside the BMP — most emoji — is broken
into surrogate halves. `[...str]` and `Array.from(str)` use the string iterator and
yield **code points**. Even that is not "characters": `Intl.Segmenter` handles
graphemes.

**What does the `limit` argument to `split` do?**
It **truncates the returned array** — `"a,b,c".split(",", 2)` is `["a","b"]` and `"c"`
is discarded. It does not split once and keep the remainder; use `indexOf` plus `slice`
for that.

**Are strings mutable in JavaScript?**
No. Every string method returns a **new** string, so none of them can be used to edit in
place, and no defensive copying is ever needed.

---

[Topic index](./README.md) · Next → [Trimming, padding and replacing](./02-trimming-padding-replacing.md)
