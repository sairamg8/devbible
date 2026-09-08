---
title: "Testing a number for palindromicity without a string is the half-reversal, which cannot overflow because it stops at the midpoint — and its one non-obvious guard exists because 10 would otherwise be reported as a palindrome"
sidebar_label: "11c · Palindromic numbers"
sidebar_position: 11.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The half-reversal and its loop invariant are **elementary arithmetic derived
> on this page rather than cited**; the research bank for this phase records that these problems have
> no primary source. Every trace below (`1221`, `12321`, `10`) is **arithmetic performed step by step
> in the text, not program output**. The language-level facts it rests on — truncating division,
> the sign of `%` — are quoted in [11](11-number-problems-that-recur.md). **No sandbox run.**

**"Is this number a palindrome, without converting it to a string?" is really two questions: can you
avoid the overflow that a full reversal risks, and can you name the three inputs that break the
obvious version.** The overflow is avoided by reversing only half the digits and comparing the
halves, which never builds a number larger than the input. The three inputs are negatives, zero, and
any number ending in zero — and the last of those is the interesting one, because without its guard
the algorithm reports `10` as a palindrome, which is a wrong answer rather than a crash.

## Rejecting the easy cases first

```ts
if (n < 0) return false;
if (n !== 0 && n % 10 === 0) return false;
```

**Negatives.** By the usual convention `-121` is not a palindrome, because reading it backwards
gives `121-`. This is a *convention*, not a fact, and the right move in an interview is to state it
and ask — some formulations define palindromicity on the magnitude. Stating the assumption is worth
more than either answer.

**Trailing zeros.** A number ending in `0` reversed would have to begin with `0`, and numbers do not
have leading zeros. So the only such palindrome is `0` itself. This guard looks like a
micro-optimisation and is not: without it the algorithm below **returns true for 10**, and the trace
is in the next section.

## The half-reversal

Build the reverse of the *back* half while shrinking the front half, and stop when they meet:

```ts
function isPalindrome(n: number): boolean {
  if (n < 0) return false;
  if (n !== 0 && n % 10 === 0) return false;

  let rev = 0;
  while (n > rev) {
    rev = rev * 10 + (n % 10);
    n = Math.trunc(n / 10);
  }
  return n === rev || n === Math.trunc(rev / 10);
}
```

```java
static boolean isPalindrome(int n) {
    if (n < 0) return false;
    if (n != 0 && n % 10 == 0) return false;

    int rev = 0;
    while (n > rev) {
        rev = rev * 10 + n % 10;
        n /= 10;
    }
    return n == rev || n == rev / 10;
}
```

**Two return conditions, because the digit count can be even or odd.**

- *Even length,* `1221`: start `n = 1221, rev = 0`. `1221 > 0`, so `rev = 1`, `n = 122`. `122 > 1`,
  so `rev = 12`, `n = 12`. Now `12 > 12` is false and the loop stops with the two halves equal —
  `n === rev`.
- *Odd length,* `12321`: `rev = 1, n = 1232`; `rev = 12, n = 123`; `rev = 123, n = 12`. Now
  `12 > 123` is false. The halves are `12` and `123`, and the extra digit in `rev` is the **middle**
  digit, which belongs to neither half and is its own mirror. Dropping it with `rev / 10` gives `12`,
  which equals `n`.
- *Single digit,* `5`: `rev = 5, n = 0`; the loop stops; `0 === 5` is false but
  `0 === trunc(5 / 10)` is true. The odd-length branch is what makes single digits work, which is
  worth noticing before you decide the branch is redundant.

## Why the trailing-zero guard is load-bearing

Trace `10` **without** the guard. `n = 10, rev = 0`.

- `10 > 0`: `rev = 0 · 10 + 0 = 0`, `n = 1`.
- `1 > 0`: `rev = 0 · 10 + 1 = 1`, `n = 0`.
- `0 > 1` is false — stop.

Now `n === rev` is `0 === 1`, false. But `n === trunc(rev / 10)` is `0 === 0`, **true**, so the
function returns `true` for `10`. The leading zero that the reversal produced was silently absorbed,
exactly as `21` absorbs the zeros of `1200` in [11b](11b-reversing-an-integer.md) — the same
information loss, presenting here as a wrong boolean rather than a shortened number.

**This is why the guard is a correctness condition and not an optimisation**, and it is the detail
an interviewer is watching for.

## Why it cannot overflow

The loop's condition is `n > rev`, so `rev` never exceeds `n`, and `n` only ever shrinks from the
original input. Therefore `rev` stays bounded by the input, which is by assumption a valid value of
its type. **There is no overflow check to write** — the invariant is the check.

Contrast the naive approach: reverse the whole number and compare to the original. For a 32-bit
input, a valid palindrome's reversal is the input itself and cannot overflow, so the naive version
happens to be safe here — but only *because* the answer is true. For a non-palindrome the reversal
can exceed the range, so a version that reverses first and compares afterwards has to handle the
overflow case anyway, and getting `reverse` right ([11b](11b-reversing-an-integer.md)) is strictly
more work than getting the half-reversal right. **The half-reversal is not an optimisation of the
naive version; it is the version with fewer boundaries.**

## Cost, and the string comparison people are actually asking about

The half-reversal is `Θ(d)` time in the number of digits — `Θ(log n)` — and `Θ(1)` space. Converting
to a string and running two pointers inwards is also `Θ(d)` time but `Θ(d)` space for the string,
and it is perfectly reasonable code. **The "without converting to a string" constraint is not about
performance**; it is there to force the digit arithmetic, which is the skill being tested. Say that,
then write the arithmetic version. If asked which you would ship, the string version is more
obviously correct to a reader and the difference is a constant factor — that is a defensible answer
and a better one than pretending the arithmetic version is faster in a way you have measured.

