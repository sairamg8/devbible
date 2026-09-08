---
title: "The same matrix power counts walks of a given length in a graph, and the same argument turns any automaton into a linear recurrence — while the honest half of the topic is the situations where a plain loop or a topological sweep beats it outright"
sidebar_label: "12d · Walks, and when not to bother"
sidebar_position: 12.3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08. The walk-counting theorem and its induction, the block-matrix construction
> for a sum of powers and the min-plus variant are **mathematics
> derived on this page**, cited to nothing — each can be checked by multiplying the matrices by hand
> against the statement it is claimed to prove. ⚠️ The Kitamasa and polynomial-modulus methods are
> **named and not derived**; I have not verified their details to this page's standard.
> **No sandbox run**: no timing, no allocation figure and no program output appears below.
> Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**A matrix power is not a Fibonacci trick — it is what you get whenever a fixed linear map is applied
many times, and a graph's adjacency matrix is exactly such a map.** That gives the second half of
this topic: counting walks of a given length, counting strings accepted by an automaton, and
shortest paths with a fixed number of edges, all from the same `Θ(k³ log n)` machinery in
[12c](12c-the-multiply-the-power-and-the-modulus.md). And it gives part of the honest half — the
three structural cases where the machinery is the wrong answer. The fourth, "a closed form exists",
is Fibonacci-specific and is [12e](12e-fast-doubling-and-why-not-binet.md).

## Powers of the adjacency matrix count walks

Let `A` be the adjacency matrix of a directed graph: `A[i][j] = 1` when there is an edge `i → j`,
`0` otherwise. Then:

```
(A^L)[i][j] = the number of walks of length exactly L from i to j
```

**Proof by induction on `L`.** For `L = 1`, `A[i][j]` is 1 or 0, which is the number of one-edge
walks. Assume it for `L`. By the definition of matrix multiplication,

```
(A^(L+1))[i][j] = Σ over t of (A^L)[i][t] · A[t][j]
```

Read that sum: it ranges over every possible penultimate vertex `t`, multiplying the number of
`L`-edge walks from `i` to `t` by whether the edge `t → j` exists. Every `(L+1)`-walk from `i` to `j`
has exactly one penultimate vertex, so the sum counts each such walk exactly once. ∎

**"Walk" is the right word and not a synonym for "path".** These counts include repeated vertices
and repeated edges. Counting simple *paths* is a different and much harder problem — it is not
polynomial in general, and it is what [09](09-bitmask-enumeration.md)'s mask DP is for on small
graphs. Saying "walks, not paths" unprompted is the difference between understanding this theorem
and reciting it.

The immediate uses: **how many ways to get from A to B in exactly `n` steps**, over a graph small
enough that `k³` is cheap and an `n` far too large to simulate. With weighted counts — put the number
of parallel edges, or a probability, in `A[i][j]` — the same power answers the weighted question,
which is how a Markov chain's `n`-step transition matrix is computed.

## Walks of length at most L, by a block matrix

If you want `Σ from i=0 to L-1 of A^i` — the count of walks of *any* length below `L` — do not
compute the powers and add them. Build a `2k × 2k` block matrix:

```
      [ A  I ]
B  =  [ 0  I ]
```

Then, and this is worth verifying by hand once:

```
        [ A^L   Σ from i=0 to L-1 of A^i ]
B^L  =  [  0                          I  ]
```

**Induction.** At `L = 1`, `B` itself has `A` in the top left and `I` in the top right, and the sum
`Σ from i=0 to 0` is `I`. ✅ Step: multiplying `B^L` by `B` gives top-left `A^L · A = A^(L+1)`, and
top-right `A^L · I + S_L · I = A^L + S_L`, which is `S_(L+1)`. ∎

The cost is `Θ((2k)³ log L)` — eight times a plain power, which is a real price and still nothing
against iterating `L` times. **The same block trick sums any matrix power series**, and it is the
matrix version of the "carry the running total in the state" augmentation in
[12b](12b-augmenting-the-state.md) — the same idea, one level up.

## The transfer matrix: any automaton is a linear recurrence

This is the use that actually appears. "How many strings of length `n` over this alphabet avoid this
pattern" is a walk count: build the automaton that reads the string and tracks how much of the
forbidden pattern has been matched, drop the rejecting states, and the adjacency matrix of what
remains is the transition. `(A^n)` summed over the accepting states from the start state is the
answer.

