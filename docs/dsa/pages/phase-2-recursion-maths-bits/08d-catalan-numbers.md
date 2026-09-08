---
title: "Catalan numbers are one recurrence wearing five costumes — balanced parentheses, BST shapes, triangulations, valid stack sequences and monotone lattice paths are the same object — and recognising the split-on-the-matching-partner decomposition is what turns a hard counting problem into a four-line DP"
sidebar_label: "08d · Catalan numbers"
sidebar_position: 8.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The recurrence, the reflection argument, the closed form and every
> bijection on this page are **mathematics, derived on this page, not cited to a source**. The
> asymptotic `4ⁿ/(n^{3/2}√π)` is the standard estimate, stated as mathematics; **no value is quoted
> as program output**. Java targets **JDK 25**; TypeScript first, Java second. Builds on
> [08](08-combinatorics-for-counting-problems.md) and
> [08b](08b-pascals-rule-and-the-dp-table.md). **No sandbox run.**

**One decomposition generates the whole family: take the first element, find its partner, and split
the object into what lies inside the pair and what lies after it.** For balanced parentheses that is
the opening bracket and its matching close; for a binary search tree it is the root and its two
subtrees; for a triangulated polygon it is the triangle on a fixed edge. In every case the two parts
are independent smaller instances of the same problem, so the count is a sum of products — and that
sum, `C_{n+1} = Σ_{i=0}^{n} C_i · C_{n−i}`, is the Catalan recurrence. Recognising it is worth more
than the closed form, because the recurrence survives extra constraints and the closed form does
not.

## The recurrence, derived from parentheses

Count the balanced strings of `n` pairs of brackets. Every non-empty balanced string starts with
`(`. That bracket has a unique matching `)`, and everything is determined by where it is:

```
   ( A ) B          A is balanced with i pairs, B is balanced with n−1−i pairs
```

`A` and `B` are independent, and `i` ranges from 0 to `n − 1`. So by the multiplication principle
within a case and the addition principle across cases:

```
C_0 = 1
C_n = Σ_{i=0}^{n−1} C_i · C_{n−1−i}
```

The sequence begins `1, 1, 2, 5, 14, 42, 132, 429, 1430, 4862`. Every derivation below is this same
"split on the partner of the first element" argument with a different vocabulary.

## The five costumes

| Object | The split | Why it is `C_n` |
|---|---|---|
| balanced strings of `n` bracket pairs | the first `(` and its match | `(A)B` with `A`, `B` balanced |
| **shapes** of BSTs on `n` distinct keys | the root | left subtree has `i` keys, right has `n−1−i` |
| triangulations of a convex `(n+2)`-gon | the triangle on a fixed edge | splits the polygon into two smaller ones |
| valid push/pop sequences of `n` items | the pop matching the first push | items pushed inside vs after |
| monotone lattice paths from (0,0) to (n,n) not crossing the diagonal | the first return to the diagonal | the arc below it, and the rest |
| full binary trees with `n + 1` leaves | the root | left and right subtrees |

🔴 **The BST row says *shapes*, and the word matters.** With `n` distinct keys there are `C_n`
distinct tree *shapes*, and because a BST's key placement is forced by its shape, that is also the
number of distinct BSTs. It is **not** the number of binary trees labelled arbitrarily, which is
`n!·C_n` — the shapes times the labellings. Interview questions in this family are almost always
about BSTs and therefore about shapes, and stating which you are counting is half the answer.

The stack row is the one that shows up disguised. "How many orders can `n` items come off a stack
that they were pushed onto in a fixed order" is a Catalan count, and the constraint that makes it
Catalan — you cannot pop from an empty stack — is exactly the constraint that makes a bracket string
balanced. Any problem containing "never goes negative" over a sequence of `+1`s and `−1`s is in this
family.

## The closed form, by reflection

The lattice-path costume gives the formula. A monotone path from `(0,0)` to `(n,n)` is a sequence of
`n` rights and `n` ups, so there are `C(2n, n)` paths in total. A path is *bad* if it ever crosses
the diagonal — equivalently, if some prefix has more ups than rights.

Reflect a bad path in the line one step above the diagonal, from the first point where it crosses.
The reflection maps bad paths bijectively onto **all** monotone paths from `(0,0)` to
`(n−1, n+1)`, of which there are `C(2n, n+1)`. So:

```
C_n = C(2n, n) − C(2n, n+1) = C(2n, n) / (n + 1)
```