## Variants worth recognising, not solving here

- **Palindrome in base `b`.** The same loop with `b` in place of `10`; the trailing-zero guard
  becomes `n % b === 0`. [11j](11j-base-conversion-and-digit-sums.md) has the base machinery. A
  classic follow-up asks for numbers palindromic in two bases at once, which is a search problem
  wrapped around this test.
- **Nearest palindrome, next palindrome, count palindromes below n.** Constructive problems, not
  test problems: you build candidates from the first half rather than testing every number. Named
  here as pointers; each is its own exercise.
- **Palindromic *substrings* of a string.** A different problem entirely — expand-around-centre or
  Manacher's algorithm — and it shares nothing with this page but the word.

## Gotchas

**★ Symptom: `isPalindrome(10)` returns true.** Cause: the trailing-zero guard missing. The reversal
of `10` is `01`, the leading zero disappears, the odd-length branch compares `0` with `0` and
succeeds. Fix: `if (n !== 0 && n % 10 === 0) return false;` — and note it must exclude `n === 0`
itself, which *is* a palindrome.

**★ Symptom: `isPalindrome(0)` returns false.** Cause: a trailing-zero guard written as
`n % 10 === 0` without the `n !== 0` exclusion. Fix: exclude zero explicitly. Zero is a palindrome
under every convention.

**★ Symptom: single-digit numbers report false.** Cause: only the even-length comparison
`n === rev` kept, on the reasoning that the odd branch is for "long" numbers. Fix: keep
`n === trunc(rev / 10)`. For a single digit the loop leaves `n = 0` and `rev = d`, and it is the odd
branch that resolves it.

**★ Symptom: the loop condition written as `n >= rev`.** Cause: guessing at the boundary. Fix: with
`>=`, an even-length palindrome performs one extra iteration past the meeting point and the halves
no longer line up. Trace `1221` by hand — the loop must stop *at* equality, not after it.

**★ Symptom: an overflow check added to the half-reversal "to be safe".** Cause: pattern-matching
from [11b](11b-reversing-an-integer.md). Fix: it is unreachable. `rev ≤ n ≤ input` is maintained by
the loop condition itself, so there is nothing to check — and being able to say *why* is a better
demonstration than adding the check.

**★ Symptom: negatives reported as palindromes.** Cause: an implementation that takes the absolute
value first. Fix: decide the convention explicitly. `-121` is conventionally not a palindrome; if
the problem intends the magnitude, that is a different specification and should be written down
rather than inferred.

**★ Symptom: a Java version that reads the input as a `long` and overflows on `rev * 10`.** Cause:
the invariant `rev ≤ n` only holds because the loop condition enforces it; a version that hoists the
multiplication outside the condition, or that reverses fully first, loses it. Fix: keep the
comparison in the loop condition, where it is doing the safety work.

**★ Symptom: the string version and the arithmetic version disagree on a value.** Cause: almost
always the trailing-zero or the negative case, where the string version is accidentally right — the
string `"10"` reversed is `"01"`, which does not equal `"10"`, so the string version rejects it
without needing a guard. Fix: this asymmetry is exactly why the arithmetic version needs an explicit
guard; the string carries the leading zero that the number cannot.

## Interview questions

**★ Determine whether an integer is a palindrome without converting it to a string.**
Reject negatives by convention and reject anything ending in zero except zero itself. Then reverse
only the back half: while `n > rev`, do `rev = rev * 10 + n % 10` and `n /= 10`. The loop stops when
the halves meet, and the answer is `n == rev` for an even digit count or `n == rev / 10` for an odd
one, the extra digit in `rev` being the middle digit that is its own mirror. It is `Θ(log n)` time
and `Θ(1)` space, and it cannot overflow because the loop condition guarantees `rev ≤ n`.

**★ Why the trailing-zero guard?**
Because reversing a number that ends in zero produces a leading zero, which does not exist in the
number, so the comparison is made against a value that has lost a digit. Concretely, without the
guard, `10` reduces to `n = 0` and `rev = 1`, and the odd-length branch compares `0` with
`trunc(1 / 10) = 0` and succeeds — a wrong answer, not an error. The guard must exclude `0` itself,
which is a palindrome.

**★ Why can the half-reversal not overflow, when a full reversal can?**
Because the loop only continues while `n > rev`, so `rev` never grows past `n`, and `n` only shrinks
from the original input. The invariant *is* the bound. A full reversal has no such constraint: the
reverse of a non-palindromic 32-bit integer can exceed the 32-bit range, which is why
[11b](11b-reversing-an-integer.md) needs an explicit pre-multiplication check and this page needs
none.

**★ How do you know when to stop, and how do you handle an odd number of digits?**
Stop when `n <= rev` — the front half has shrunk to at most the reversed back half, which is exactly
the midpoint. For an even digit count the two are equal. For an odd count `rev` has absorbed the
middle digit, so it holds one digit more than `n`; dropping it with an integer division by ten
aligns them. Single-digit inputs are the degenerate odd case and are handled by the same branch,
which is a good reason not to "simplify" it away.

**★ Would you ship this or the string version?**
The string version, in most codebases: two pointers over `String.valueOf(n)` is more obviously
correct to a reader, the space is `Θ(log n)` characters which is nothing, and the difference is a
constant factor I would not claim to have measured. The arithmetic version is what the question is
testing and what I would write if the constraint were stated, or if this were on a hot path where
allocation mattered. Naming the trade rather than asserting one is faster is the answer.

{/* FOOTER */}
