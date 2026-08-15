---
title: "3 · Text — `Collator`, `ListFormat`, `PluralRules`, `Segmenter`"
sidebar_label: "3 · Collator, ListFormat, PluralRules, Segmenter"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Intl.Collator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator), [`Intl.Collator` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator/Collator), [`String.prototype.localeCompare()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare), [`Intl.ListFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/ListFormat), [`Intl.PluralRules`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules), [`Intl.PluralRules.prototype.select()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules/select), [`Intl.Segmenter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter), [`Intl.Segmenter.prototype.segment()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter/segment), [`String.prototype.normalize()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize). Documentation-validated; **no timings**.

Four constructors that have nothing to do with numbers or dates, and each one replaces a
piece of hand-written code that is wrong.

## `Collator` — sorting human text

```js
["Zoe", "Ähre", "apple"].sort();                    // 🔴 code-unit order: "Zoe" before "apple"
["Zoe", "Ähre", "apple"].sort(new Intl.Collator("de").compare);   // ✅ human order
```

🔴 **The default `sort()` compares UTF-16 code units**, so every uppercase letter sorts
before every lowercase one and accented letters land after `z`
([06 · `sort`](../06-sort/README.md)). That is never what a user list, a product list or a
directory should look like.

**`localeCompare` is the one-off form of the same thing:**

```js
a.localeCompare(b, "de");                       // ⚠️ builds a collator per call
arr.sort((a, b) => a.localeCompare(b));         // ⚠️ once per comparison — O(n log n) of them
arr.sort(new Intl.Collator().compare);          // ✅ one collator, reused
```

⚠️ **`localeCompare` inside a comparator is the same hidden-constructor mistake as
`toLocaleString` in a loop**, and it is worse here because a sort calls the comparator
many times per element. `collator.compare` is already a bound function you can hand
straight to `sort`.

### The two options that matter

```js
{ numeric: true }   // "item2" before "item10"  ✅
{ sensitivity: "base" }   // a = á = A  — for search and de-duplication
```

🔴 **`numeric: true` is the natural-sort option**, and it is the answer to "why is
`file10` before `file9`". No regex, no zero-padding:

```js
const natural = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
["file10", "file9", "file1"].sort(natural.compare);   // file1, file9, file10
```

**`sensitivity` decides what counts as "the same string":**

| Value | `a` vs `á` | `a` vs `A` |
|---|---|---|
| `"base"` | same | same |
| `"accent"` | different | same |
| `"case"` | same | different |
| `"variant"` (default) | different | different |

```js
new Intl.Collator("en", { sensitivity: "base" }).compare("resume", "résumé");   // 0 — equal
```

**That `0` is a locale-aware, accent-insensitive equality test** — the right primitive for
a filter box, and better than `toLowerCase()` comparison, which does not touch accents.
`usage: "search"` tunes the collator for matching rather than ordering.

⚠️ **`compare` returns a number, not a boolean.** `=== 0` for equality; negative and
positive for order, with no promise about the magnitude.

**When you need a canonical form rather than a comparison** — a database key, a slug —
that is `String.prototype.normalize()`, not a collator.

## `ListFormat` — "a, b and c"

```js
const lf = new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" });
lf.format(["apples", "pears", "plums"]);   // "apples, pears and plums"

new Intl.ListFormat("en-US", { type: "disjunction" }).format(["a", "b", "c"]);
// "a, b, or c"
```

**Three `type`s:** `"conjunction"` (and), `"disjunction"` (or), `"unit"` (no connector —
for lists of measurements). **Three `style`s:** `"long"`, `"short"`, `"narrow"`.

⚠️ **What it replaces is worse than it looks.** The hand-written version is
`arr.slice(0, -1).join(", ") + " and " + arr.at(-1)`, which has to special-case zero, one
and two items, hard-codes the word "and", hard-codes the comma, and takes a position on
the Oxford comma that differs between `en-GB` and `en-US`. `ListFormat` knows all of it,
including that many languages do not use a comma at all.

**It also composes with the other formatters**, which is where it earns its place:

