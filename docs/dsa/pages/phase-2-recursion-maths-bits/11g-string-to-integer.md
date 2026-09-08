---
title: "atoi is not a parsing problem, it is a clamping problem — four lines read whitespace, sign and digits, and the whole exercise is detecting that the accumulator is about to leave the 32-bit range and saturating instead of wrapping, on a range whose two ends are not symmetric"
sidebar_label: "11g · String to integer (atoi)"
sidebar_position: 11.6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the JDK 25 javadocs for
> [`java.lang.Integer`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html)
> (`MAX_VALUE` = *"2^31-1"*, `MIN_VALUE` = *"-2^31"*) and
> [`java.lang.Math`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Math.html)
> (`abs(int)` at `MIN_VALUE`), quoted verbatim. The `atoi` specification itself is **the conventional
> interview/C-library contract, stated as such and not cited** — there is no single primary source
> for the interview variant, and the differences from the platform parsers are
> [11h](11h-what-the-platform-parsers-do.md)'s subject, where those parsers *are* quoted. ⚠️ Whether
> `Character.isDigit` accepts non-ASCII digits is **flagged as unconfirmed below**. **No sandbox
> run.** Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**Everybody writes the first three steps correctly and most people get the fourth wrong, which is
why this problem is asked.** Skip whitespace, take an optional sign, read digits until something
that is not a digit, ignore the rest — that is a loop with three `if`s. Then: the result must be
**clamped** to the 32-bit signed range rather than wrapped, and the two ends of that range are not
mirror images, so the check has a different last digit on each side. Every other subtlety in this
problem is a specification question you should ask rather than guess.

## The contract, stated so you know what to ask

1. Skip leading whitespace.
2. Optionally consume a single `+` or `-`.
3. Consume digits until the first non-digit or the end of the string.
4. Ignore everything after that — trailing characters are not an error.
5. If no digits were consumed, the result is 0.
6. If the value exceeds the 32-bit signed range, clamp to `2147483647` or `-2147483648`.

**Three of those are worth confirming out loud before you write anything.** Which characters count as
whitespace — spaces only, or tabs and newlines too? Is trailing garbage really ignored, or is it an
error? And is the answer clamped or is it an error? Those three choices are exactly what distinguish
this function from `Integer.parseInt`, from `parseInt` and from `Number`, all of which answer them
differently ([11h](11h-what-the-platform-parsers-do.md)). An interviewer asking `atoi` is usually
also asking whether you know a parser has a contract.

## The implementation, with the clamp

```ts
function myAtoi(s: string): number {
  const INT_MAX = 2 ** 31 - 1;      // 2147483647
  const INT_MIN = -(2 ** 31);       // -2147483648
  let i = 0;

  while (i < s.length && s[i] === " ") i++;              // 1. whitespace

  let sign = 1;                                          // 2. sign
  if (i < s.length && (s[i] === "+" || s[i] === "-")) {
    sign = s[i] === "-" ? -1 : 1;
    i++;
  }

  let acc = 0;                                           // 3. digits
  while (i < s.length && s[i] >= "0" && s[i] <= "9") {
    const d = s.charCodeAt(i) - 48;
    if (acc > Math.trunc(INT_MAX / 10)) return sign === 1 ? INT_MAX : INT_MIN;
    if (acc === Math.trunc(INT_MAX / 10) && d > (sign === 1 ? 7 : 8)) {
      return sign === 1 ? INT_MAX : INT_MIN;
    }
    acc = acc * 10 + d;
    i++;
  }
  return sign * acc;                                     // 4/5. rest ignored, 0 if no digits
}
```

**The `7` and the `8` are the whole problem.** `INT_MAX` is `2147483647` and `INT_MAX / 10` is
`214748364`; once the accumulator reaches that value, one more digit fits only if it is at most `7`.
On the negative side the magnitude limit is `2147483648`, so the last permitted digit is `8`. **The
range is asymmetric** — `MIN_VALUE` is *"-2^31"* while `MAX_VALUE` is *"2^31-1"* — and a solution
that clamps both sides at `7` returns `-2147483647` for the string `"-2147483648"`, which is a
legitimate input mapping to a legitimate value. That is the test case to write.

Note the check is performed **before** `acc = acc * 10 + d`, for the same reason as in
[11b](11b-reversing-an-integer.md): in Java the multiply would already have wrapped, and in
TypeScript the habit is what keeps you correct when the range widens.

## The Java version, and the negative-accumulator idiom

