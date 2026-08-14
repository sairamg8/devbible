---
title: "1 · Finding a substring"
sidebar_label: "1 · Finding a substring"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`String.prototype.includes()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes), [`String.prototype.indexOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/indexOf), [`String.prototype.lastIndexOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/lastIndexOf), [`String.prototype.startsWith()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith), [`String.prototype.endsWith()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith), [`String.prototype.search()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/search), [`String.prototype.toLowerCase()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/toLowerCase), [`String.prototype.toLocaleLowerCase()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/toLocaleLowerCase), [`String.prototype.at()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/at). Documentation-validated; **no timings**.

```js
const s = "the quick brown fox";

s.includes("quick");      // true
s.indexOf("quick");       // 4
s.indexOf("cat");         // -1
s.startsWith("the");      // true
s.endsWith("fox");        // true
```

**`includes` when you want a yes/no, `indexOf` when you need the position.** The old
`indexOf(x) !== -1` idiom still works and still appears everywhere, but it reads worse and has a
failure mode `includes` does not: `if (s.indexOf(x))` is **false when the match is at position 0**,
which is a real bug that a truthiness check invites.

```js
if (s.indexOf("the")) { … }        // 🔴 never runs — index 0 is falsy
if (s.indexOf("the") !== -1) { … } // ✅
if (s.includes("the")) { … }       // ✅ and says what it means
```

## The position arguments

All four take a second argument, and each means something slightly different:

```js
"hello".indexOf("l", 3);       // 3   — start searching from index 3
"hello".lastIndexOf("l", 2);   // 2   — search BACKWARDS from index 2
"hello".includes("llo", 2);    // true — start position
"hello".startsWith("llo", 2);  // true — treat index 2 as the start
"hello".endsWith("hell", 4);   // 🔴 true — treat index 4 as the END
```

⚠️ **`endsWith`'s argument is an end position, not a start** — it asks "does the string, if it were
only this long, end with this?". That makes `endsWith(x, n)` the natural way to test a suffix at a
known boundary, and it surprises everyone the first time.

`lastIndexOf` searching *backwards* from its position argument is the other asymmetry worth
remembering.

## `includes` rejects a regex — deliberately

```js
"abc".includes(/b/);   // 🔴 TypeError: First argument to String.prototype.includes
                       //    must not be a regular expression
```

`startsWith` and `endsWith` throw the same way. The reason is that a regex would be silently
stringified, and `"a/b/c".includes(/b/)` matching the literal characters `/b/` is worse than an
error.

🔴 **`indexOf` does not throw — it stringifies.** So `"a/b/".indexOf(/b/)` searches for the
three-character string `"/b/"` and can return a surprising match. When you want a pattern, say so:

```js
s.search(/\bfox\b/);   // index of the first match, or -1
/\bfox\b/.test(s);     // boolean — the direct answer
```

Regular expressions in full are topics **15 · Regular expressions — the syntax** and **16 · in
practice** *(not written yet)*.

## Case-insensitive searching, and the way that is wrong

```js
haystack.toLowerCase().includes(needle.toLowerCase());   // the common idiom
```

That is fine for ASCII and for most everyday text. It has two failure modes worth knowing before
you use it on real user data:

🔴 **`toLowerCase` is locale-independent, and some locales disagree with it.** In Turkish, the
uppercase of `i` is `İ` and the lowercase of `I` is `ı` — a dotless i. So a Turkish user searching
for `"ISTANBUL"` against `"istanbul"` gets a mismatch on a naive lowercase comparison:

```js
"I".toLowerCase();                // "i"
"I".toLocaleLowerCase("tr-TR");   // "ı"   — dotless
```

⚠️ **Case folding is not symmetric either** — the German `ß` uppercases to `SS`, so
`"STRASSE".toLowerCase()` is `"strasse"` while `"Straße".toLowerCase()` is `"straße"`, and the two
never match.

**The locale-aware comparison for equality** is a collator with a low sensitivity, covered in
[chunk 2](./02-comparing-and-sorting.md):

```js
new Intl.Collator(undefined, { sensitivity: "base" }).compare("resume", "RÉSUMÉ");   // 0
```

**Choose by stakes.** A client-side filter box over your own data: `toLowerCase` is fine. Matching
user identifiers, deduplicating names, or anything a person will dispute: use a collator, and
normalise first ([chunk 2](./02-comparing-and-sorting.md) again).

## Reading characters out

```js
const s = "hello";
s[0];         // "h"
s.charAt(0);  // "h"
s.at(-1);     // "o"   — negative indices, like arrays
s[10];        // undefined
s.charAt(10); // ""     ⚠️ empty string, not undefined
```

`at` is the modern one and matches
[03 · `slice` vs `splice` vs `at`](../03-slice-splice-at.md). ⚠️ **`charAt` returning `""` for an
out-of-range index** rather than `undefined` is the kind of difference that makes a `?? "default"`
fallback silently not fire.

**All of these index by UTF-16 code unit**, which is not the same as "character" for anything
outside the basic multilingual plane — the subject of [chunk 2](./02-comparing-and-sorting.md).

## Gotchas

**Symptom:** A check for a substring never fires, and the substring is definitely there
**Cause:** `if (s.indexOf(x))` — a match at index 0 is falsy.
**Fix:** `s.includes(x)`, or compare `!== -1` explicitly.

**Symptom:** `TypeError: First argument to String.prototype.includes must not be a regular expression`
**Cause:** A regex was passed where a string is required, deliberately rejected.
**Fix:** `regex.test(s)` or `s.search(regex)`.

**Symptom:** `indexOf` with a regex returned a strange index
**Cause:** Unlike `includes`, it stringifies the argument and searches for `"/b/"` literally.
**Fix:** Use `search` or `test` for patterns.

**Symptom:** `endsWith(x, n)` behaved unexpectedly
**Cause:** The second argument is where the string is treated as **ending**, not starting.
**Fix:** Read it as "truncate to n characters, then test the suffix".

**Symptom:** A case-insensitive search fails for a Turkish user
**Cause:** `toLowerCase` is locale-independent; Turkish has a dotless `ı`.
**Fix:** `toLocaleLowerCase(locale)`, or a collator with `sensitivity: "base"`.

**Symptom:** `"Straße"` and `"STRASSE"` never match
**Cause:** Case folding is not symmetric — `ß` uppercases to `SS`.
**Fix:** A collator, not case conversion.

**Symptom:** `charAt` returned `""` and a `??` fallback did not fire
**Cause:** `charAt` gives an empty string out of range; `??` only fires on `null`/`undefined`.
**Fix:** `at()` or bracket access, which give `undefined`.

## Interview questions

**★ `includes` or `indexOf`?**
`includes` for a yes/no — it says what it means and avoids the `if (s.indexOf(x))` bug, where a
match at index 0 is falsy. `indexOf` when you actually need the position, compared explicitly
against `-1`.

**★ Why does `includes` throw on a regular expression?**
Because the alternative is worse: a regex would be stringified and matched literally, so
`"a/b/c".includes(/b/)` would quietly search for the characters `/b/`. `startsWith` and `endsWith`
throw the same way — but `indexOf` does not, and does exactly that stringification.

**★ What is `endsWith`'s second argument?**
The position to treat as the **end** of the string, not the start. `"hello".endsWith("hell", 4)` is
`true`, because it tests the first four characters.

**★ What is wrong with `a.toLowerCase() === b.toLowerCase()` for case-insensitive matching?**
It is locale-independent, so it gets Turkish wrong — the lowercase of `I` there is a dotless `ı`.
And case folding is not symmetric: `ß` uppercases to `SS`, so `"Straße"` and `"STRASSE"` never
match. Use `Intl.Collator` with `sensitivity: "base"` when the stakes are real.

**★ How would you do a case-insensitive, accent-insensitive comparison properly?**
`new Intl.Collator(undefined, { sensitivity: "base" }).compare(a, b) === 0` — and normalise the
strings first, because the same visible character can be encoded more than one way.

**What is the difference between `charAt(i)` and `s[i]`?**
Out of range: `charAt` returns an empty string, bracket access returns `undefined`. That matters
because a `??` fallback fires on `undefined` and not on `""`. `at()` is the modern option and
supports negative indices.

---

← [Topic index](./README.md) · [Phase index](../README.md) · Next: [2 · Comparing and sorting human text](./02-comparing-and-sorting.md) →
