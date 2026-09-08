---
title: "A constant term, a polynomial in n, or a running total each look like a reason the recurrence has no matrix — and each is fixed by putting the offending quantity into the state as one more component that updates itself"
sidebar_label: "12b · Augmenting the state"
sidebar_position: 12.1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08. **Everything on this page is mathematics derived here and cited to nothing** —
> the augmentation for a constant term, the polynomial augmentation and its binomial expansion, and
> the prefix-sum row. Each matrix below can be multiplied by hand against the equations it was built
> from, which is the only verification available and the right one. **No sandbox run.**
> Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**The companion-matrix construction in [12](12-matrix-exponentiation.md) covers recurrences that are
exactly `F(n) = Σ c_i · F(n-i)` — and almost no problem hands you one of those.** Real recurrences
carry a constant, or a term that grows with `n`, or a question that asks for the running total as
well as the term. All three are fixed the same way, and the way is worth internalising as a single
move: **if the next state depends on something that is not in the state, put that something in the
state, and give it a row that updates it.** The price is one dimension each, and the cost is cubic in
the dimension, so the augmentations are not free — but a 3×3 raised to a power is still nothing
compared to iterating `10^18` times.

## The inhomogeneous case: add a constant row

Recurrences in real problems often carry a constant:

```
F(n) = F(n-1) + F(n-2) + d
```

This is not linear in the state — it is *affine* — so it has no matrix as written. The fix is to put
the constant **into the state** as a component that is always `1`:

```
v(n) = [ F(n), F(n-1), 1 ]
```

Now write the three equations you want:

```
F(n+1) = 1·F(n) + 1·F(n-1) + d·1
F(n)   = 1·F(n) + 0·F(n-1) + 0·1
1      = 0·F(n) + 0·F(n-1) + 1·1
```

and read off the matrix:

```
      [ 1  1  d ]
M  =  [ 1  0  0 ]
      [ 0  0  1 ]
```

The last row is what keeps the `1` a `1` forever, which is the whole trick. **A `k`-term recurrence
with a constant term becomes a `(k+1) × (k+1)` matrix**, and since the cost is cubic in the
dimension, the constant is not free — but one extra dimension on a 2×2 is a fine price for turning an
unusable problem into a usable one.

## A polynomial term: one extra row per degree

Take it further — `F(n) = F(n-1) + F(n-2) + a·n + b`. Now the inhomogeneous part depends on `n`, so
`n` itself has to live in the state, alongside the constant that lets `n` increment:

```
v(n) = [ F(n), F(n-1), n, 1 ]
```

The equations, taking care with the index — the new top component is `F(n+1)`, whose inhomogeneous
part is `a·(n+1) + b = a·n + (a + b)`:

```
F(n+1) = 1·F(n) + 1·F(n-1) + a·n + (a+b)·1
F(n)   = 1·F(n) + 0·F(n-1) + 0·n + 0·1
n+1    = 0·F(n) + 0·F(n-1) + 1·n + 1·1
1      = 0·F(n) + 0·F(n-1) + 0·n + 1·1
```

```
      [ 1  1  a  a+b ]
      [ 1  0  0   0  ]
M  =  [ 0  0  1   1  ]
      [ 0  0  0   1  ]
```

**The pattern generalises: a polynomial inhomogeneous term of degree `d` costs `d + 1` extra
dimensions** — you carry `1, n, n², … n^d` in the state, and each one's update row is its binomial
expansion in terms of the lower powers, because `(n+1)^j` expands into powers of `n`. That expansion
is [08](08-combinatorics-for-counting-problems.md)'s binomial theorem doing ordinary work.

## Prefix sums, for free, in the same matrix

A common follow-up is "and also give me `S(n) = F(0) + F(1) + … + F(n)`". Do not compute the terms
and add them; put the running sum in the state:

```
v(n) = [ F(n), F(n-1), S(n) ]
```

`S(n+1) = S(n) + F(n+1) = S(n) + F(n) + F(n-1)`, so:

```
      [ 1  1  0 ]
M  =  [ 1  0  0 ]
      [ 1  1  1 ]
```

The third row is the sum's update written in terms of the *old* state, which is the only place this
gets fiddly: every row must be expressed in old components, never in the new ones you are computing
in the same step. 🔴 **Writing `S(n+1) = S(n) + F(n+1)` directly into the matrix is the error** —
`F(n+1)` is not a component of `v(n)`, so it has to be expanded into `F(n) + F(n-1)` first.

## An exponential term: carry it as its own component

`F(n) = F(n-1) + 2^n` looks worse than the polynomial case and is easier, because `2^n` updates
itself by multiplication:

```
v(n) = [ F(n), 2^n ]

F(n+1) = F(n) + 2^(n+1) = 1·F(n) + 2·2^n
2^(n+1)                 = 0·F(n) + 2·2^n
```

```
      [ 1  2 ]
M  =  [ 0  2 ]
```

**Any term of the form `r^n` for a constant `r` costs exactly one dimension**, with the row `[… r]`
on its own column. The initial vector carries `2^1 = 2` (or `2^0 = 1`, matching whichever index you
started at) and the usual off-by-one applies to it just as much as to `F`.

⚠️ A term like `n · 2^n` needs *both* components — `2^n` and `n · 2^n` — because
`(n+1)·2^(n+1) = 2n·2^n + 2·2^n`, which is a linear combination of the two. The general rule is the
one the polynomial case already showed: **keep adding components until every equation is a linear
combination of components you already have.** That process terminates for polynomials times
exponentials and does not terminate for, say, `F(n) + n!`, which is the honest way to discover the
technique does not apply.

## Mutually recursive sequences: one block matrix

Two sequences defined in terms of each other are one system, not two problems:

```
a(n) = a(n-1) + b(n-1)
b(n) = a(n-1)
```

Take `v(n) = [a(n), b(n)]` and the matrix is `[[1, 1], [1, 0]]` — which is Fibonacci's, because that
system *is* Fibonacci written as two sequences. The point is the method rather than this example:
**stack every sequence's current values into one vector and write one row per equation.** A system of
`m` mutually recursive sequences each needing `k` previous terms gives an `m·k` square matrix, and
the cubic cost in that dimension is the thing to check before committing.

This is also the honest framing of the whole topic: matrix exponentiation is not a Fibonacci trick,
it is *the* general method for iterating a fixed linear system a large number of times, and every
augmentation on this page is an instance of enlarging the system until it is linear and fixed.

## Gotchas

**★ Symptom: an affine recurrence has no matrix.** Cause: a constant term makes the map affine
rather than linear, and affine maps are not matrices in the same dimension. Fix: augment the state
with a component that is permanently `1`, put the constant in the top row's last column, and add a
final row of `[0 … 0 1]` that preserves it. The dimension goes up by one and the cost by roughly
`(k+1)³/k³`.

**Symptom: the polynomial-term matrix is wrong by a constant.** Cause: the inhomogeneous part was
written for `n` rather than for `n+1` — the top row computes `F(n+1)`, whose term is `a(n+1) + b`,
not `a·n + b`. Fix: expand it as `a·n + (a+b)` and put `a` in the `n` column and `a+b` in the
constant column.

**★ Symptom: the prefix-sum row was written in terms of the value it is computing.** Cause:
`S(n+1) = S(n) + F(n+1)` is the correct recurrence and the wrong matrix row, because `F(n+1)` is not
a component of `v(n)`. Fix: expand it into old components — `S(n+1) = S(n) + F(n) + F(n-1)` — giving
the row `[1, 1, 1]`. Every row must be a linear combination of `v(n)`'s components and nothing else.

**★ Symptom: the augmented matrix works for the term but the prefix sum is off by `F(0)`.** Cause:
the sum's starting value in `v(1)` did not match the definition — `S(1) = F(0) + F(1)` if the sum is
inclusive from zero, `S(1) = F(1)` if not. Fix: write the initial vector down explicitly with every
component's value justified, and check `n = 1` and `n = 2` by hand. The matrix is almost never the
bug; the initial vector usually is.

**Symptom: the degree-`d` polynomial augmentation produces wrong coefficients above degree 1.**
Cause: the update row for `n^j` was written as `n^j → n^j + 1` rather than as the binomial expansion
of `(n+1)^j = Σ C(j, i)·n^i`. Fix: expand properly — the row for `n²`, for instance, is
`n² + 2n + 1`, so it reads `[… 1 2 1]` across the `n²`, `n` and constant columns
([08](08-combinatorics-for-counting-problems.md)).

**★ Symptom: the augmentation never closes — every new component needs another one.** Cause: the
inhomogeneous term is not a polynomial-times-exponential, so the sequence of derived components does
not terminate. `F(n) = F(n-1) + n!` is the clean example: `(n+1)!` is `(n+1) · n!`, whose coefficient
depends on `n`, so it is not a fixed linear map. Fix: stop and say so. Discovering that the closure
does not terminate *is* the proof that the technique does not apply, and it is a better answer than
an approximation that quietly loses the constraint.

## Interview questions

**★ The recurrence has a `+ 7` in it. Now what?**
Then the map is affine, not linear, and affine maps have no matrix in that dimension. Augment the
state with a component pinned at `1`: `v(n) = [F(n), F(n-1), 1]`. The constant goes in the top row's
last column, and a final row of `[0, 0, 1]` keeps the pinned component at `1` forever. The matrix
becomes `(k+1) × (k+1)`. The same idea scales: an inhomogeneous term that is a polynomial of degree
`d` in `n` needs `d + 1` extra components carrying `1, n, n², …`, each updated from the lower powers
by the binomial expansion of `(n+1)^j`.

**★ How would you also return the sum of the first n terms?**
Put the running sum in the state rather than computing terms and adding them. With
`v(n) = [F(n), F(n-1), S(n)]`, the sum's update is `S(n+1) = S(n) + F(n+1)`, which must be rewritten
in old components as `S(n) + F(n) + F(n-1)` — giving the row `[1, 1, 1]`. The matrix becomes 3×3 and
the whole computation is still one power. The general version of the move is the thing to say: any
quantity the answer needs, which is itself a linear function of the state, can ride along as an extra
component for one extra dimension.

**★ What does an inhomogeneous term cost you?**
One dimension per independent quantity you have to carry, and the cost of a matrix power is cubic in
the dimension — so going from 2×2 to 3×3 multiplies the per-multiplication work by `27/8`. That is
almost always worth paying, because the alternative is `Θ(n)` for an `n` that is the reason you
reached for this technique in the first place. The one to watch is a high-degree polynomial term: a
degree-`d` term costs `d + 1` extra dimensions, so a degree-5 term on a 2-term recurrence gives an
8×8 matrix, and `8³ = 512` per multiply starts to be a real number rather than a rounding error.

**Two sequences are defined in terms of each other. Do you need two matrices?**
No — one. Stack both sequences' current values into a single state vector and write one matrix row
per defining equation; the result is a single linear system that you raise to a power once. A system
of `m` sequences each depending on `k` previous terms gives an `m·k` square matrix, and since the
multiplication is cubic in that dimension, the number to check before committing is `(m·k)³ · log n`.
It is also the framing that makes the whole topic make sense: this is not a Fibonacci trick, it is
the general way to apply a fixed linear system a very large number of times.

{/* FOOTER */}
