---
title: "07.2 · Trimming, padding and replacing"
sidebar_label: "02 · Trimming, padding, replacing"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`replaceAll`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replaceAll), [`replace`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace), [`padStart`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart), [`trim`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/trim). Documentation-validated.

## The trim family

```js
"  hi  ".trim();       // "hi"
"  hi  ".trimStart();  // "hi  "
"  hi  ".trimEnd();    // "  hi"
```

All three remove **whitespace**, which includes spaces, tabs, newlines, carriage
returns and several Unicode space characters — not just the space bar. They do not take
an argument: there is no `trim(",")`. To strip a specific character you need a regex or
`replace`.

`trimStart`/`trimEnd` have the legacy aliases `trimLeft`/`trimRight`. Use the
Start/End names — they are the standard ones, and they read correctly for
right-to-left text.

**The everyday use is normalising input**, and it belongs at the boundary:

```js
const email = input.value.trim().toLowerCase();
```

A trailing space in a pasted email or coupon code is one of the most common
support tickets in existence, and one `trim` at the input boundary removes the whole
class.

## Padding

```js
"5".padStart(2, "0");        // "05"
"5".padEnd(3, ".");          // "5.."
"abc".padStart(2, "0");      // "abc"  — already long enough, unchanged
"5".padStart(4, "ab");       // "aba5" — the pad is TRUNCATED to fit
```

Three rules in those four lines:

- The first argument is the **target total length**, not the number of characters to
  add.
- If the string is already at least that long, it is returned **unchanged** — never
  truncated.
- A multi-character pad is repeated and then **cut off** to reach the exact length.

The pad string defaults to a space. The classic use is fixed-width formatting:

```js
String(mins).padStart(2, "0");                  // "07"
hex.padStart(6, "0");                           // colour codes
lines.forEach((l) => console.log(l.label.padEnd(20) + l.value));  // aligned output
```

For numbers destined for humans, `Intl.NumberFormat` is usually the better tool —
padding is for fixed-width formats, not for locale-aware presentation.

## `repeat`

```js
"-".repeat(20);        // a separator line
"ab".repeat(0);        // ""
"ab".repeat(-1);       // RangeError: Invalid count value
```

A negative count throws `RangeError`, and a non-integer is truncated toward zero. It
is the readable replacement for `new Array(n + 1).join(str)`, which you will still meet
in older code.

## `replace` versus `replaceAll`

**`replace` with a string pattern replaces only the first occurrence.** That is the
single most common string bug in JavaScript:

```js
"a-b-c".replace("-", "+");     // "a+b-c"   ← only the first
"a-b-c".replaceAll("-", "+");  // "a+b+c"
```

`replaceAll` was added for exactly this. MDN: it *"returns a new string with all matches
of a `pattern` replaced"*.

### The regex rule

MDN: when the pattern is a regular expression it *"must have the global (`g`) flag set,
or a `TypeError` is thrown"*:

```js
"aabbcc".replaceAll(/b/, ".");
// TypeError: replaceAll must be called with a global RegExp

"aabbcc".replaceAll(/b/g, ".");
// 'aa..cc'
```

That error is a **feature** — it stops you writing a "replace all" that silently
replaces one. `replace(/b/g, ".")` does the same job, so the two are equivalent with a
global regex; the difference only exists for **string** patterns.

### Why `replaceAll` with a string beats a dynamic regex

The old workaround was to build a global regex from the search string. MDN warns
against it:

> "While it is also possible to use `replace()` with a global regex dynamically
> constructed with `RegExp()` to replace all instances of a string, this can have
> unintended consequences if the string contains special characters that have meaning in
> regular expressions."

MDN's own example makes it concrete:

```js
function semiSafeRedactName(text, name) {
  return text.replaceAll(name, "[REDACTED]");
}

let report = "A hacker called ha.*er used special characters in their name to breach the system.";
console.log(semiSafeRedactName(report, "ha.*er"));
// "A hacker called [REDACTED] used special characters in their name to breach the system."
```

With `new RegExp(name, "g")`, `ha.*er` would be a **pattern** — `.` matches anything and
`.*` is greedy — and it would have redacted from "ha" all the way to the last "er" in
the sentence. `replaceAll` with a string treats it literally.

🔴 **Never build a regex from user input** without escaping it. Beyond wrong matches, a
user-supplied pattern is a denial-of-service vector through catastrophic backtracking.
`replaceAll`, `includes`, `startsWith` and `split` all take literal strings and avoid
the question entirely.

### The `$` patterns in the replacement

The replacement string is not literal — `$` is special:

| Pattern | Inserts |
|---|---|
| `$$` | a literal `$` |
| `$&` | the matched substring |
| `` $` `` | the portion before the match |
| `$'` | the portion after the match |
| `$1`, `$2`, … | the *n*th capture group |
| `$<name>` | a named capture group |