```js
lf.format(prices.map((p) => money.format(p)));   // "$1.00, $2.50 and $3.00"
```

## `PluralRules` — the one everybody gets wrong

```js
const pr = new Intl.PluralRules("en-US");
pr.select(0);   // "other"
pr.select(1);   // "one"
pr.select(2);   // "other"
```

🔴 **`count === 1 ? "item" : "items"` encodes English's plural rules into your code**, and
English has one of the simplest systems there is. Many languages have three, four or six
categories, with rules that depend on the last digit, the last two digits, and whether the
number has a fractional part.

**The six possible category names are `"zero"`, `"one"`, `"two"`, `"few"`, `"many"` and
`"other"`.** English uses two of them. Which categories a language uses, and which numbers
map to each, is CLDR data — not something to reason about from first principles.

```js
const MESSAGES = { one: "1 file", other: "{n} files" };
const label = MESSAGES[pr.select(n)].replace("{n}", nf.format(n));
```

**Ordinals are a separate mode**, and English needs all of it:

```js
const ord = new Intl.PluralRules("en-US", { type: "ordinal" });
const SUFFIX = { one: "st", two: "nd", few: "rd", other: "th" };
const nth = (n) => `${n}${SUFFIX[ord.select(n)]}`;

nth(1);    // "1st"
nth(2);    // "2nd"
nth(3);    // "3rd"
nth(4);    // "4th"
nth(21);   // "21st"
nth(111);  // "111th"
```

🔴 **That last pair is why you do not write the `% 10` version yourself.** `21` is `st`
and `111` is `th`, and the hand-rolled rule that gets `21` right usually gets `111` wrong.

⚠️ **`PluralRules` selects a category; it does not hold your strings.** It is the
*selector* an i18n library uses underneath. For one or two messages, the object lookup
above is enough; for a real translated product, the strings belong in a message catalogue
and `PluralRules` is what that catalogue keys on.

## `Segmenter` — counting characters correctly

```js
"👍🏽".length;                                    // 🔴 4 — UTF-16 code units
[..."👍🏽"].length;                               // 🔴 2 — code points
new Intl.Segmenter().segment("👍🏽").length;      // — see below
```

🔴 **Neither `.length` nor spreading gives a character count.** `.length` counts UTF-16
code units and spreading counts code points, but what a *reader* calls one character is a
**grapheme cluster** — an emoji plus its skin-tone modifier, a family emoji joined by
zero-width joiners, a letter plus a combining accent
([Phase 1 · 10 · Strings are UTF-16](../../phase-1-values-and-coercion/10-strings-are-utf16.md)).

**`Segmenter` is the only correct answer in the language:**

```js
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const count = (s) => [...graphemes.segment(s)].length;   // ✅ what a person would count
```

**`segment()` returns an iterable of objects, not strings:**

```js
for (const { segment, index, isWordLike } of words.segment(text)) { … }
```

**Three granularities:**

| `granularity` | Splits into | Use for |
|---|---|---|
| `"grapheme"` | user-perceived characters | length limits, truncation, cursor movement |
| `"word"` | words, with `isWordLike` marking real words vs punctuation | word counts, search indexing |
| `"sentence"` | sentences | previews, summaries |

```js
const words = new Intl.Segmenter(undefined, { granularity: "word" });
const wordCount = [...words.segment(text)].filter((s) => s.isWordLike).length;
```

⚠️ **`text.split(" ")` is not a word count**, and `split(/\s+/)` is not either — Chinese,
Japanese and Thai do not separate words with spaces. `Segmenter` uses the locale's own
rules, which is the entire reason it takes a locale.

🔴 **The place this actually bites: truncation.** Cutting a string with `slice` can split a
grapheme cluster and leave a broken character on screen — or, with an emoji flag or a
family, a completely different character:

```js
const truncate = (s, max) => {
  const parts = [...graphemes.segment(s)];
  return parts.length <= max ? s : parts.slice(0, max).map((p) => p.segment).join("") + "…";
};
```

## Gotchas

