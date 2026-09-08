---
title: "A linear recurrence is one fixed linear map applied n times, so the n-th term is a matrix power — and once you can build the transition matrix from the recurrence rather than recall it, every k-term recurrence falls out of the same mechanical construction"
sidebar_label: "12 · Matrix exponentiation"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08. **Everything on this page is mathematics derived here and cited to nothing** —
> the companion-matrix construction, the closed form for powers of the Fibonacci matrix and its
> induction proof, the augmentation for inhomogeneous and polynomial terms, and the prefix-sum
> augmentation. That is deliberate: matrix exponentiation has no primary source to quote, so a page
> that cited one would be citing a blog. The language-behaviour claims that *do* need a source —
> where the products overflow — are in [12c](12c-the-multiply-the-power-and-the-modulus.md), which
> quotes MDN and the JDK 25 javadoc through
> [05](05-integer-limits-and-overflow.md). **No sandbox run**: every matrix below is written out and
> can be multiplied by hand; none is program output.
> Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**A linear recurrence says the next state is a fixed linear function of the last few states.
"Fixed" and "linear" together mean *matrix*, and applying it `n` times means *matrix power* — so a
recurrence you would evaluate in `Θ(n)` steps can be evaluated in `Θ(log n)` matrix multiplications
instead.** That is the entire idea, and it is worth about ten minutes of derivation, after which the
technique generalises to any recurrence you are handed rather than only to Fibonacci.

The reason this is a **Know** topic rather than a Master one: it is the right tool in a narrow band
— a linear recurrence with a small number of terms and an `n` far too large to iterate, typically
`10^12` or an exponent given in binary. Outside that band a plain loop is simpler and faster
([12d](12d-counting-walks-and-when-not-to-bother.md)). What you should be able to do from memory is
recognise the shape and build the matrix; the multiplication code you can reconstruct.

## The idea, before any matrices

Take Fibonacci: `F(n) = F(n-1) + F(n-2)`. Evaluating it needs the last two values, so make those
*the state*:

```
v(n) = [ F(n), F(n-1) ]
```

The recurrence then says something stronger than it looks: **`v(n+1)` is determined by `v(n)`, by a
rule that does not depend on `n`.** A rule that maps a vector to a vector, linearly, with fixed
coefficients, is a matrix. Call it `M`. Then

```
v(n+1) = M · v(n)     and therefore     v(n) = M^(n-1) · v(1)
```

and the whole problem becomes: compute `M` to a power. Since matrix multiplication is associative,
that power can be taken by repeated squaring rather than repeated multiplication, which is the
`Θ(log n)`. That squaring schedule is [Fast exponentiation and the modular inverse](07-fast-exponentiation-and-the-modular-inverse.md) — the argument there is about any associative operation, and matrices are one, so
nothing about it needs re-deriving here. This page is about *what matrix*, which is the part that
actually gets asked.

## Building the Fibonacci matrix, not recalling it

Write the two equations you want the matrix to produce, in the order the state vector lists them:

```
F(n+1) = 1 · F(n) + 1 · F(n-1)
F(n)   = 1 · F(n) + 0 · F(n-1)
```

The coefficients, read off row by row, *are* the matrix:

```
        [ 1  1 ]              [ F(n+1) ]   [ 1  1 ] [ F(n)   ]
  M  =  [ 1  0 ]        so    [ F(n)   ] = [ 1  0 ] [ F(n-1) ]
```

The second row is the boring one and it is the one people get wrong: it says "the new second
component is the old first component", which is the shift that keeps the window moving. Every
companion matrix has that structure — one interesting row, and an identity shifted down.

With `F(0) = 0` and `F(1) = 1`, `v(1) = [1, 0]`, so:

```
v(n) = M^(n-1) · [1, 0]        →      F(n) = (M^(n-1))[0][0]
```

## The closed form for the power, and why it is worth proving

There is a tidier statement, and proving it is the two-minute exercise that makes the whole technique
stick:

```
        [ F(n+1)  F(n)   ]
M^n  =  [ F(n)    F(n-1) ]        for n >= 1
```

**Base case,** `n = 1`: the right-hand side is `[[F(2), F(1)], [F(1), F(0)]] = [[1, 1], [1, 0]]`,
which is `M`. ✅

