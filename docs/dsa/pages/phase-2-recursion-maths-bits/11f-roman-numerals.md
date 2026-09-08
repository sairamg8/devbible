---
title: "Roman numerals decode with one comparison — subtract when a smaller symbol precedes a larger one — and encode greedily from a table that already contains the six subtractive pairs, which is why the interesting question is the third one: is this string even a valid numeral?"
sidebar_label: "11f · Roman numerals"
sidebar_position: 11.5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. Roman numerals are **a notational convention, not a specification**: the
> symbol values, the subtractive pairs and the 1–3999 range are stated here as the convention that
> interview problems use, **derived and explained rather than cited**, exactly as the research bank
> for this phase prescribes for common practice. The greedy-optimality argument and the validity
> grammar are **derived on this page**. **No sandbox run**; every conversion shown is arithmetic
> performed in the text.

**Both directions are ten lines, and neither is the point.** Decoding is a single insight — a symbol
whose value is less than the symbol after it is *subtracted* — which collapses the six special cases
(`IV`, `IX`, `XL`, `XC`, `CD`, `CM`) into one comparison and needs no table of pairs at all.
Encoding is greedy from a value table that includes those pairs as first-class entries, and its
correctness is a property of this particular set of values rather than of greedy algorithms in
general. What actually separates answers is the third question, which interviewers add once the two
conversions are done: **given a string, is it a valid Roman numeral?** — because the decoder happily
accepts `IL`, `IC` and `VX`, none of which are numerals.

## The convention, stated because the problem depends on it

| Symbol | I | V | X | L | C | D | M |
|---|---|---|---|---|---|---|---|
| Value | 1 | 5 | 10 | 50 | 100 | 500 | 1000 |

Six subtractive pairs are permitted and no others: `IV` (4), `IX` (9), `XL` (40), `XC` (90),
`CD` (400), `CM` (900). The permitted range is 1 to 3999 — there is no zero, no negative, and no
symbol for 5000, so 4000 cannot be written with the basic seven. Every one of those is a
*convention*, and an interviewer who asks "what about 4000?" is asking whether you know the range is
a constraint of the notation rather than of your code.

## Decoding: one comparison, no pair table

```ts
const VALUE: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

function fromRoman(s: string): number {
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = VALUE[s[i]];
    const next = i + 1 < s.length ? VALUE[s[i + 1]] : 0;   // 0 past the end: never subtract
    total += v < next ? -v : v;
  }
  return total;
}
```

```java
static int fromRoman(String s) {
    Map<Character, Integer> value = Map.of('I', 1, 'V', 5, 'X', 10, 'L', 50,
                                           'C', 100, 'D', 500, 'M', 1000);
    int total = 0;
    for (int i = 0; i < s.length(); i++) {
        int v = value.get(s.charAt(i));
        int next = i + 1 < s.length() ? value.get(s.charAt(i + 1)) : 0;
        total += v < next ? -v : v;
    }
    return total;
}
```

**Why the comparison is sufficient.** In a valid numeral, symbols appear in non-increasing value
order *except* at a subtractive pair, where a smaller symbol precedes a larger one. A subtractive
pair `XY` contributes `value(Y) − value(X)`, which is exactly what "add `Y`, subtract `X`" produces
when the two are visited in order. So the rule needs no knowledge of *which* pairs are legal — it
only needs to know that a smaller-before-larger adjacency means subtraction. **That is also the
weakness**: the decoder is happy to apply it to `IL` and return 49, and to `IM` and return 999,
neither of which is a numeral. Decoding and validating are separate jobs, and conflating them is the
usual bug.

The `next = 0` sentinel past the end is the clean way to avoid a bounds check inside the condition —
nothing is ever less than 0, so the last symbol is always added.

## Encoding: greedy over a table that includes the pairs

```ts
const TABLE: ReadonlyArray<readonly [number, string]> = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) throw new RangeError("out of range 1..3999");
  let out = "";
  for (const [value, symbol] of TABLE) {
    while (n >= value) { out += symbol; n -= value; }
  }
  return out;
}
```