Both forms are used. The subtraction form is the one that generalises to the "ballot problem" family
where the two counts are unequal; the division form is the one to compute with, since
`C(2n, n)/(n+1)` is a single multiplicative loop.

The growth is `4ⁿ / (n^{3/2}√π)` asymptotically — dominated by the `4ⁿ`, so a Catalan count outruns a
64-bit integer at a modest `n` and outruns a JavaScript safe integer sooner. That is why these
problems arrive with a modulus attached; the machinery is
[Fast exponentiation and the modular inverse](07-fast-exponentiation-and-the-modular-inverse.md), and note that the `/(n+1)`
becomes a modular inverse there, while the DP below needs no division at all.

## Computing them

```ts
// The recurrence, bottom-up. Θ(n²) time, Θ(n) space, no division anywhere.
export function catalanTable(n: number): number[] {
  const c = new Array<number>(n + 1).fill(0);
  c[0] = 1;
  for (let m = 1; m <= n; m++) {
    let total = 0;
    for (let i = 0; i < m; i++) total += c[i] * c[m - 1 - i];   // (A)B split
    c[m] = total;
  }
  return c;
}
```

```java
// Java: the same table. Prefer this to the closed form when a modulus is involved —
// the recurrence only adds and multiplies, so it never needs an inverse.
public static long[] catalanTable(int n) {
    long[] c = new long[n + 1];
    c[0] = 1L;
    for (int m = 1; m <= n; m++) {
        long total = 0L;
        for (int i = 0; i < m; i++) total += c[i] * c[m - 1 - i];
        c[m] = total;
    }
    return c;
}
```

```ts
// The linear recurrence, derived from the closed form: C_{m} = C_{m-1} * 2(2m-1) / (m+1).
// Θ(n), and exact in integers because each step lands on a Catalan number.
export function catalanLinear(n: number): number[] {
  const c = new Array<number>(n + 1).fill(0);
  c[0] = 1;
  for (let m = 1; m <= n; m++) c[m] = (c[m - 1] * 2 * (2 * m - 1)) / (m + 1);
  return c;
}
```

The Θ(n²) convolution is the one to write when the problem is *nearly* Catalan — a constraint that
changes which splits are legal keeps the recurrence and destroys the closed form, and then the table
is the only thing that still works. That fragility is the general point made in
[08f](08f-closed-form-or-dp.md).

## The one that is not Catalan

Worth knowing the near-miss. "How many binary search trees can be built from `n` distinct keys" is
`C_n`. "How many binary trees with `n` labelled nodes" is `n!·C_n`, because the shape and the
labelling are independent choices. And "how many *distinct-valued* BSTs from a multiset with
repeats" is neither — the repeated keys collapse some shapes together, and there is no clean formula.
Reading which one is being asked is the difference between a correct answer and a confidently wrong
one.

## Gotchas

**★ Symptom: the recurrence written `C_n = Σ C_i · C_{n−i}` and the values come out wrong.** Cause:
the index shift dropped — the split is `(A)B` where `A` and `B` together hold `n − 1` pairs, not `n`,
so it is `C_n = Σ_{i=0}^{n−1} C_i · C_{n−1−i}`. Fix: derive it from the picture rather than
recalling it; the bracket consumed by the pair is the missing 1.

**★ Symptom: `C_0` initialised to 0.** Cause: treating "zero pairs of brackets" as impossible. Fix:
`C_0 = 1` — the empty string is a valid balanced string, the empty tree is a valid shape, and the
whole recurrence is zero without it.

**★ Symptom: the answer is `n!` times too large.** Cause: counting labelled binary trees when the
question asked for BSTs. Fix: a BST's key placement is forced by its shape, so the count is the
number of shapes, `C_n`; multiplying by the labellings is the answer to a different question. State
which one you are counting before you compute.

**★ Symptom: the closed form `C(2n, n)/(n+1)` computed under a modulus with an integer division.**
Cause: division is not a modular operation — under a modulus it must become multiplication by the
inverse of `n + 1`. Fix: either use the convolution DP, which only adds and multiplies, or compute
the inverse properly. This is the single most common way a correct Catalan derivation produces a
wrong submission.

**★ Symptom: a Catalan count overflows unexpectedly early.** Cause: the growth is `4ⁿ` up to a
polynomial factor, so the values pass a 64-bit integer at a modest `n` and JavaScript's safe-integer
range sooner. Fix: `BigInt`/`BigInteger`, or the modulus the problem almost certainly asked for.

