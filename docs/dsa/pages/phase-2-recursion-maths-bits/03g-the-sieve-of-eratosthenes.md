---
title: "The sieve of Eratosthenes replaces a per-number question with a per-range one, and the two lines that make it fast rather than merely correct are the inner loop starting at p squared and the outer loop stopping at the square root — both of which follow from the same fact that every composite has a prime factor no larger than its square root"
sidebar_label: "03g · The sieve of Eratosthenes"
sidebar_position: 3.6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. The sieve, its `Θ(n log log n)` bound (which rests on Mertens' theorem for
> the sum of reciprocals of primes) and the segmented variant are **textbook mathematics, derived
> or attributed on this page rather than cited** — the research bank for this phase records that
> complexity claims for the sieve belong to
> [Phase 1](../phase-1-complexity/01-big-o-theta-and-omega.md)'s vocabulary and have no primary
> source to quote. `Uint8Array` is described by its own definition (an array of 8-bit unsigned
> integers). ⚠️ The JVM does **not** specify the storage layout of a `boolean[]`, so no claim about
> its size is made here. **No sandbox run** — no memory figure below is a measurement; each is
> arithmetic from an element count.

**A sieve is what you write the moment the question changes from "is `n` prime" to "which numbers
below `n` are prime", and the change of shape is worth more than any constant factor.**
[03f](03f-primality-by-trial-division.md) answers one query in `Θ(√n)` with constant memory; the
sieve answers every query below `n` in `Θ(n log log n)` total and `Θ(1)` per lookup, at the cost of
`Θ(n)` memory. Calling `isPrime` in a loop over a range is `Θ(n√n)` and is the single clearest sign
that someone has the wrong tool. The algorithm itself is two nested loops, and the two decisions
that matter are both in the loop bounds rather than in the body: the inner loop starts at `p·p`, not
at `2p`, and the outer loop stops at `√n`. Both follow from the one fact
[03f](03f-primality-by-trial-division.md) already proved.

## The algorithm, derived

Start with every number from 2 to `n` marked "possibly prime". Walk `p` upward. When you reach a `p`
still marked, it has no divisor below itself, so it is prime — and every multiple of it is not, so
strike them out.

