---
title: "Integer.parseInt throws, parseInt returns what it managed to read, and Number turns the empty string into zero — three parsers, three different answers for the same input, and the one that silently produces a plausible wrong number is the one shipped in every API boundary"
sidebar_label: "11h · What the platform parsers do"
sidebar_position: 11.7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the JDK 25 javadoc for
> [`Integer.parseInt(String)`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html)
> (the accepted format and the full `NumberFormatException` list), and MDN,
> [`parseInt()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseInt)
> (whitespace, signs, the stop-at-first-invalid rule, the radix parameter and its `NaN` conditions,
> the precision warning) and the **Number coercion** section of
> [`Number`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)
> (whitespace, the empty string, parse failure, signs, `Infinity`) — every rule below is quoted
> verbatim, and the `0x` / `0b` / `0o` values are the ones MDN documents as examples. ⚠️
> `Integer.valueOf`, `Integer.decode` and `Character.isDigit` were **not** fetched and nothing is
> asserted about their exact wording. **No sandbox run.** Version spine: **JDK 25 · MDN as fetched
> 2026-09-07**.

**[11g](11g-string-to-integer.md) wrote a parser; this page is about the three you already have, and
about the fact that they disagree.** They disagree on the empty string, on trailing garbage, on
whitespace, on prefixes and on what "out of range" means, and each disagreement is documented rather
than accidental. That matters far beyond the interview question, because the place these functions
actually live is an API boundary — a query string, a form field, a JSON body — where the input is
attacker-shaped and a parser that returns a plausible number for nonsense is worse than one that
throws.

## Java: `Integer.parseInt` is strict, and says so

> *"The characters in the string must all be decimal digits, except that the first character may be
> an ASCII minus sign `'-'` (`'\u002D'`) to indicate a negative value or an ASCII plus sign `'+'`
> (`'\u002B'`) to indicate a positive value."*

> *"An exception of type `NumberFormatException` is thrown if any of the following situations occurs:
> The first argument is `null` or is a string of length zero. Any character of the string is not a
> decimal digit, except that the first character may be a minus sign `'-'` (`'\u002D'`) or plus sign
> `'+'` (`'\u002B'`) provided that the string is longer than length 1. The value represented by the
> string is not a value of type `int`."*

Read the three exception clauses as a list of everything `atoi` tolerates and this does not:
**no leading whitespace**, **no trailing characters**, **no empty string**, **no clamping**. A lone
`"+"` is rejected by the "provided that the string is longer than length 1" clause, which is an
unusually precise piece of javadoc and exactly the case a hand-written parser forgets.

Two related methods, named with their caveats rather than quoted, because their javadoc was not
fetched here: **`Integer.valueOf(String)`** returns a boxed `Integer` where `parseInt` returns an
`int` — same parsing, different result type, and the boxed form participates in the small-value
cache, so `==` on two boxed results is a trap unrelated to parsing. **`Integer.decode(String)`**
accepts `0x`, `#` and leading-`0` octal prefixes that `parseInt` rejects. ⚠️ **Neither claim is
quoted here**; verify against the javadoc before depending on the details.

## JavaScript: `parseInt` is lenient and stops early

> *"The `parseInt` function converts its first argument to a string, parses that string, then
> returns an integer or `NaN`."*

> *"Leading whitespace in this argument is ignored."*

> *"`parseInt` understands exactly two signs: `+` for positive, and `-` for negative. It is done as
> an initial step in the parsing after whitespace is removed."*

> *"If `parseInt` encounters a character in the input string that is not a valid numeral in the
> specified `radix`, it ignores it and all succeeding characters and returns the integer value
> parsed up to that point."*

**That last sentence is `atoi`'s rule 4, in the standard library.** `parseInt` is essentially the
interview function without the clamp — and instead of clamping it warns about something else:

> *"Because `parseInt()` returns a number, it may suffer from loss of precision if the integer
> represented by the string is outside the safe range."*

So a long digit string does not overflow, it *degrades* — it returns a number that is close and not
equal, with no signal ([05](05-integer-limits-and-overflow.md)). That is the JavaScript analogue of
the clamp question, and it has no clamp.

### The radix parameter, and the one-line disaster it causes

> *"An integer between `2` and `36` that represents the radix (the base in mathematical numeral
> systems) of the `string`. It is converted to a 32-bit integer; if it's nonzero and outside the
> range of [2, 36] after conversion, the function will always return `NaN`. If `0` or not provided,
> the radix will be inferred based on `string`'s value. Be careful — this does not always default to
> `10`!"*