The smallest example is one you already know: strings over `{0, 1}` with no two consecutive `1`s.
States are "last character was 0" and "last character was 1":

```
      [ 1  1 ]          from-0 can go to 0 or 1
A  =  [ 1  0 ]          from-1 can only go to 0
```

which is the Fibonacci matrix — so the count is a Fibonacci number, and now you know *why* rather
than having noticed it. **The generalisation is the point: any constraint expressible as a
finite-state machine over a bounded alphabet becomes a matrix power, with `k` equal to the number of
states.** That is where the technique earns its keep, because those `k` values stay small while `n`
is given as `10^18`.

⚠️ `k` is the state count, and the cubic bites fast: an automaton with 60 states costs 216,000
multiply-adds per matrix multiplication, times about `60` multiplications for `n ≈ 10^18`. That is
fine. Two hundred states is `8 × 10^6` per multiply and is starting not to be.

## Min-plus: shortest walks with exactly n edges

Replace `+` with `min` and `×` with `+` throughout the multiplication:

```
C[i][j] = min over t of ( A[i][t] + A[t][j] )
```

with `A[i][j]` the edge weight and `+∞` for absent edges. This is the **min-plus** (tropical)
semiring, and the same induction now says `(A^L)[i][j]` is the **minimum weight of a walk with
exactly `L` edges** from `i` to `j`. Exponentiation by squaring still applies, because min-plus
matrix multiplication is associative for the same reason ordinary multiplication is — the proof only
used associativity and distributivity, both of which hold here.

The identity element changes with the semiring: it is `0` on the diagonal and `+∞` elsewhere, not
`1` and `0`. 🔴 **Getting the identity wrong is the standard bug in the min-plus version**, and it
produces answers that are plausible rather than obviously broken.

This gives "cheapest route using exactly `k` flights" directly, and repeated squaring of a min-plus
matrix is the textbook `Θ(V³ log V)` all-pairs shortest path — slower than Floyd–Warshall's `Θ(V³)`
and worth knowing as the reason Floyd–Warshall is the one you use.

## Where it is not worth it

**1 — `n` is small.** `Θ(k³ log n)` beats `Θ(n·k)` only for large `n`. For `n` up to a few million a
plain loop is simpler, allocates nothing, has no modulus subtleties in the multiply, and is faster to
write correctly under time pressure. The technique is signalled by an `n` you cannot iterate: `10^12`,
`10^18`, or an exponent given as a binary string.

**2 — the graph is a DAG and you want path counts.** Counting paths from a source in a DAG is a
`Θ(V + E)` dynamic program in topological order — `paths[v] = Σ paths[u]` over predecessors. The
matrix version computes something more general (walks of each length, separately) at
`Θ(V³ log L)`, and reaching for it here is a straightforward loss. **Matrix powers are for when the
length is enormous and fixed, not for when the graph is acyclic.**

**3 — `k` is large.** The cubic dominates everything. A recurrence with 200 terms gives a 200×200
matrix at `8 × 10^6` multiply-adds per multiplication; for `n = 10^9` that is thirty multiplications,
which is fine, but it is no longer obviously better than alternatives and the Kitamasa/polynomial-
modulus methods at `Θ(k² log n)` exist. ⚠️ Those are named here and not derived — I have not verified
their details to the standard this page requires.

**4 — a closed form or a specialised identity exists.** For Fibonacci both do, and neither is the
matrix: fast doubling is a smaller constant and Binet is a trap. That is
[12e](12e-fast-doubling-and-why-not-binet.md).

## Gotchas

**★ Symptom: a walk count is much larger than the number of paths in the graph.** Cause: powers of
the adjacency matrix count **walks**, which may repeat vertices and edges. Fix: nothing, if walks
were what you wanted. If you wanted simple paths, this technique does not compute them — that is a
bitmask DP on a small graph ([09f](09f-dp-over-masks-with-a-last-element.md)) or an intractable
problem on a large one.

**★ Symptom: the min-plus version returns zeros everywhere.** Cause: the accumulator was seeded with
the ordinary identity — ones on the diagonal, zeros elsewhere — instead of the min-plus identity,
which is `0` on the diagonal and `+∞` off it. Fix: the identity belongs to the semiring, not to the
code. Whenever the operations change, re-derive the element that leaves a matrix unchanged.