**Step.** Assume it for `n`, multiply by `M` on the right:

```
[ F(n+1)  F(n)   ] [ 1  1 ]   [ F(n+1)+F(n)    F(n+1) ]   [ F(n+2)  F(n+1) ]
[ F(n)    F(n-1) ] [ 1  0 ] = [ F(n)+F(n-1)    F(n)   ] = [ F(n+1)  F(n)   ]
```

which is the claim for `n + 1`. ∎

Two things fall out. **`F(n) = (M^n)[0][1]`**, so you can read the answer straight out of the power
with no vector multiply at all. And the identity extends to `n = 0` if you accept `F(-1) = 1`, since
`M^0` is the identity `[[1, 0], [0, 1]] = [[F(1), F(0)], [F(0), F(-1)]]` — which is a consistency
check on the construction rather than a curiosity, and a good sign you have the indices right.

🔴 **Check the base case against `n = 1` and `n = 2` explicitly, every time.** Off-by-one in the
exponent is the single most common error in this technique, because `M^(n-1) · v(1)` and `M^n · v(0)`
are both correct with different starting vectors and they differ by one power.

## The general recipe: any k-term linear recurrence

Given

```
F(n) = c1·F(n-1) + c2·F(n-2) + … + ck·F(n-k)
```

take the state to be the last `k` values, most recent first:

```
v(n) = [ F(n), F(n-1), …, F(n-k+1) ]
```

and the transition matrix is `k × k`, with **the coefficients in the top row and an identity shifted
one place down**:

```
      [ c1  c2  c3  …  ck ]
      [  1   0   0  …   0 ]
M  =  [  0   1   0  …   0 ]
      [  …                ]
      [  0   0  …   1   0 ]
```

Row 1 computes the new value. Row `i` (for `i ≥ 2`) copies the old component `i-1` into position
`i` — the window sliding by one. This is the **companion matrix** of the recurrence, and the
construction is mechanical: **there is nothing to remember except "coefficients on top, identity
underneath, shifted down one".**

The cost is what the next page quantifies, but the shape is already visible: `k × k` multiplication
is `Θ(k³)`, and you need `Θ(log n)` of them, so `Θ(k³ log n)` against the loop's `Θ(n · k)`. The
technique wins when `n` is huge and `k` is small, and loses the moment `k` grows
([12c](12c-the-multiply-the-power-and-the-modulus.md)).

## Where the rest of this topic goes

- [12b](12b-augmenting-the-state.md) — constants, polynomial terms and prefix sums: the three
  augmentations that put a recurrence back inside the technique when it does not start there.
- [12c](12c-the-multiply-the-power-and-the-modulus.md) — the multiplication written out, its
  `Θ(k³)`, the identity as the base case, the squaring schedule, and where the products overflow.
- [12d](12d-counting-walks-and-when-not-to-bother.md) — the non-recurrence uses (walks in a graph,
  automata, min-plus shortest walks) and the three structural cases where the whole technique is the
  wrong answer.
- [12e](12e-fast-doubling-and-why-not-binet.md) — the fourth case: for Fibonacci specifically, fast
  doubling beats the matrix and Binet's formula is a trap.

## Gotchas

**★ Symptom: every answer is exactly one Fibonacci number off.** Cause: the exponent. `v(n) =
M^(n-1) · v(1)` and `v(n) = M^n · v(0)` are both correct with different starting vectors, and mixing
them shifts everything by one. Fix: pick one convention, then verify it by hand at `n = 1` and
`n = 2` before running anything larger. There is no cheaper check and no substitute for it.

**★ Symptom: the matrix produces correct values for a while and then diverges.** Cause: a row was
written in terms of the *new* state rather than the old one — most often the prefix-sum row, written
as `S(n) + F(n+1)` instead of `S(n) + F(n) + F(n-1)`. Fix: every row of `M` must be a linear
combination of the components of `v(n)` only. Write the equations out in full before writing the
matrix; the matrix is the transcription step, not the thinking step.