> *"If the input `string`, with leading whitespace and possible `+`/`-` signs removed, begins with
> `0x` or `0X` (a zero, followed by lowercase or uppercase X), `radix` is assumed to be `16` and the
> rest of the string is parsed as a hexadecimal number."*

Now the famous one: `["1", "2", "3"].map(parseInt)`. `Array.prototype.map` calls its callback with
`(element, index, array)`, so the index becomes `parseInt`'s **radix**. By the rules quoted above:
the first call has radix `0`, which is inferred — the string does not begin with `0x`, so it parses
as decimal; the second has radix `1`, which is nonzero and outside `[2, 36]`, so the documented
result is `NaN`; the third has radix `2`, in which `"3"` is not a valid numeral, so the first
character cannot be converted and the documented result is again `NaN`.

**The fix is `["1","2","3"].map(Number)` or `.map((s) => parseInt(s, 10))`**, and the general lesson
is to never pass a function reference straight to `map` unless you have checked its arity. And
always pass the radix explicitly — MDN's own italics on *"this does not always default to `10`"* are
the reason.

MDN also warns against a use that has nothing to do with parsing:

> *"`parseInt` should not be used as a substitute for `Math.trunc()`."*

Converting a number to a string and back to truncate it is slow, is wrong for values in exponential
notation, and is a habit picked up from [11](11-number-problems-that-recur.md)-shaped code.

## JavaScript: `Number()` is whole-string and turns nothing into zero

From MDN's **Number coercion** rules:

> *"Leading and trailing whitespace/line terminators are ignored."*

> *"Empty or whitespace-only strings are converted to `0`."*

> *"Parsing failure results in `NaN`."*

> *"`+` and `-` are allowed at the start of the string to indicate its sign. (In actual code, they
> "look like" part of the literal, but are actually separate unary operators.) However, the sign can
> only appear once, and must not be followed by whitespace."*

> *"`Infinity` and `-Infinity` are recognized as literals. In actual code, they are global
> variables."*

> *"A leading `0` digit does not cause the number to become an octal literal (or get rejected in
> strict mode)."*

And MDN documents the prefix results as examples: `Number("0x11")` is `17`, `Number("0b11")` is `3`,
`Number("0o11")` is `9`.

**`Number("")` being `0` is the single most consequential line on this page.** It is not a quirk to
be amused by; it is the reason `Number(req.query.limit)` returns `0` for a missing parameter, and
`0` is a number that will pass a `typeof` check, a `!isNaN` check and quite possibly a
`limit < 100` check on its way to producing an empty page. Unary `+` is the same coercion, so
`+""` is `0` too.

## The four, side by side

| Input | `Integer.parseInt` | `parseInt(s, 10)` | `Number(s)` | `atoi` ([11g](11g-string-to-integer.md)) |
|---|---|---|---|---|
| `"42"` | 42 | 42 | 42 | 42 |
| `"  42"` | throws | 42 | 42 | 42 |
| `"42abc"` | throws | 42 | `NaN` | 42 |
| `"abc"` | throws | `NaN` | `NaN` | 0 |
| `""` | throws | `NaN` | **0** | 0 |
| `"   "` | throws | `NaN` | **0** | 0 |
| `"+"` | throws | `NaN` | `NaN` | 0 |
| `"3.9"` | throws | 3 | 3.9 | 3 |
| `"0x11"` | throws | 0 (radix 10) | 17 | 0 |
| `"2147483648"` | throws | 2147483648 | 2147483648 | clamped |
| `"Infinity"` | throws | `NaN` | `Infinity` | 0 |

