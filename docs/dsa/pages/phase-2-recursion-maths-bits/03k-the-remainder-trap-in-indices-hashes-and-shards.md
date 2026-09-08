---
title: "% is a remainder and not a modulus in both TypeScript and Java, so it returns a negative number whenever its left operand is negative — which turns a correct modular algorithm into a negative answer, a negative shard index and an out-of-bounds circular buffer read, and Java documents the divergence in the javadoc of the method that exists to fix it"
sidebar_label: "03k · The remainder trap"
sidebar_position: 3.10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the **JDK 25** API documentation for
> [`java.lang.Math`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Math.html)
> — `floorMod` and `floorDiv` quoted verbatim below, **including the value pairs the javadoc itself
> documents**, and
> [`java.lang.Integer`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html)
> for `MIN_VALUE`. ⚠️ The claim that `Math.abs(Integer.MIN_VALUE)` is negative is written as the
> arithmetic consequence of the documented constants, not as a quotation — see
> [03b](03b-gcd-on-signed-and-wide-types.md). **No sandbox run**; every value below is quoted from
> the javadoc or is arithmetic performed in the text.

**This is the single highest-yield fact in the whole of phase 2, because it is the one that turns
provably correct code into a wrong answer with no exception, no warning and no failing small test.**
`%` in TypeScript and in Java is a *remainder*: its result takes the sign of the **dividend**. The
mathematical modulus, for a positive modulus, is always in `[0, m)`. So the moment a value can go
negative before the `%` — a subtraction under a modulus, a signed `hashCode`, an index stepping
backwards past zero — the result is negative and every consumer that assumed `[0, m)` is wrong.
Java ships the correct operation as `Math.floorMod` and documents precisely where it and `%`
diverge; TypeScript ships nothing and the idiom is `((x % m) + m) % m`. The
[ring properties](03j-modular-arithmetic-and-the-remainder-trap.md) are what make the algorithm
correct; this page is what makes the program correct.

## `%` is a remainder, and Java says so in the javadoc

Both languages define `%` so that the result takes the sign of the **dividend**. The mathematical
modulus takes the sign of the *divisor* — or, for a positive modulus, is always non-negative. Java
ships both and documents exactly where they diverge:

> *"If neither `floorMod(x, y)` nor `x % y` is zero, they differ exactly when the signs of the
> arguments differ."* — JDK 25, `Math.floorMod(int, int)`; documented values:
> `floorMod(+4, -3) == -2` while `(+4 % -3) == +1`, and `floorMod(-4, +3) == +2` while
> `(-4 % +3) == -1`.

> *"If the signs of the arguments are different, `floorDiv` returns the largest integer less than
> or equal to the quotient while the `/` operator returns the smallest integer greater than or
> equal to the quotient. They differ if and only if the quotient is not an integer."* — JDK 25,
> `Math.floorDiv(int, int)`; documented: `floorDiv(-4, 3) == -2`, whereas `(-4 / 3) == -1`.

The pair `(-4 % +3) == -1` is the entire bug, written by the platform itself. Anywhere a value can
go negative before the `%` — a subtraction, a hash, a leftward index step — the result is negative,
and every consumer that expected `[0, m)` is wrong.

**Java's fix** is `Math.floorMod`. **TypeScript has no such function**, and the idiom is:

```ts
export function mod(x: number, m: number): number {
  return ((x % m) + m) % m;      // ✅ requires m > 0
}
```

Why the double `%`: `x % m` lands in `(−m, m)`; adding `m` moves it to `(0, 2m)`; the second `%`
brings it back into `[0, m)`. The first `%` is what keeps the intermediate small — writing
`(x + m) % m` alone is wrong for any `x` more negative than `−m`. The idiom needs `m > 0`; for a
negative modulus it produces a negative result, which is arguably the mathematically correct answer
and is almost never what the caller meant.

```java
// Java — both forms, and they agree for m > 0
int a = Math.floorMod(x, m);            // ✅ the documented one
int b = ((x % m) + m) % m;              // ✅ the portable one; works unchanged on long
```

⚠️ The javadoc quoted above is for the `int` overload. The `((x % m) + m) % m` idiom is
type-agnostic and works unchanged on `long`, which is why it is worth knowing even in Java.