**Symptom:** Sorted names put every capital before every lowercase, and accents last
**Cause:** The default `sort()` compares UTF-16 code units.
**Fix:** `arr.sort(new Intl.Collator().compare)`.

**Symptom:** Sorting a large list was slow
**Cause:** `localeCompare` inside the comparator builds a collator on every comparison.
**Fix:** Build one `Intl.Collator` and pass its `compare`.

**Symptom:** `file10` sorted before `file9`
**Cause:** Text ordering compares character by character.
**Fix:** `{ numeric: true }` on the collator.

**Symptom:** A search box missed "résumé" when the user typed "resume"
**Cause:** `toLowerCase()` comparison does not touch accents.
**Fix:** A collator with `sensitivity: "base"`, comparing `=== 0`.

**Symptom:** A translated UI said "1 files" or the wrong plural form
**Cause:** `n === 1 ? … : …` encodes English's rules; other languages have up to six
categories.
**Fix:** `Intl.PluralRules.select(n)` keyed into a message catalogue.

**Symptom:** "111st"
**Cause:** A hand-written ordinal rule based on `% 10`.
**Fix:** `Intl.PluralRules` with `type: "ordinal"`.

**Symptom:** A character counter disagreed with what the user could see
**Cause:** `.length` counts UTF-16 code units; even spreading counts code points, not
grapheme clusters.
**Fix:** `Intl.Segmenter` with `granularity: "grapheme"`.

**Symptom:** Truncation produced a broken or different emoji
**Cause:** `slice` cut through a grapheme cluster.
**Fix:** Segment first, then take whole graphemes.

**Symptom:** A word count was zero for Japanese text
**Cause:** Splitting on whitespace.
**Fix:** `Segmenter` with `granularity: "word"` and the `isWordLike` filter.

## Interview questions

**★ Why is `array.sort()` wrong for a list of names?**
It compares UTF-16 code units, so all uppercase letters sort before all lowercase ones and
accented characters land after `z`. `new Intl.Collator(locale).compare` sorts the way the
locale's readers expect. Pass the collator's `compare` rather than calling `localeCompare`
inside the comparator, which constructs a collator on every comparison.

**★ How do you make `file10` sort after `file9`?**
`new Intl.Collator(undefined, { numeric: true })`. It compares embedded digit runs as
numbers, which removes the usual workarounds of zero-padding or regex-splitting the key.

**★ Why is `count === 1 ? "item" : "items"` a bug?**
It hard-codes English's two-category plural system. CLDR defines six possible categories —
zero, one, two, few, many, other — and many languages use several, with rules depending on
the last digit, the last two digits and whether the value has a fraction.
`Intl.PluralRules.select(n)` returns the category, which you key a message catalogue on.

**★ How do you count the characters in a string containing emoji?**
`Intl.Segmenter` with `granularity: "grapheme"`. `.length` counts UTF-16 code units and
spreading counts code points; a user-perceived character is a grapheme cluster, which can
be several code points — an emoji plus a skin-tone modifier, or a ZWJ sequence. The same
tool is what makes truncation safe.

**★ How would you do an accent-insensitive comparison?**
A collator with `sensitivity: "base"`, then test `compare(a, b) === 0`. It treats `a`, `á`
and `A` as equal in a locale-aware way, which `toLowerCase()` does not.
`usage: "search"` tunes it for matching. For a canonical stored form, `String.prototype.normalize()`
is the right tool instead.

**What does `Intl.ListFormat` save you from?**
Hard-coding the connector word, the separator and the Oxford-comma decision — all of which
differ by locale and even between `en-GB` and `en-US` — plus special-casing lists of zero,
one and two items. It composes with the other formatters, so a list of formatted prices is
one expression.

**Why does `Segmenter` need a locale?**
Because word and sentence boundaries are language-specific. Chinese, Japanese and Thai do
not separate words with spaces, so whitespace splitting returns one "word" for a whole
paragraph.

---

← [2 · Dates and relative time](./02-dates-and-relative-time.md) · [Topic index](./README.md) · [Phase index](../README.md) →