Every cell follows from a sentence quoted above. **The column to be afraid of is `Number`**, because
its failures are values rather than errors.

## The boundary rule, in the storefront

```ts
// ⛔ Three different silent failures in one line.
const page = Number(req.query.page);        // "" -> 0, "abc" -> NaN, "1e999" -> Infinity

// ✅ Parse, then validate, then default — explicitly and in that order.
function toPositiveInt(raw: unknown, fallback: number): number {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return fallback;             // reject before parsing
  const n = Number(trimmed);
  return Number.isSafeInteger(n) && n > 0 ? n : fallback;
}
```

Three principles, and they generalise past pagination:

1. **Validate the shape before parsing.** A regex that says what you accept is clearer than a parser
   whose acceptance set you inferred from documentation, and it is the only way to reject `"1e5"`,
   `"0x10"` and `" 12 "` deliberately rather than accidentally.
2. **Check the range after parsing**, with `Number.isSafeInteger` rather than `!isNaN`, because
   `NaN` is not the only bad value — `Infinity` and a precision-degraded large integer both pass an
   `isNaN` check.
3. **Default explicitly.** `Number(x) || 20` looks like a default and silently rewrites a legitimate
   `0` as well; `?? 20` does not catch `NaN`. Write the branch.

In Java the equivalent is to catch `NumberFormatException` at the boundary and map it to a 400
response rather than letting it become a 500 — the parser is already strict, so the work is turning
its strictness into the right HTTP status.

## Gotchas

**★ Symptom: `Number(req.query.page)` yields 0 for a missing parameter and the query returns the
wrong page.** Cause: *"Empty or whitespace-only strings are converted to `0`"*. Fix: validate before
parsing and default explicitly. This is the highest-frequency version of this whole page's lesson.

**★ Symptom: `["1","2","3"].map(parseInt)` produces `NaN`s.** Cause: `map` passes the index as the
second argument, which `parseInt` reads as the radix — radix 1 is *"nonzero and outside the range of
[2, 36]"* so it returns `NaN`, and in radix 2 the character `"3"` cannot be converted. Fix:
`.map(Number)` or `.map((s) => parseInt(s, 10))`.

**★ Symptom: a hex-looking string parses as 0.** Cause: `parseInt("0x11", 10)` stops at the `x`,
having read `0`. Fix: use `Number` if you want the prefix honoured — MDN documents `Number("0x11")`
as `17` — or strip and pass radix 16 explicitly. Note the opposite failure: `parseInt("0x11")` with
**no** radix infers 16, so the same call means different things depending on an argument you omitted.

**★ Symptom: `!isNaN(x)` used as the validity check and a huge number gets through.** Cause: `NaN` is
only one of the bad outcomes; `Infinity` and values above `Number.MAX_SAFE_INTEGER` are numbers. Fix:
`Number.isSafeInteger`, plus an explicit range check.

**★ Symptom: `Integer.parseInt(" 42 ")` throws in production on input that "looks fine".** Cause: the
javadoc's rule is that *"the characters in the string must all be decimal digits"* — whitespace is
not permitted at either end. Fix: `trim()` at the boundary, deliberately, so the tolerance is visible
in your code rather than assumed of the library.

**★ Symptom: `Integer.parseInt` on a user-supplied value throws and becomes a 500.** Cause: the
exception is the correct behaviour and the handler is missing. Fix: catch `NumberFormatException`
where the input enters and convert it into a validation error. The strict parser is doing you a
favour; losing that favour to an unhandled exception is the anti-pattern.