```java
static int myAtoi(String s) {
    int i = 0, n = s.length();
    while (i < n && s.charAt(i) == ' ') i++;

    boolean negative = false;
    if (i < n && (s.charAt(i) == '+' || s.charAt(i) == '-')) {
        negative = s.charAt(i) == '-';
        i++;
    }

    int acc = 0;                      // accumulated as a NEGATIVE magnitude
    int limit = negative ? Integer.MIN_VALUE : -Integer.MAX_VALUE;
    int limitDiv10 = limit / 10;      // -214748364 either way

    while (i < n) {
        char c = s.charAt(i);
        if (c < '0' || c > '9') break;
        int d = c - '0';
        if (acc < limitDiv10) return negative ? Integer.MIN_VALUE : Integer.MAX_VALUE;
        acc *= 10;
        if (acc < limit + d) return negative ? Integer.MIN_VALUE : Integer.MAX_VALUE;
        acc -= d;
        i++;
    }
    return negative ? acc : -acc;
}
```

**Accumulating negatively is the idiom worth stealing**, and it is the same trick as
[11](11-number-problems-that-recur.md)'s digit loop. The magnitude of `MIN_VALUE` is not
representable as a positive `int` — `Math.abs` of it is documented to return *"that same value,
which is negative"* — so a parser that builds a positive magnitude and negates at the end simply
cannot represent `"-2147483648"` correctly without widening. Building the value in the negative half
sidesteps it entirely, because every value in the range has a valid negative form. The final
`return negative ? acc : -acc` is safe because a non-negative result is at most `MAX_VALUE` in
magnitude by construction.

`limit + d` rather than `limit - d`: `limit` is negative and `acc` is negative, so the comparison
`acc < limit + d` asks whether subtracting `d` would take `acc` past the limit — arranged so that no
intermediate leaves the range. That is the same "never form the large intermediate" discipline as
[05d](05d-the-three-silent-overflows.md)'s midpoint rewrite.

## The inputs that decide the answer

| Input | Result | Why |
|---|---|---|
| `"42"` | 42 | the ordinary case |
| `"   -42"` | −42 | whitespace then sign |
| `"4193 with words"` | 4193 | digits stop at the space; the rest is ignored |
| `"words and 987"` | 0 | the first non-whitespace character is not a sign or digit |
| `""` | 0 | no digits consumed |
| `"   "` | 0 | whitespace only |
| `"+"` / `"-"` | 0 | a sign with no digits is not a number |
| `"+-12"` | 0 | only one sign is permitted; the second `-` ends the digit scan before it starts |
| `"00000000000012"` | 12 | leading zeros are digits like any other |
| `"-91283472332"` | −2147483648 | clamped, not wrapped |
| `"2147483648"` | 2147483647 | clamped at the positive end |
| `"-2147483648"` | −2147483648 | **exact**, and the case a symmetric clamp gets wrong |
| `"3.14"` | 3 | `.` is not a digit, so the scan stops |
| `"1e5"` | 1 | `e` is not a digit either |

**`"+-12"` and `"-2147483648"` are the two that fail most implementations**, for different reasons:
the first because the sign step was written as a loop or as two separate `if`s, the second because
of the asymmetry.

## Gotchas

**★ Symptom: `"-2147483648"` parses as `-2147483647`.** Cause: the last-digit clamp written as `> 7`
on both sides. Fix: the negative side permits `8`, because `MIN_VALUE` is `-2^31` while `MAX_VALUE`
is `2^31 − 1`. Or accumulate negatively and never face the asymmetry.

**★ Symptom: a large input wraps to a small negative number instead of clamping.** Cause: the range
check placed after the multiply-and-add, where in Java the wrap has already happened. Fix: check
before. In TypeScript the arithmetic does not wrap, so a post-check works — but the value can still
exceed `Number.MAX_SAFE_INTEGER` for a very long digit string, at which point the comparison itself
is on an inexact value ([05](05-integer-limits-and-overflow.md)).

**★ Symptom: `"+-12"` returns −12 or 12.** Cause: the sign step written as a `while` loop, or as two
`if`s that both fire. Fix: consume **at most one** sign character, with a single `if`.

**★ Symptom: `"  +  12"` returns 12.** Cause: whitespace skipping repeated after the sign. Fix: the
contract says whitespace is skipped once, before the sign. A space after the sign terminates the
number and the result is 0.