```js
"price: 100".replace(/(\d+)/, "$1.00");   // "price: 100.00"
```

**This bites when the replacement comes from data.** A replacement string containing
`$&` — a price, a template, anything user-supplied — is interpreted rather than
inserted:

```js
"cost".replace("cost", "$&$&");           // "costcost"  ← not literal
```

Use the **function form** when the replacement is dynamic, because its return value is
always literal:

```js
str.replace(pattern, () => userSuppliedText);        // safe
str.replaceAll(/(\d+)/g, (m) => String(Number(m) * 2));
```

MDN notes the function has *"the same semantics as `String.prototype.replace()`"* — it
receives the match, then any capture groups, then the offset and the whole string.

## Case and comparison

```js
"HÉLLO".toLowerCase();          // "héllo"
"i".toLocaleUpperCase("tr");    // "İ"  — Turkish dotted capital I
```

`toLowerCase`/`toUpperCase` use locale-independent rules; the `toLocale…` variants
respect language rules. The famous case is Turkish, where lowercase `i` uppercases to a
**dotted** `İ` — so a locale-insensitive `toUpperCase()` on a Turkish locale produces
the wrong letter, and case-insensitive comparison via `toLowerCase()` can fail.

For case-insensitive **comparison**, prefer
`a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0` over lowercasing both
sides.

## Gotchas

**Symptom:** `replace` only changed the first occurrence
**Cause:** With a **string** pattern, `replace` replaces once.
**Fix:** `replaceAll(str, …)`, or `replace(/…/g, …)`.

**Symptom:** `TypeError: replaceAll must be called with a global RegExp`
**Cause:** MDN: a regex pattern *"must have the global (`g`) flag set"*.
**Fix:** Add `/g`, or pass a plain string. The error exists to stop a silent
single replacement.

**Symptom:** A search string with `.` or `*` matched far more than intended
**Cause:** It was compiled into a regex, where those are metacharacters. MDN warns about
this and gives the `ha.*er` example.
**Fix:** `replaceAll` with a **string**, or escape the input before building a regex.

**Symptom:** `$&` or `$1` appeared to be interpreted in a replacement value
**Cause:** `$` patterns are special in a replacement **string**.
**Fix:** Use the **function** form — its return value is inserted literally — or escape
`$` as `$$`.

**Symptom:** `padStart(2, "0")` did not shorten a long string
**Cause:** Padding never truncates; if the string already meets the target length it is
returned unchanged.
**Fix:** `slice` first if you need a hard width.

**Symptom:** `"5".padStart(4, "ab")` gave `"aba5"`
**Cause:** A multi-character pad is repeated then **cut** to hit the exact length.
**Fix:** Expected — use a single-character pad for predictable output.

**Symptom:** `"ab".repeat(-1)` threw
**Cause:** `RangeError: Invalid count value` for a negative count.
**Fix:** Clamp with `Math.max(0, n)`.

**Symptom:** Case-insensitive matching fails for Turkish input
**Cause:** `toUpperCase()` is locale-independent; Turkish `i` uppercases to `İ`.
**Fix:** `localeCompare` with `sensitivity: "accent"`, or `toLocaleUpperCase(locale)`.

## Interview questions

**★ Difference between `replace` and `replaceAll`?**
With a **string** pattern, `replace` replaces only the **first** occurrence while
`replaceAll` replaces all. With a **regex** they are equivalent given the `g` flag — and
MDN documents that `replaceAll` **throws `TypeError`** for a non-global regex, which
exists to stop a silent single replacement.

**★ Why is `replaceAll(userInput, …)` safer than `replace(new RegExp(userInput, "g"), …)`?**
Because a string pattern is matched **literally**. MDN warns that a dynamically built
regex *"can have unintended consequences if the string contains special characters"* —
its example redacts far too much when the name is `ha.*er`. User-supplied patterns are
also a backtracking DoS vector.

**★ What is special about the replacement string?**
`$` sequences are interpreted: `$&` is the match, `` $` `` and `$'` the surrounding
text, `$1`/`$<name>` the capture groups, `$$` a literal `$`. So a **data-derived**
replacement can be silently reinterpreted — use the **function** form, whose return
value is always literal.

**★ What does `padStart`'s first argument mean?**
The **target total length**, not the number of characters to add. If the string is
already that long it is returned unchanged (padding never truncates), and a
multi-character pad is repeated then cut to fit exactly.

**Does `trim` take an argument?**
No — it removes whitespace only, and there is no `trim(char)`. Use a regex or `replace`
to strip a specific character. `trimStart`/`trimEnd` are the one-sided versions.

**Why can lowercasing both strings be a bad case-insensitive comparison?**
Because case mapping is locale-dependent — Turkish `i` uppercases to a dotted `İ`, so
round-tripping through case changes the letter. Use
`localeCompare(b, undefined, { sensitivity: "accent" })` instead.

---

← [Slicing and splitting](./01-slicing-and-splitting.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