**★ Symptom: the transition matrix is transposed and the answers are wrong for asymmetric
recurrences.** Cause: `M · v` with the state as a column and `v · M` with it as a row need
transposed matrices, and Fibonacci's matrix is symmetric so it hides the mistake completely. Fix:
fix a convention — this page uses column vectors and `v(n+1) = M · v(n)` — and test on a recurrence
that is *not* symmetric, such as `F(n) = 2F(n-1) + 3F(n-2)`, whose matrix `[[2, 3], [1, 0]]` is not
its own transpose.

**★ Symptom: the state vector's order does not match the matrix's rows.** Cause: the state was
written most-recent-last (`[F(n-1), F(n)]`) while the matrix was built for most-recent-first. Fix:
either convention works; write it down next to the matrix and keep it. The identity block moves from
below the coefficient row to above it when you flip.

**Symptom: a recurrence with `n`-dependent coefficients was pushed into a matrix.** Cause: the
technique needs a *fixed* linear map; `F(n) = n·F(n-1) + F(n-2)` has a coefficient that changes every
step, so there is no single `M` to raise. Fix: this is not a matrix-exponentiation problem. Carrying
`n` in the state fixes an inhomogeneous *term*, not a variable *coefficient* — the product `n·F(n-1)`
is a product of two state components, which is not linear.

**★ Symptom: the technique is applied to a recurrence that is not linear at all.** Cause: pattern
matching on "recurrence" rather than checking the two required properties — a *fixed* map (no
coefficient depending on `n`) and a *linear* one (no product of two state components, no `min` or
`max`). Fix: check both before building anything. `F(n) = min(F(n-1), F(n-2)) + 1` is not linear over
the usual arithmetic, though it is over the min-plus semiring, which is a real technique with real
limits ([12d](12d-counting-walks-and-when-not-to-bother.md)).

## Interview questions

**★ Derive the Fibonacci transition matrix.**
Make the state the window the recurrence actually needs — `v(n) = [F(n), F(n-1)]` — and then write
the two equations for the next state in terms of the current one: `F(n+1) = 1·F(n) + 1·F(n-1)` and
`F(n) = 1·F(n) + 0·F(n-1)`. The coefficients, row by row, are the matrix `[[1, 1], [1, 0]]`. The
second row is the one people skip and it is the one doing the work: it slides the window. Then
`v(n) = M^(n-1) · v(1)` with `v(1) = [1, 0]`. The nicer statement, provable by a two-line induction,
is `M^n = [[F(n+1), F(n)], [F(n), F(n-1)]]`, so `F(n)` can be read directly out of the corner of the
power with no vector multiplication at all.

**★ Given an arbitrary k-term linear recurrence, how do you build the matrix?**
Mechanically: the state is the last `k` values, most recent first; the top row of `M` is the
recurrence's coefficients `c1 … ck`; and the remaining `k-1` rows are an identity shifted one place
down, which copies each component into the next slot. That is the companion matrix. Nothing has to
be remembered beyond "coefficients on top, shifted identity underneath", and it is worth saying that
out loud, because the question is usually testing whether you *derived* Fibonacci's matrix or
memorised it.

**★ Where does this technique stop applying?**
The moment the map stops being fixed and linear. A coefficient that depends on `n` —
`F(n) = n·F(n-1) + F(n-2)` — has no single matrix, because `n·F(n-1)` is a product of two state
components rather than a linear function of the state. Non-linear recurrences like
`F(n) = F(n-1)·F(n-2)` are out for the same reason, though a *logarithm* sometimes turns a
multiplicative recurrence into an additive one and puts it back in range, which is worth mentioning.
And it stops being *worth* applying long before it stops applying: `Θ(k³ log n)` beats `Θ(n·k)` only
when `n` is enormous and `k` is small ([12d](12d-counting-walks-and-when-not-to-bother.md)).

**Why does the state have to be "the last k values" and not something else?**
Because the state must contain exactly what the next step depends on, and the recurrence names that
explicitly: the last `k` terms. Anything less and the map is not determined; anything more and you
are raising a larger matrix to a power for nothing, at a cubic cost in the dimension. That is the
same principle as choosing a DP state — the state is what the future depends on, no more — and it is
why the augmentations on this page each add exactly one component per thing the future needs.

---

← Prev: [11j · Base conversion and digit sums](11j-base-conversion-and-digit-sums.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [12b · Augmenting the state](12b-augmenting-the-state.md)
