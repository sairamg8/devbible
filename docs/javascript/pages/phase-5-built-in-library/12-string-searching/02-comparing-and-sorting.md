---
title: "2 · Comparing and sorting human text"
sidebar_label: "2 · Comparing and sorting"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`String.prototype.localeCompare()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare), [`Intl.Collator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator), [`String.prototype.normalize()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize), [`String.length`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/length), [`String.prototype.codePointAt()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/codePointAt), [`String.fromCodePoint()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/fromCodePoint), [`Intl.Segmenter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter), [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort), [UTF-16 characters, Unicode code points, and grapheme clusters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Text_formatting). Documentation-validated; **no timings**.

## `sort()` on strings is not alphabetical

```js
["Zebra", "apple", "Äpfel"].sort();
// ["Zebra", "apple", "Äpfel"]   🔴 not what any reader expects
```

The default comparator compares **UTF-16 code units**, so every uppercase letter sorts before every
lowercase one, and accented characters land after `z` entirely. It is deterministic and it is not
alphabetical in any language.

```js
["Zebra", "apple", "Äpfel"].sort((a, b) => a.localeCompare(b));
// ["apple", "Äpfel", "Zebra"]   ✅
```

**`localeCompare` returns a negative number, zero, or a positive number**, which is exactly the
comparator contract from [06 · `sort`](../06-sort/README.md). ⚠️ Do not assume it returns `-1`/`1` —
compare against zero.

### It genuinely depends on the locale

```js
"ä".localeCompare("z", "de");   // negative — German treats ä as a variant of a
"ä".localeCompare("z", "sv");   // positive — Swedish sorts ä AFTER z
```

Both are correct. **A "correct" alphabetical order does not exist independent of a locale**, which
is why the browser's collation data exists and why hand-rolled comparison tables are always wrong
for somebody.

### For sorting a list, build one `Intl.Collator`

```js
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
names.sort(collator.compare);
```

MDN recommends this over calling `localeCompare` in the comparator: the collator is built once with
its options and locale data instead of being re-resolved on every comparison. `collator.compare` is
already bound, so it can be passed directly.

### The two options you will actually use

```js
// numeric: natural ordering of embedded numbers
["file10", "file2"].sort(new Intl.Collator(undefined, { numeric: true }).compare);
// ["file2", "file10"]   ✅ — without it, "file10" comes first

// sensitivity: what counts as equal
const loose = new Intl.Collator(undefined, { sensitivity: "base" });
loose.compare("resume", "RÉSUMÉ");   // 0 — case and accents ignored
```

| `sensitivity` | Treats as equal |
|---|---|
| `"base"` | case **and** accents ignored — `a` = `A` = `á` |
| `"accent"` | case ignored, accents matter — `a` = `A`, `a` ≠ `á` |
| `"case"` | accents ignored, case matters |
| `"variant"` *(default)* | everything distinct |

**`numeric: true` is the answer to "why is file10 before file2"**, and it is the one option most
projects should have turned on and have not.

## The same text can be encoded two ways

```js
const a = "café";              // é as one code point  (U+00E9)
const b = "café";        // e + combining acute   (U+0065 U+0301)

a === b;          // 🔴 false
a.length;         // 4
b.length;         // 5
a.includes("é");  // true
b.includes("é");  // 🔴 false
```

**They render identically.** One arrives from a form on macOS, the other from a Windows client or a
different database, and every equality check, `includes`, `Set` membership and object key silently
disagrees.

🔴 **The fix is `normalize()`, applied at the boundary** — the same place everything else untrusted
gets normalised ([Phase 4 · 15](../../phase-4-objects-and-classes/15-normalising-untrusted-shapes/02-normalising-at-the-boundary.md)):

```js
a.normalize("NFC") === b.normalize("NFC");   // true
```

**NFC (composed) is the right default** for storage and comparison. Do it once on input, not at
every comparison site.

⚠️ **`Intl.Collator` handles this for comparison already** — it normalises as part of collation. The
`normalize()` call matters for `===`, `Set`, `Map` keys, and anything you store.

## `length` counts code units, not characters

```js
"👍".length;        // 🔴 2 — one emoji, two UTF-16 code units (a surrogate pair)
[..."👍"].length;    // 1 — spreading iterates by code point
"👍".charAt(0);      // half a surrogate pair — renders as garbage
"👍".at(0);          // same problem
"👨‍👩‍👧".length;        // 8 — a family emoji is several code points joined by ZWJ
```