**The trick is entirely in the table.** By listing `CM`, `CD`, `XC`, `XL`, `IX` and `IV` as if they
were symbols with values 900, 400, 90, 40, 9 and 4, the greedy loop produces the subtractive forms
automatically and no special-casing is needed anywhere in the code. Descending order is a
precondition of the loop, not a stylistic choice.

**Why greedy is correct here**, which is the follow-up question. Greedy "take the largest value that
fits" is *not* generally optimal for arbitrary denomination sets — the standard counterexample is
coins `{1, 3, 4}` making 6, where greedy gives `4 + 1 + 1` and the optimum is `3 + 3`. It is optimal
for this set because of two structural facts: after subtracting the largest fitting value, the
remainder is always strictly less than that value, and the table's values are arranged so that no
value can be used more than three times before a larger one becomes applicable — `1000` being the
sole exception, which is exactly why the range stops at 3999. So the greedy output uses each entry
the minimum possible number of times, and it is the canonical form. **State it as a property of this
denomination set, not as a general principle**; claiming greedy is always right for coin change is a
mistake an interviewer will pounce on.

## The validity question, which is the real one

`fromRoman` accepts strings that are not numerals. A validator needs the *grammar*, and the grammar
is four rules:

1. `I`, `X`, `C`, `M` may repeat, at most three times consecutively.
2. `V`, `L`, `D` may never repeat.
3. Only `I`, `X`, `C` may be used subtractively.
4. A subtractive symbol may only precede the next two larger symbols: `I` before `V` or `X`; `X`
   before `L` or `C`; `C` before `D` or `M`. So `IL`, `IC`, `IM`, `XD`, `XM` are all invalid.

Encoded as a regular expression, working from the largest place value down:

```text
^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$
```

Each group handles one decimal place: thousands, hundreds, tens, units. Within a group the two
subtractive forms are tried first, then the additive form `D?C{0,3}` which covers 0–800 in hundreds.

⚠️ **That expression matches the empty string**, because every group is optional. A validator must
test for non-emptiness separately — and this is not a nitpick, it is the single most common bug in
the regex answer:

```ts
const ROMAN = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
const isRoman = (s: string): boolean => s.length > 0 && ROMAN.test(s);
```

**The alternative validator needs no grammar at all**, and it is the answer worth giving because it
reuses code you already have:

```ts
const isCanonical = (s: string): boolean =>
  s.length > 0 && toRoman(fromRoman(s)) === s;
```

Decode, re-encode, compare. Since `toRoman` produces the canonical form by construction, a string
survives the round trip if and only if it *is* the canonical form. It rejects `IIII`, `IL` and
`VIIII` for the right reason, needs no grammar, and is obviously correct — at the cost of one extra
conversion. ⚠️ It relies on `fromRoman` not throwing on garbage input, so guard the character set
first.

## Gotchas

**★ Symptom: the decoder returns a value for `IL` or `IM`.** Cause: the subtract-if-smaller rule
applied without validation — it is a decoding rule, not a grammar. Fix: validate separately, by
regex or by round trip. Do not try to build the validity check into the decoding loop; the two rules
have different shapes and the merged version is unreadable.

**★ Symptom: an index-out-of-bounds on the last character.** Cause: reading `s[i + 1]` without a
bound check. Fix: the `next = 0` sentinel, which also removes the branch. In Java, `charAt` on an
out-of-range index throws rather than returning `undefined`, so the failure is at least loud.

**★ Symptom: the encoder emits `IIII` for 4.** Cause: the subtractive pairs missing from the table.
Fix: add all six as entries with their values. There is no other change needed anywhere — this is
why the table-driven form is the one to write.

**★ Symptom: the encoder produces symbols in a strange order or loops forever.** Cause: the table not
in descending order of value. Fix: sort it descending, and treat the ordering as a documented
precondition of the loop rather than an accident of how you typed it.