**Symptom: the `Θ(n²)` convolution used where a single value was wanted.** Cause: reaching for the
familiar table. Fix: the linear recurrence `C_m = C_{m−1} · 2(2m−1)/(m+1)` gives every value in Θ(n)
total, and the closed form gives one value in Θ(n) with a single multiplicative loop. Keep the
convolution for when the problem adds a constraint.

**Symptom: a "count the valid sequences" problem answered with `C(2n, n)`.** Cause: the
never-goes-negative constraint ignored. Fix: `C(2n, n)` counts all arrangements of `n` opens and `n`
closes; the balanced ones are `C(2n, n) − C(2n, n+1)`. If the problem says a counter must never go
below zero, it is Catalan, not a plain binomial.

**Symptom: the linear recurrence produces a fraction.** Cause: the operations reordered so the
division happens before the multiplication. Fix: multiply first, divide last — each step's result is
a Catalan number, so the division is exact only when performed at the end of the step.

## Interview questions

**★ Derive the Catalan recurrence from balanced parentheses.**
Every non-empty balanced string of `n` pairs begins with `(`, and that bracket has a unique matching
`)`. Whatever sits between them is itself balanced, say with `i` pairs, and whatever follows the
match is balanced with `n − 1 − i` pairs — the two parts are independent, and `i` ranges from 0 to
`n − 1`. Multiplication within a case, addition across cases, gives
`C_n = Σ_{i=0}^{n−1} C_i · C_{n−1−i}` with `C_0 = 1`. The `n − 1` rather than `n` is the pair
consumed by the split, and it is where the index error always is.

**★ Why is the number of BSTs on `n` distinct keys a Catalan number?**
Split on the root. If the root is the `(i+1)`-th smallest key, the `i` smaller keys form the left
subtree and the `n − 1 − i` larger keys form the right, and the two are independent — every shape of
the left combines with every shape of the right. Summing over the choice of root gives exactly the
Catalan recurrence. The subtlety worth stating is that this counts *shapes*: a BST's key placement is
forced by its shape, so shapes and BSTs coincide, which is why the answer is `C_n` and not `n!·C_n` —
the latter counts labelled binary trees, where shape and labelling are chosen independently.

**★ What is the closed form and how would you get it?**
`C_n = C(2n, n)/(n + 1)`, equivalently `C(2n, n) − C(2n, n+1)`. The derivation is the reflection
argument on lattice paths: a monotone path from `(0,0)` to `(n,n)` is `n` rights and `n` ups, so there
are `C(2n, n)` in total; a path is bad if it crosses the diagonal, and reflecting a bad path in the
line one above the diagonal from its first crossing maps the bad paths bijectively onto all paths to
`(n−1, n+1)`, of which there are `C(2n, n+1)`. Subtracting gives the result, and the algebra collapses
to the division form. Under a modulus the division becomes a multiplication by the modular inverse of
`n + 1`, which is why the convolution DP is often the safer implementation.

**★ How do you recognise a Catalan problem that is not phrased in brackets or trees?**
Look for a sequence of `+1` and `−1` steps in which a running total must never go negative, and which
ends at zero. That is the balanced-bracket condition in disguise, and it covers valid push/pop stack
sequences, ballot sequences, mountain ranges, and any "at no point may more of X have happened than
of Y" constraint. The other tell is a decomposition that splits an object into two independent
smaller instances at a distinguished partner — the matching close bracket, the root, a fixed edge of
a polygon. If the split gives a sum of products of the same function, it is Catalan or a close
relative, and the recurrence is the answer whether or not a closed form exists.

**When would you use the DP rather than the closed form?**
Whenever the problem is only *nearly* Catalan. A constraint that forbids certain splits — a bracket
type that cannot nest inside another, a tree depth limit, a stack of bounded capacity — leaves the
convolution recurrence intact and destroys the closed form entirely, because the reflection argument
depended on the paths being unconstrained. The DP is also the better choice under a modulus, since it
only adds and multiplies while the closed form needs a division and therefore an inverse. The closed
form wins when you need one value, `n` is large, and there are no extra constraints.

---

← Prev: [08c · Stars and bars, multisets](08c-stars-and-bars-and-multisets.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [08e · Inclusion–exclusion, derangements](08e-inclusion-exclusion-and-derangements.md)