**Why the inner loop starts at `p·p`.** The multiples of `p` are `2p, 3p, 4p, …`. Every multiple
`q·p` with `q < p` has a factor `q` smaller than `p`, so it was already struck out when the sieve
processed `q` (or when it processed one of `q`'s prime factors, which is smaller still). The first
multiple of `p` that no earlier pass could have reached is `p·p`. Starting there is not an
optimisation bolted on afterwards; it is the observation that makes the total work a sum over primes
rather than a sum over all numbers.

**Why the outer loop stops at `√n`.** If `p > √n`, then `p·p > n` and the inner loop has nothing to
do. Every composite below `n` has a prime factor at most `√n`, so it has already been struck.
Numbers above `√n` still need *reading* — they are the answers — but they never need to drive an
inner loop.

```ts
// TypeScript — the sieve. Uint8Array is a byte per entry, which is what makes n = 10^8 affordable.
export function sieve(n: number): Uint8Array {
  const isComposite = new Uint8Array(n + 1);      // 0 = possibly prime, 1 = struck out
  isComposite[0] = 1;
  if (n >= 1) isComposite[1] = 1;                 // ① 0 and 1 are not prime and never get struck
  for (let p = 2; p * p <= n; p++) {              // ② outer bound is the square root
    if (isComposite[p]) continue;
    for (let m = p * p; m <= n; m += p) {         // ③ inner start is p*p, not 2*p
      isComposite[m] = 1;
    }
  }
  return isComposite;
}

export function primesUpTo(n: number): number[] {
  const composite = sieve(n);
  const out: number[] = [];
  for (let i = 2; i <= n; i++) if (!composite[i]) out.push(i);
  return out;
}
```

```java
// Java — same sieve. BitSet is used deliberately; see the note on boolean[] below.
static BitSet sieve(int n) {
    BitSet composite = new BitSet(n + 1);
    composite.set(0);
    if (n >= 1) composite.set(1);
    for (int p = 2; (long) p * p <= n; p++) {      // ✅ widen before multiplying — see 03f
        if (composite.get(p)) continue;
        for (long m = (long) p * p; m <= n; m += p) composite.set((int) m);
    }
    return composite;
}
```

## The cost, and where `log log n` comes from

The inner loop for a prime `p` runs about `n/p` times. Summing over the primes up to `n`:

```
Σ_{p ≤ n, p prime} n/p  =  n · Σ_{p ≤ n} 1/p
```

The sum of the reciprocals of the primes up to `n` grows like `ln ln n` — that is **Mertens' second
theorem**, and it is textbook rather than something to derive on a board. So the total is
`Θ(n log log n)`. Two things are worth saying about that bound. First, `log log n` is, for every `n`
you will ever allocate memory for, a small single-digit number, so the sieve is *linear in
practice* and it is fair to describe it that way as long as you can produce the real bound when
asked. Second, the bound depends on starting the inner loop at `p·p`; starting at `2p` still gives
`Θ(n log log n)` asymptotically but does strictly more work, while the far more common mistake —
running the inner loop for **every** `p`, not only the primes — gives the harmonic sum
`n · Σ 1/k = Θ(n log n)`, which is a genuinely different bound.

**Memory** is `Θ(n)` and is usually the binding constraint rather than time. A `Uint8Array` is one
byte per entry by definition, so `n = 10^8` is `10^8` bytes — a hundred megabytes, which is
arithmetic, not a measurement. A bit-packed representation divides that by eight. Sieving only the
odd numbers halves the entry count again, since 2 is the only even prime; the index arithmetic
(`i` represents `2i + 1`) is the price, and it is the first thing to try when the array does not
fit.

⚠️ In Java, `boolean[]` is the obvious choice and the language specifies nothing about how a JVM
stores it, so no size claim is made here. `java.util.BitSet` is the type whose whole purpose is
explicit bit packing, and it is the one to reach for when the range is large.

## The segmented sieve

The plain sieve needs an array as large as `n`. When the question is "the primes between `L` and
`R`" with `R` enormous but `R − L` small — the shape of "find primes in `[10^12, 10^12 + 10^6]`" —
allocate for the *window*, not for `R`.

The observation is again that every composite below `R` has a prime factor at most `√R`. So: sieve
`[2, √R]` normally, then for each of those primes strike out its multiples inside `[L, R]`, starting
at the first multiple at or above `L`.

```ts
// TypeScript — primes in [lo, hi] using O(sqrt(hi) + (hi - lo)) memory.
export function segmentedSieve(lo: number, hi: number): number[] {
  if (hi < 2 || hi < lo) return [];
  const base = primesUpTo(Math.floor(Math.sqrt(hi)));
  const size = hi - lo + 1;
  const composite = new Uint8Array(size);
  for (const p of base) {
    // first multiple of p that is >= lo, and never below p*p (p itself must survive)
    let start = Math.max(p * p, Math.ceil(lo / p) * p);
    for (let m = start; m <= hi; m += p) composite[m - lo] = 1;
  }
  const out: number[] = [];
  for (let i = 0; i < size; i++) {
    const value = lo + i;
    if (value >= 2 && !composite[i]) out.push(value);
  }
  return out;
}
```

The two lines that carry the bugs are the `start` computation — `Math.max(p * p, …)` is what stops
the sieve from striking out `p` itself when `p` lies inside the window — and the `value >= 2` guard,
which is what stops `0` and `1` being reported when `lo` is below 2.

## Gotchas

**★ Symptom: the sieve is correct but is `Θ(n log n)` rather than `Θ(n log log n)`.** Cause: the
inner loop runs for every `p`, not only for the primes — the `if (isComposite[p]) continue;` line is
missing. The work becomes the harmonic sum `n·(1/2 + 1/3 + 1/4 + …) = Θ(n log n)` instead of a sum
over primes only. Fix: skip composite `p`. It is one line and it is the difference between the two
bounds.

**★ Symptom: the sieve reports `4`, `9` and `25` as prime.** Cause: the inner loop starts at
`p * p + p` or at `2 * p * p`, or the strike-out loop is written `for (m = p*p + p; …)` in an attempt
to "not strike out `p` itself". Fix: start at exactly `p·p`. Striking out `p·p` is correct — `p·p`
*is* composite — and every smaller multiple of `p` was already struck by a smaller prime. If you
want the reasoning as code, the loop that starts at `2p` is also correct, merely slower; the loop
that starts anywhere above `p·p` is wrong.

**★ Symptom: `sieve(n)` reports `1` as prime, or throws on `n = 0`.** Cause: `0` and `1` are never
struck out by the algorithm, because it only strikes multiples of primes, and they are not
multiples of any prime. They have to be excluded by hand. Fix: `isComposite[0] = 1` and
`isComposite[1] = 1`, guarding the second for `n = 0` where index 1 does not exist:

```ts
isComposite[0] = 1;
if (n >= 1) isComposite[1] = 1;      // ✅ both, and the guard, because neither is ever struck
```

**★ Symptom: in Java, the sieve of a large `int` range loops far longer than it should or throws
`ArrayIndexOutOfBoundsException`.** Cause: `p * p` in the outer condition, and `m = p * p` in the
inner initialiser, are `int` multiplications that wrap — the same `i = 46341` boundary as
[03f](03f-primality-by-trial-division.md), since `Integer.MAX_VALUE` is documented as `2^31-1`. A
wrapped negative start index then indexes out of range. Fix: widen an operand before multiplying,
and keep the inner accumulator `long`: `for (long m = (long) p * p; m <= n; m += p)`. Casting the
product does not help — the wrap has already happened.

**★ Symptom: the sieve is right and the process dies allocating it.** Cause: `Θ(n)` memory is the
sieve's real constraint, and it is easy to ask for a range whose *time* is fine and whose *space*
is not. Fix, in order of how much they buy: use a byte array rather than an array of boxed values;
bit-pack, dividing by eight; sieve only odd numbers, halving again; and if `n` is genuinely enormous
but the window of interest is small, switch to the segmented sieve, whose memory is
`Θ(√n + window)`.

**★ Symptom: a segmented sieve omits primes that lie inside the window.** Cause: the strike-out
loop starts at the first multiple of `p` at or above `lo`, which for a `p` inside the window is `p`
itself — so the prime strikes itself out. Fix: start at `Math.max(p * p, ceil(lo / p) * p)`. The
`p·p` floor is exactly the guard from the unsegmented sieve, and it is doing the same job.

**Symptom: a segmented sieve reports 0 and 1 when the window starts below 2.** Cause: the base
primes never strike them, exactly as in the plain sieve, and the offset indexing hides it. Fix:
a `value >= 2` test in the collection loop, not a special case in the striking loop.

**Symptom: `new Array(n).fill(true)` is used and the sieve is far heavier than expected.** Cause: a
plain JavaScript array holds boxed values and a generic element representation, where a
`Uint8Array` holds one byte per entry by definition. Fix: `new Uint8Array(n + 1)`, whose default
value is `0` — so the polarity of the flag should be "is composite", not "is prime", to avoid an
initialising `fill` pass entirely.

**Symptom: the sieve is rebuilt on every request in a service.** Cause: treating it as a function
rather than as a table. Fix: build it once at startup for the largest bound the service supports and
hold it; the whole point of the sieve is that its cost is amortised across every query, which is
exactly the argument in
[Phase 1 · Amortised analysis](../phase-1-complexity/03-amortised-analysis.md).

## Interview questions

**★ Why does the inner loop start at `p·p`?**
Because every multiple `q·p` with `q < p` has already been struck out. Such a multiple has a factor
`q` smaller than `p`, so it was eliminated when the sieve processed `q`, or earlier still when it
processed one of `q`'s prime factors. The first multiple of `p` that no earlier pass could reach is
`p·p`. It matters beyond speed: it is the observation that turns the total work into a sum over
primes, `n·Σ 1/p`, rather than a sum over all integers. Starting at `2p` is still correct, just
slower; starting anywhere above `p·p` is wrong.

**★ Why does the outer loop stop at `√n`, when the array runs to `n`?**
Because a prime `p > √n` has `p·p > n`, so its inner loop has no work to do — every multiple of it
that is at most `n` has a co-factor smaller than `p`, and was therefore struck by that smaller
factor's pass. The entries above `√n` still have to be *read* to collect the primes; they just never
drive the inner loop. It is the same fact as the trial-division bound: every composite has a prime
factor at most its square root.

**★ What is the sieve's complexity, and where does `log log n` come from?**
`Θ(n log log n)` time and `Θ(n)` space. The inner loop for prime `p` runs about `n/p` times, so the
total is `n · Σ_{p ≤ n} 1/p`, and the sum of reciprocals of primes up to `n` grows like `ln ln n` —
Mertens' second theorem, which is textbook and which I would name rather than derive. The practical
gloss worth adding: `log log n` is a small single-digit number for any `n` you can allocate, so the
sieve behaves linearly, and the honest way to say it is "essentially linear, formally
`n log log n`". The bound depends on skipping composite `p`; without that skip it degrades to the
harmonic sum, `Θ(n log n)`.

**★ When do you sieve and when do you trial-divide?**
Sieve when the question is about a *range* and the range fits in memory: `Θ(n log log n)` once, then
`Θ(1)` per query. Trial-divide when the question is about *one* number, especially a large one:
`Θ(√n)` with constant memory, and no allocation. The failure mode to name is `isPrime` inside a loop
over a range, which is `Θ(n√n)`. If the range is huge but the *window* of interest is small, neither
applies directly and the answer is the segmented sieve; if the numbers are individually huge, the
answer is Miller–Rabin.

**★ How do you find the primes between 10^12 and 10^12 + 10^6?**
A segmented sieve. Allocating an array of size `10^12` is impossible, but every composite below
`10^12 + 10^6` has a prime factor at most its square root, which is about `10^6`. So sieve `[2, 10^6]`
with an ordinary sieve, then allocate a window array of `10^6 + 1` entries representing
`[L, R]`, and for each base prime strike out its multiples inside the window, starting at
`max(p·p, ⌈L/p⌉·p)`. Memory is `Θ(√R + (R − L))`. The two bugs to call out before writing it are the
`p·p` floor — without it, a prime inside the window strikes itself out — and the offset arithmetic,
since the window array is indexed by `value − L`.

**How would you cut the sieve's memory in half, and then in half again?**
First, store one bit per entry rather than one byte — a `Uint8Array` used as a bitset in TypeScript,
a `java.util.BitSet` in Java — which is a factor of eight. Second, sieve only the odd numbers: 2 is
the only even prime, so index `i` can represent the value `2i + 1`, halving the entry count at the
cost of index arithmetic in both loops. Beyond that, wheel factorisation extends the idea by also
excluding multiples of 3 and 5, with the same diminishing returns as the `6k ± 1` wheel in trial
division. And if the range itself is the problem rather than the density, the segmented sieve
changes the memory from `Θ(n)` to `Θ(√n + window)`, which is a different order of improvement.

**Why is the flag array "is composite" rather than "is prime"?**
Because the default value of a freshly allocated numeric array is zero in both languages, so
"0 means possibly prime" needs no initialisation pass at all, while "true means prime" needs an
`Array.fill` or an `Arrays.fill` over `n` entries before the algorithm starts. It is a small thing
and it is the sort of detail that shows you have written one rather than read one.

{/* FOOTER */}