**★ Symptom: `toRoman(0)` returns the empty string and `toRoman(4000)` returns `MMMM`.** Cause: no
range validation. Fix: validate `1 ≤ n ≤ 3999` and throw. There is no Roman numeral for zero, and
`MMMM` is outside the convention the problem assumes — an overline notation exists for larger
values and is not what is being asked for.

**★ Symptom: a regex validator accepts the empty string.** Cause: every group in the standard
expression is optional. Fix: check the length before testing. Every published version of this regex
has this hole and it is worth pointing out unprompted.

**★ Symptom: the validator accepts lowercase, or a string with whitespace.** Cause: the regex
anchored but not case-sensitive, or the input not trimmed at the boundary. Fix: decide the contract
— reject, or normalise with an explicit `toUpperCase()` and `trim()` before validating. Do not use a
case-insensitive flag and then feed the string to a decoder that only has uppercase keys.

**★ Symptom: `fromRoman` throws a `NullPointerException` in Java on an unexpected character.** Cause:
`Map.get` returning `null` and being auto-unboxed to `int`. Fix: validate the character set first,
or use `getOrDefault(c, 0)` and check. The auto-unboxing NPE is a Java-specific trap that has
nothing to do with Roman numerals and everything to do with `Map<Character, Integer>`.

## Interview questions

**★ Convert a Roman numeral to an integer.**
Walk left to right; add each symbol's value unless it is smaller than the value of the symbol
immediately after it, in which case subtract it. Use a sentinel of 0 past the end so the last symbol
is always added. That single comparison handles all six subtractive pairs without a table of pairs,
because a valid numeral is non-increasing except exactly at a subtraction. It is `Θ(n)` in the length
of the string with `Θ(1)` extra space. Note that it decodes invalid strings like `IL` without
complaint — validation is a separate concern.

**★ Convert an integer to a Roman numeral.**
Greedy over a descending table in which the six subtractive pairs appear as entries with values
900, 400, 90, 40, 9 and 4. For each entry, emit the symbol and subtract the value while it still
fits. Validate `1 ≤ n ≤ 3999` first, since the notation has no zero and no basic symbol for 5000.
The subtractive forms fall out of the table, so the loop has no special cases at all.

**★ Why is greedy correct here when it is not for arbitrary coin systems?**
Because of a property of *this* denomination set, not of greedy algorithms. For coins `{1, 3, 4}`
making 6, greedy gives three coins and the optimum is two, so greedy is not universally optimal. The
Roman set works because after taking the largest fitting value the remainder is strictly smaller
than it, and the values are spaced so that no entry is needed more than three times before a larger
one applies — with `M` the exception, which is precisely why the range stops at 3999. Saying "greedy
works for coin change" without that qualification is the trap.

**★ How do you tell whether a string is a valid Roman numeral?**
Two answers. The grammar: `I`, `X`, `C`, `M` repeat at most three times, `V`, `L`, `D` never repeat,
only `I`, `X`, `C` subtract, and each may only precede the next two larger symbols — encoded as
`^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$`, with an explicit non-empty check
because every group is optional and the expression matches `""`. Or the round trip: decode, re-encode
with the canonical greedy encoder, and compare — it accepts exactly the canonical strings, needs no
grammar and is obviously correct.

**★ Is `IIII` a valid Roman numeral?**
Under the convention these problems use, no — `IV` is the canonical form and the repetition rule caps
`I` at three. Historically `IIII` appears widely, including on clock faces, so the honest answer is
that validity is a matter of which convention you are asked to enforce, and that the round-trip
validator enforces the canonical one by construction. Naming the ambiguity and then picking a rule is
better than asserting either answer flatly.

**★ What about 4000 and above?**
Not representable with the seven basic symbols, which is why the conventional range is 1–3999. A
vinculum (overline) notation multiplies a symbol by a thousand, and there is no single agreed ASCII
encoding of it — so the correct engineering answer is to validate the range and throw, rather than
to emit `MMMM` and hope the caller agrees with your extension of the notation.

{/* FOOTER */}