## Where the negative actually appears

**After a subtraction under a modulus.** The canonical one, and it is in every counting problem:

```ts
// ⛔ result can be negative when b > a
const wrong = (a - b) % MOD;
// ✅
const right = ((a - b) % MOD + MOD) % MOD;
```

**A hash bucket or shard index.** A Java `hashCode()` returns an `int` and there is nothing stopping
it being negative, so `hash % buckets` can be negative and the array access throws. In a storefront
that is `orderId.hashCode() % SHARD_COUNT` picking a shard, and it fails only for the identifiers
that happen to hash negative — which is roughly half of them, but they are unevenly distributed
across test data.

```java
int shard = Math.floorMod(orderId.hashCode(), SHARD_COUNT);   // ✅
// int shard = orderId.hashCode() % SHARD_COUNT;              // ⛔ can be negative
// int shard = Math.abs(orderId.hashCode()) % SHARD_COUNT;    // ⛔ still negative for MIN_VALUE
```

🔴 The `Math.abs` line is the trap inside the trap: it is *almost* right, and it fails for exactly
one hash value, `Integer.MIN_VALUE`, whose absolute value is not a representable `int` — see
[03b](03b-gcd-on-signed-and-wide-types.md). A shard router with that bug throws once in about four
billion requests and is impossible to reproduce.

**A circular index stepping backwards.** `(i - 1) % n` is `-1` when `i` is `0`, which in TypeScript
reads `undefined` from an array and in Java throws:

```ts
const prev = (i - 1 + n) % n;      // ✅ the +n is doing the floorMod's job, given |i - 1| < n
const next = (i + 1) % n;          // fine: never negative
```

The `+ n` shortcut is correct only because the value is known to be no more negative than `−1`. For
a general rotation by `k`, where `k` may be any integer, use the full idiom — `mod(i - k, n)` — not
`(i - k + n) % n`.

**A rolling hash's sliding step.** Removing the outgoing character's contribution is a subtraction —
`hash = (hash - leaving * power) * base + entering` — and it goes negative on most inputs. The
window then hashes to a negative value, misses in a `Map` keyed on non-negative residues, and the
match silently never fires.

## Wrap the operation, not the result

The correction has to happen at every step, not once at the end, because a negative intermediate
fed into a subsequent multiplication produces a negative product and the sign becomes entangled with
several other terms. The way to make that unforgettable is to stop writing `%` in the algorithm at
all and to write named operations instead:

```ts
// TypeScript — the four modular operations as a unit. Nothing else in the algorithm writes `%`.
const MOD = 1_000_000_007;

export const modAdd = (a: number, b: number) => (a + b) % MOD;
export const modSub = (a: number, b: number) => ((a - b) % MOD + MOD) % MOD;   // ✅ the only tricky one
export const modMul = (a: number, b: number) => a * b % MOD;                   // ⚠️ see 07b for the range
export const modOf  = (x: number) => ((x % MOD) + MOD) % MOD;
```

```java
// Java — the same, using the documented floorMod rather than the idiom
static final int MOD = 1_000_000_007;

static int modAdd(int a, int b) { return Math.floorMod(a + b, MOD); }
static int modSub(int a, int b) { return Math.floorMod(a - b, MOD); }
static long modMul(long a, long b) { return a * b % MOD; }   // long, deliberately — see 07b
```

A dynamic-programming recurrence written with `modSub` cannot exhibit the bug; the same recurrence
written with inline `%` will exhibit it at exactly one subtraction, on exactly the inputs large
enough that the term goes negative, which is to say the inputs that are not in the small test.

⚠️ `modMul` above is where the *other* failure lives — the product of two residues near `10^9` is
near `10^18`, which is fine for a Java `long` and far outside JavaScript's exactly-representable
integer range. That is
[07b · Modular exponentiation and where the product overflows](07b-modular-exponentiation-and-where-the-product-overflows.md),
and it is a different bug from this page's.

## `floorDiv` is the other half of the pair

When you split a value into a quotient and a remainder — a linear index into `(row, column)`, a
minute count into `(hours, minutes)`, a global position into `(page, offset)` — the two halves must
come from the **same** convention or they do not reconstruct the original:

```java
int row = Math.floorDiv(index, width);      // ✅ matched pair
int col = Math.floorMod(index, width);      //    row * width + col == index, for every index
// int row = index / width;                 // ⛔ mixed with floorMod: reconstruction is off by one
// int col = Math.floorMod(index, width);   //    for negative index
```

The identity `q·b + r == a` holds for `(/, %)` together and for `(floorDiv, floorMod)` together, and
for neither cross-pairing — which is the same rule that governs the extended Euclidean algorithm in
[03d](03d-the-extended-euclidean-algorithm-and-bezout.md). In TypeScript the matched pairs are
`(Math.trunc(a / b), a % b)` and `(Math.floor(a / b), ((a % b) + b) % b)`.

## Gotchas

**★ Symptom: the answer is negative when the problem promised a value in `[0, MOD)`.** Cause: a
subtraction went negative before the `%`, and `%` is a remainder that keeps the sign of its
dividend — the javadoc's own `(-4 % +3) == -1` is the proof. Fix: `Math.floorMod(x, MOD)` in Java,
`((x % MOD) + MOD) % MOD` in TypeScript, applied at every subtraction rather than once at the end:

```ts
const sub = (a: number, b: number) => ((a - b) % MOD + MOD) % MOD;   // ✅ wrap the operation itself
```

**★ Symptom: `ArrayIndexOutOfBoundsException: -3` from a shard or bucket lookup.** Cause:
`hashCode()` returns an `int` that may be negative, and `%` preserved the sign. Fix:
`Math.floorMod(hash, n)`. ⛔ **Not** `Math.abs(hash) % n` — that is wrong for `Integer.MIN_VALUE`,
whose absolute value is not representable, and the resulting bug fires for one hash value in
roughly four billion.

**★ Symptom: `((x % m) + m) % m` returns a negative number.** Cause: `m` is negative. The idiom is
stated for `m > 0` and nothing in it enforces that. Fix: assert the modulus is positive at the
boundary; a negative modulus in a counting problem is always a bug upstream, not a case to handle.

**Symptom: `(i - 1 + n) % n` is correct in one place and wrong in another.** Cause: adding `n` once
compensates for exactly one `n` of negativity, so it works for `i - 1` and fails for a general
`i - k` where `k` may exceed `n`. Fix: use the full idiom, `((i - k) % n + n) % n`, or
`Math.floorMod(i - k, n)`, wherever the offset is not provably small.

**★ Symptom: a negative *divisor* produces a surprising sign even after switching to `floorMod`.**
Cause: `floorMod` takes the sign of the divisor, `%` takes the sign of the dividend — they are two
different sign conventions, and the javadoc's second documented pair shows it:
`floorMod(+4, -3) == -2` while `(+4 % -3) == +1`. Fix: neither operator is wrong; assert the
modulus is positive at the boundary. A negative modulus in a counting problem, a shard count or a
buffer length is a bug upstream, and handling it politely just moves the failure.

**★ Symptom: a linear index converted to `(row, col)` reconstructs to the wrong value for negative
indices.** Cause: the quotient came from `/` and the remainder from `Math.floorMod`, so the identity
`row * width + col == index` does not hold. Fix: use a matched pair —
`(Math.floorDiv(i, w), Math.floorMod(i, w))` or `(i / w, i % w)` — never one of each.

**Symptom: `BigInt` was adopted "to fix the negative modulus" and it is still negative.** Cause:
`BigInt`'s `%` is a remainder too; arbitrary precision changes the range, not the sign convention.
Fix: the same idiom in BigInt literals — `((x % m) + m) % m` with `0n`-style constants throughout,
since MDN documents that a BigInt cannot be mixed with a Number in an operation.

**Symptom: a rolling hash matches at a position where the strings differ.** Cause: not the sign at
all — a residue collision. `a % m === b % m` proves `a ≡ b (mod m)` and nothing stronger. Fix: treat
a hash match as a candidate and confirm with a direct comparison, or state the collision probability
explicitly. The reason it belongs on this page is that the *other* rolling-hash bug is the sign one:
removing the outgoing character's contribution is a subtraction, and it goes negative.