**★ Symptom: a DAG path-count solution using matrix powers times out.** Cause: `Θ(V³ log L)` was
applied to a problem that a topological-order DP solves in `Θ(V + E)`. Fix: use the DP. Matrix powers
earn their cost when the walk length is enormous and fixed, not when the graph happens to be
acyclic.

**★ Symptom: an automaton-based count is wrong by the empty string, or by the initial state.** Cause:
`A^n` counts walks of length exactly `n` starting at the start state, and the accepting condition has
to be applied to the *ending* state — summing the wrong row, or summing over all states rather than
the accepting ones, are both easy and both silent. Fix: write down explicitly which row you index and
which columns you sum, and check `n = 0` and `n = 1` by hand against a brute-force enumeration you
can do on paper.

**Symptom: the block-matrix "sum of powers" gives the sum with one too many or too few terms.**
Cause: `B^L` yields `Σ from i=0 to L-1`, which is `L` terms starting at `A^0 = I` — an off-by-one
against "walks of length at most `L`", which is `L + 1` terms. Fix: state the range explicitly and
check it at `L = 1`, where the sum must be exactly `I`.

**★ Symptom: the min-plus power gives a shorter answer than the true shortest path.** Cause: it was
read as "shortest path" when it computes "shortest walk with *exactly* `L` edges" — a different
quantity, and on a graph with negative edges the two diverge badly. Fix: to allow *at most* `L`
edges, add a zero-weight self-loop at every vertex, which lets a walk stand still and makes "exactly
`L`" equivalent to "at most `L`".

## Interview questions

**★ What does the `L`-th power of an adjacency matrix mean?**
`(A^L)[i][j]` is the number of walks of length exactly `L` from `i` to `j`. The proof is one line of
the multiplication definition: `(A^(L+1))[i][j] = Σ_t (A^L)[i][t]·A[t][j]` sums over the penultimate
vertex, and every walk has exactly one of those. The word to say without being asked is **walks**,
not paths — vertices and edges may repeat, and counting simple paths is a genuinely different and
much harder problem. Weighted entries generalise it directly: put multiplicities or probabilities in
`A` and the same power gives the weighted count or the `n`-step transition matrix of a Markov chain.

**★ Count binary strings of length `n` with no two consecutive ones, for `n = 10^18`.**
Build the two-state automaton — "last character was 0" and "last character was 1" — whose transition
matrix is `[[1, 1], [1, 0]]`, then raise it to the `n` and sum the accepting entries from the start
state. The count is a Fibonacci number, which is not a coincidence but the automaton's characteristic
recurrence. This is the transfer-matrix method, and the general statement is the valuable one: any
constraint expressible as a finite-state machine over a bounded alphabet turns into a matrix power
whose dimension is the number of states, which stays small while `n` does not.

**When would you refuse to use matrix exponentiation at all?**
When `n` is small enough to iterate — a loop up to a few million is simpler, allocation-free and has
no modular-multiply subtleties. When the structure gives a cheaper algorithm, such as counting paths
in a DAG, which is `Θ(V + E)` in topological order against `Θ(V³ log L)` for the matrix. When `k` is
large, because the cubic dominates and there are `Θ(k² log n)` methods for that regime. And when the
map is not fixed and linear at all, which is the precondition the whole technique rests on
([12](12-matrix-exponentiation.md)).

**★ How do you count walks of length at most `L` rather than exactly `L`?**
Two ways, and both are worth knowing. The block matrix `[[A, I], [0, I]]` raised to the `L` carries
`Σ from i=0 to L-1 of A^i` in its top-right block, provable by the same one-step induction — it costs
eight times a plain power because the dimension doubled, which is nothing against iterating. The
cheaper trick, when the semantics allow it, is to add a self-loop at every vertex so that a walk can
stand still; then "exactly `L`" already includes everything shorter. The first is exact and general,
the second changes the graph, so say which you are doing.

---

← Prev: [12c · The multiply and the modulus](12c-the-multiply-the-power-and-the-modulus.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [12e · Fast doubling, and not Binet](12e-fast-doubling-and-why-not-binet.md)