Three different units, and the right one depends on the question:

| Unit | How to iterate | Use for |
|---|---|---|
| **code unit** (UTF-16) | `s[i]`, `s.length` | storage sizes, and almost nothing else |
| **code point** | `[...s]`, `for...of`, `codePointAt` | most text processing |
| **grapheme** (what a reader calls a character) | `Intl.Segmenter` | truncation, counters, cursor movement |

```js
const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
[...seg.segment("👨‍👩‍👧")].length;   // 1 — one visible character
```

🔴 **Truncating with `slice` can cut a surrogate pair in half** and produce a replacement character
in the UI. A "140 characters" counter built on `.length` is wrong for every emoji and most
non-Latin scripts. `Intl.Segmenter` is the correct tool and is worth knowing exists even if you
reach for it rarely.

## Gotchas

**Symptom:** A sorted list of names looks wrong — capitals first, accents at the end
**Cause:** The default comparator compares UTF-16 code units.
**Fix:** `sort(new Intl.Collator(locale).compare)`.

**Symptom:** `file10` sorts before `file2`
**Cause:** Lexicographic comparison of digits.
**Fix:** `Intl.Collator` with `numeric: true`.

**Symptom:** Two visually identical strings are not `===`
**Cause:** Different Unicode normalisation forms — composed vs decomposed.
**Fix:** `normalize("NFC")` at the boundary, once.

**Symptom:** A `Set` contains what looks like the same name twice
**Cause:** Same reason — the two encodings are different keys.
**Fix:** Normalise before inserting.

**Symptom:** `localeCompare` returned something other than `-1`/`1`
**Cause:** It is specified to return a negative, zero, or positive number.
**Fix:** Compare against zero; never test for `=== -1`.

**Symptom:** A character counter is wrong for emoji
**Cause:** `length` counts UTF-16 code units; an emoji is two, and a ZWJ sequence is many.
**Fix:** `Intl.Segmenter` with grapheme granularity.

**Symptom:** Truncated text ends in a `�`
**Cause:** `slice` cut a surrogate pair in half.
**Fix:** Segment first, then take whole graphemes.

**Symptom:** Sorting a large list feels sluggish with `localeCompare` in the comparator
**Cause:** Locale and options are re-resolved per comparison.
**Fix:** Build one `Intl.Collator` and pass `collator.compare` — MDN's own recommendation. (**No timings here**; measure your own case.)

## Interview questions

**★ Why does `["Zebra", "apple"].sort()` put `Zebra` first?**
The default comparator compares UTF-16 code units, and every uppercase letter has a lower code unit
than every lowercase one. Accented characters sort after `z` entirely. Pass
`new Intl.Collator(locale).compare` for anything a person reads.

**★ Why prefer `Intl.Collator` over `localeCompare` when sorting?**
The collator resolves its locale and options once instead of on every comparison, and
`collator.compare` can be passed straight to `sort`. MDN recommends it for exactly this.

**★ How do you sort `file2` before `file10`?**
`new Intl.Collator(undefined, { numeric: true }).compare`. Without the option the digits are
compared lexicographically, so `"1"` beats `"2"`.

**★ Why can two identical-looking strings not be equal?**
Unicode normalisation. `é` can be a single code point or `e` plus a combining accent; they render
the same and are different strings, with different lengths. `normalize("NFC")` at the boundary fixes
it for `===`, `Set` and `Map` keys — `Intl.Collator` already handles it for comparison.

**★ Why is `"👍".length` equal to 2?**
`length` counts UTF-16 code units, and that emoji is a surrogate pair. Spreading or `for...of`
iterates code points and gives 1; a ZWJ sequence like a family emoji is several code points, so even
that is not "one character" — `Intl.Segmenter` with grapheme granularity is.

**When does the code-unit/code-point difference actually cause a bug?**
Truncation and counting. `slice` can cut a surrogate pair in half and render a replacement
character, and a character counter built on `.length` is wrong for every emoji and most non-Latin
scripts.

**Where should `normalize()` be called?**
Once, at the boundary where text enters — the same place other untrusted input is normalised. Doing
it at every comparison site is both slower and easy to forget somewhere.

---

← [1 · Finding a substring](./01-finding-a-substring.md) · [Topic index](./README.md) · [Phase index](../README.md) →