**★ Symptom: the Java version throws `StringIndexOutOfBoundsException`.** Cause: `charAt(i)` called
without re-checking `i < n` after the whitespace or sign step consumed the last character. Fix:
guard every read. This is why the loops above test `i < n` before every `charAt`, even where it
looks redundant.

**★ Symptom: a parser that builds a positive magnitude and negates at the end cannot represent the
minimum value.** Cause: `|MIN_VALUE|` is not a representable `int`. Fix: accumulate in the negative
domain, or accumulate in a `long` and clamp at the end — both are correct, and the negative
accumulator is what a hand-written parser should look like when no wider type is available.

**★ Symptom: `Character.isDigit(c)` used for the digit test and non-ASCII digits are accepted.**
Cause: Java's notion of "digit" is broader than `'0'..'9'`. ⚠️ **The javadoc text for
`Character.isDigit` was not fetched for this page, so this is flagged rather than asserted** — but
the safe implementation is unambiguous either way: test `c >= '0' && c <= '9'` explicitly, which is
what the code above does and what makes the behaviour independent of the question.

**★ Symptom: the digit value computed as `c - 48` in one place and `c - '0'` in another.** Cause:
two idioms for the same thing. Fix: they are identical — `'0'` is code point 48 — but pick one.
Mixing them is how a `'0'` becomes a `'O'` in a later edit and nobody notices.

**★ Symptom: `"3.14"` returns 314 or throws.** Cause: skipping non-digits inside the scan loop
instead of stopping at the first one. Fix: `break`, do not `continue`. "Stop at the first non-digit"
is the contract, and skipping is a different and much more permissive parser.

**★ Symptom: the TypeScript version returns a non-integer.** Cause: dividing without `Math.trunc`
when computing `INT_MAX / 10`. Fix: truncate, or hard-code `214748364`. Anywhere `/` appears in this
family of problems, [11](11-number-problems-that-recur.md)'s rule applies.

## Interview questions

**★ Implement `atoi`. What do you clarify first?**
Three things, because they are the differences between every parser in every standard library: which
characters count as whitespace; whether trailing non-digits are ignored or are an error; and whether
an out-of-range value clamps or throws. The conventional interview contract is spaces only, trailing
garbage ignored, and clamping — but that combination is unique to this problem, so asking is not
pedantry, it is the observation that a parser has a contract. Then the implementation: skip
whitespace, consume at most one sign, accumulate digits with the range check performed *before*
each multiply, and return 0 if no digit was consumed.

**★ Why is the overflow check different on the two sides?**
Because the two's-complement range is asymmetric: `MAX_VALUE` is `2^31 − 1` = `2147483647` and
`MIN_VALUE` is `−2^31` = `−2147483648`. Both divide by ten to `214748364`, but the last permitted
digit is `7` on the positive side and `8` on the negative one. A single symmetric check returns
`−2147483647` for the input `"-2147483648"`, which is a valid string for a valid value — the exact
test case that catches it.

**★ How do you avoid the asymmetry altogether?**
Accumulate the magnitude as a **negative** number and compare against `MIN_VALUE` or
`−MAX_VALUE` depending on the sign, negating only at the very end. Every value in the range has a
representable negative form, whereas `|MIN_VALUE|` has no representable positive form —
`Math.abs(Integer.MIN_VALUE)` is documented to return the same negative value. Accumulating in a
`long` and clamping at the end is the other correct answer, and the one to give if a wider type is
available.

**★ What does your function return for `"words and 987"`, `"+-12"` and `"  +  12"`?**
Zero, in all three cases. The first because the scan stops immediately at a character that is
neither whitespace, sign nor digit, and no digits are consumed. The second because only one sign is
permitted, so the second `-` is the first non-digit and terminates a digit run of length zero. The
third because whitespace is skipped once, before the sign — a space *after* the sign is not skipped
and ends the number. All three are consequences of the contract being sequential and non-backtracking,
which is worth saying because it explains all of them at once.

**★ Why check the range before the multiply rather than after?**
Because in a fixed-width type the multiply is where the information is destroyed: `int` arithmetic
wraps silently, so afterwards there is nothing left to detect. The pre-check compares the
accumulator against `limit / 10` and, on equality, the incoming digit against the limit's last
digit — reasoning entirely with values that are known to be in range. It is the same discipline as
never forming `lo + hi` in a binary search
([05d](05d-the-three-silent-overflows.md)): rewrite so the large intermediate never exists.

---

← Prev: [11f · Roman numerals](11f-roman-numerals.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [11h · What the platform parsers do](11h-what-the-platform-parsers-do.md)