## Interview questions

**★ Why does your answer come out negative, and what is the fix in each language?**
Because `%` is a *remainder*, not a modulus, in both TypeScript and Java: its result takes the sign
of the dividend. Java's own javadoc documents the divergence — `floorMod(-4, +3) == +2` while
`(-4 % +3) == -1` — and says the two differ exactly when the signs of the arguments differ. The fix
in Java is `Math.floorMod(x, m)`. TypeScript has no such function, so the idiom is
`((x % m) + m) % m`: the first `%` brings the value into `(−m, m)`, the `+ m` makes it positive,
the second `%` brings it into `[0, m)`. Writing just `(x + m) % m` is a common near-miss that fails
for anything more negative than `−m`. And `Math.abs(x) % m` is a worse near-miss, because it is
wrong for `Integer.MIN_VALUE` and only for that.

**★ Where does this bite in production code rather than in a puzzle?**
Three places. Sharding: `orderId.hashCode() % SHARD_COUNT` returns a negative shard for about half
of all identifiers, because `hashCode` returns a signed `int`. Circular buffers and ring indices:
`(i - 1) % n` is `-1` at `i = 0`, which throws in Java and reads `undefined` in TypeScript. And
rolling hashes over text — product descriptions, request bodies — where a subtraction of the
outgoing character's contribution goes negative before the reduction. All three are the same bug and
all three are fixed by `floorMod` or the idiom.

**★ How do you compute `(a − b) mod p` safely, and why is wrapping the operation better than fixing
the result?**
`((a - b) % p + p) % p`, or `Math.floorMod(a - b, p)`. Wrapping the operation in a named helper —
`sub(a, b)` — is better than remembering to correct the result because the correction has to happen
at *every* subtraction, not once at the end: a negative intermediate fed into a subsequent
multiplication produces a negative product, and by the time the final `%` runs, the sign is
entangled with several other terms. In a long dynamic-programming recurrence, one unwrapped
subtraction is enough, and it will be the one that only fires on a large input.

**★ What is `Math.floorDiv` for, and when do you need it together with `floorMod`?**
Whenever you decompose a value into a quotient and a remainder and expect to reconstruct it. The
javadoc states that `floorDiv` and `/` differ when the signs of the arguments differ and the
quotient is not an integer — `floorDiv(-4, 3) == -2` against `(-4 / 3) == -1`. The identity
`q·b + r == a` holds for `(/, %)` as a pair and for `(floorDiv, floorMod)` as a pair, and for
neither mixture. So converting a possibly-negative linear index into `(row, column)`, or a signed
minute offset into `(hours, minutes)`, needs both halves from the same convention. Mixing them
produces a reconstruction that is off by one exactly on negative inputs, which is the same class of
bug as mixing conventions inside the extended Euclidean algorithm.

**★ Why is `Math.abs(hash) % n` wrong, given that it fixes the sign?**
Because there is one `int` whose absolute value is not an `int`. `Integer.MIN_VALUE` is documented
as `-2^31` and `Integer.MAX_VALUE` as `2^31 − 1`, so negating `MIN_VALUE` has no representable
result and `Math.abs` returns the argument unchanged — still negative. The bucket index is then
negative for exactly one hash value out of about four billion, which means the bug is real, is
impossible to reproduce from a bug report, and will eventually happen in a system that hashes
enough keys. `Math.floorMod(hash, n)` has no such case. It is also worth noticing that `abs` changes
the *distribution* — it folds two hash values onto one bucket — while `floorMod` does not.

**Does moving to `BigInt` or `BigInteger` remove this problem?**
Not by itself. `BigInt`'s `%` is a remainder with the same sign rule, so the idiom is still needed —
written with BigInt literals, since MDN documents that BigInt values cannot be mixed with Numbers in
an operation. `BigInteger` is the one case where the fix is a method name: `mod` is documented to
*"always return a non-negative BigInteger"* while `remainder` is documented as `(this % val)` and
inherits the sign rule. So in `BigInteger` the answer is "call `mod`, never `remainder`", and in
`BigInt` the answer is the same idiom you would have written for a `number`.

{/* FOOTER */}