**★ Symptom: two parsed `Integer` values compare unequal with `==` despite printing the same.**
Cause: `Integer.valueOf` returns boxed objects and reference comparison is not value comparison.
Fix: `parseInt` for an `int`, or `.equals` / `.intValue()`. ⚠️ The caching behaviour that makes this
work for small values and fail for large ones is **not quoted here**; rely on `equals`, not on the
cache.

**★ Symptom: `parseInt` on a very long digit string returns a value that is close but wrong.** Cause:
MDN's documented precision warning — the result *"may suffer from loss of precision if the integer
represented by the string is outside the safe range"*. Fix: `BigInt(str)` for exactness
([05b](05b-bigint-and-when-to-reach-for-it.md)), and validate the digit count before you decide which
parser to use.

**★ Symptom: `parseInt(someNumber)` used to truncate a float.** Cause: reaching for a parser as a
maths function. Fix: `Math.trunc`. MDN says outright *"`parseInt` should not be used as a substitute
for `Math.trunc()`"*, and beyond the cost it is wrong for numbers whose string form uses exponential
notation.

## Interview questions

**★ What is the difference between `parseInt("42abc")` and `Number("42abc")`?**
`parseInt` returns 42 and `Number` returns `NaN`. MDN's rule for `parseInt` is that on hitting a
character that is not a valid numeral it *"ignores it and all succeeding characters and returns the
integer value parsed up to that point"*, whereas `Number` coerces the **whole** string and
*"parsing failure results in `NaN`"*. The practical consequence is that `parseInt` is a scanner and
`Number` is a validator, so at an API boundary — where a partially valid input should be rejected,
not silently truncated — `Number` plus an explicit shape check is the safer default.

**★ What does `Number("")` return, and why does it matter?**
`0`. MDN's coercion rules say *"Empty or whitespace-only strings are converted to `0`"*. It matters
because a missing query parameter arrives as an empty string, so `Number(req.query.limit)` produces
a perfectly ordinary-looking `0` that survives every `typeof` and `isNaN` check and then produces an
empty result set, a division by zero, or an off-by-one page. Validate the shape before parsing and
default explicitly.

**★ Why does `["1","2","3"].map(parseInt)` misbehave?**
Because `map` invokes its callback with three arguments — element, index, array — and `parseInt`
takes two, so the index is received as the radix. MDN documents that a radix that is *"nonzero and
outside the range of [2, 36]"* makes the function return `NaN`, which covers index 1; and at index 2
the radix is 2, in which `"3"` is not a valid numeral, so the first character cannot be converted
and the result is `NaN` again. The general rule is not to pass a variadic-tolerant function
reference to `map`, and to always pass `parseInt`'s radix explicitly.

**★ Which is stricter, `Integer.parseInt` or `atoi`, and where would you want each?**
`Integer.parseInt` is far stricter: the javadoc requires every character to be a decimal digit apart
from a leading sign, and it throws `NumberFormatException` for a null or empty string, for any other
character anywhere, and when *"the value represented by the string is not a value of type `int`"* —
so no whitespace, no trailing text, no clamping. That is what you want at a trust boundary, where an
unparseable input should be rejected. `atoi`'s leniency is what you want when consuming a stream of
mixed text where a number is expected to be followed by other content, which is why the C library
function exists in that shape at all.

**★ How would you parse a page number from a query string, in full?**
Reject anything that is not a string of digits with a regex before parsing, so that `"1e5"`,
`"0x10"`, `" 12 "` and `""` are all rejected deliberately. Then convert with `Number`, then check
`Number.isSafeInteger` and the domain range — positive, and below whatever ceiling the endpoint
allows. Then default explicitly with a branch, never with `||`, which would also rewrite a
legitimate `0`. In Java the parser already throws, so the work is catching `NumberFormatException`
at the boundary and returning a 400 rather than letting it become a 500.

---

← Prev: [11g · String to integer (atoi)](11g-string-to-integer.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [11i · Happy numbers and cycles](11i-happy-numbers-and-cycle-detection.md)
