---
title: "N-Queens is the canonical pruning example because the naive formulation is n^n, one row per level makes it n!, and three O(1) conflict sets make it finish — plus the symmetry argument that halves the work and the reason nobody can tell you how many nodes it really visits"
sidebar_label: "06j · N-Queens and symmetry"
sidebar_position: 6.9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The formulation, the diagonal keys, the symmetry argument and the
> complexity discussion are **mathematics and common practice, derived on this page, not cited to a
> source**. No node count and no solution count is quoted for any specific `n`: the pruned node
> count has no simple closed form and quoting one would be inventing a figure. Java targets
> **JDK 25**; TypeScript first, Java second. The pruning classes are
> [06h](06h-feasibility-pruning.md) and [06i](06i-bound-pruning-and-ordering.md); the wider
> catalogue is [Part 6 of the syllabus](../../syllabus/06-backtracking-greedy-and-dp.md).
> **No sandbox run; no timings.**

**N-Queens earns its place as the standard example because the three successive framings of it are
a complete lesson in pruning, and each one is a sentence.** Place a queen anywhere on the board at
each step: n² choices per level, n levels, unusable. Notice that every solution has exactly one
queen per row, and the tree becomes one level per row with n choices each — n^n, still unusable.
Refuse a column already occupied and the tree is n! — the same shape as permutations, which is what
N-Queens *is* once you see it. Then prune the two diagonals with O(1) set tests, and it finishes.
Nothing about the worst-case bound changed after the second step; everything about the running time
did.

## The reformulation that does most of the work

**Every solution has exactly one queen per row.** That is not a heuristic — it is forced, since n
queens on n rows with no two sharing a row means one each. So the search's levels are the rows, and
the choice at each level is the column. The path is then a column-per-row array, and a solution is
a **permutation of the columns** that additionally avoids the diagonals.

Recognising N-Queens as a constrained permutation is the single most useful thing to say about it in
a round: the skeleton is [06e](06e-permutations-and-the-used-array.md)'s, `used` is the column set,
and the diagonals are two extra feasibility tests.

## The two diagonal keys

Two squares share a **↘ diagonal** exactly when `row − col` is equal, and share a **↙ anti-diagonal**
exactly when `row + col` is equal. Both are one subtraction or addition, so both tests are O(1)
against a set.

`row + col` ranges over `0 … 2n−2`, so it indexes an array of size `2n−1` directly. `row − col`
ranges over `−(n−1) … n−1`, so it needs the offset `row − col + n − 1` to become an array index —
which is the one place this code is routinely written with an out-of-bounds bug.

## The search

```ts
export function solveNQueens(n: number): string[][] {
  const out: string[][] = [];
  const cols = new Array<boolean>(n).fill(false);
  const diag = new Array<boolean>(2 * n - 1).fill(false);      // key: r - c + n - 1
  const anti = new Array<boolean>(2 * n - 1).fill(false);      // key: r + c
  const queenCol = new Array<number>(n).fill(-1);              // the path: column per row

  const render = (): string[] =>
    queenCol.map(c => '.'.repeat(c) + 'Q' + '.'.repeat(n - c - 1));   // snapshot as strings

  const place = (r: number): void => {
    if (r === n) { out.push(render()); return; }
    for (let c = 0; c < n; c++) {
      const d = r - c + n - 1, a = r + c;
      if (cols[c] || diag[d] || anti[a]) continue;             // 🔴 O(1) feasibility test
      cols[c] = diag[d] = anti[a] = true;  queenCol[r] = c;    // choose
      place(r + 1);                                            // explore
      cols[c] = diag[d] = anti[a] = false;                     // un-choose — all three
    }
  };

  place(0);
  return out;
}
```

```java
public List<List<String>> solveNQueens(int n) {
    List<List<String>> out = new ArrayList<>();
    boolean[] cols = new boolean[n];
    boolean[] diag = new boolean[2 * n - 1];       // r - c + n - 1
    boolean[] anti = new boolean[2 * n - 1];       // r + c
    int[] queenCol = new int[n];
    place(0, n, cols, diag, anti, queenCol, out);
    return out;
}

private void place(int r, int n, boolean[] cols, boolean[] diag, boolean[] anti,
                   int[] queenCol, List<List<String>> out) {
    if (r == n) { out.add(render(queenCol, n)); return; }
    for (int c = 0; c < n; c++) {
        int d = r - c + n - 1, a = r + c;
        if (cols[c] || diag[d] || anti[a]) continue;
        cols[c] = diag[d] = anti[a] = true;  queenCol[r] = c;
        place(r + 1, n, cols, diag, anti, queenCol, out);
        cols[c] = diag[d] = anti[a] = false;
    }
}

private List<String> render(int[] queenCol, int n) {
    List<String> rows = new ArrayList<>(n);
    for (int r = 0; r < n; r++) {
        char[] row = new char[n];
        Arrays.fill(row, '.');
        row[queenCol[r]] = 'Q';
        rows.add(new String(row));                 // 🔴 new String copies — the board keeps changing
    }
    return rows;
}
```

Details worth saying while writing it:

**`queenCol[r] = c` needs no un-choose.** It is overwritten by the next candidate at this row and is
never read for rows at or beyond `r`, because `render` only runs when `r === n` and every row below
has been assigned on the way down. This is a genuine exception to "undo every mutation", and it is
worth stating *why* it is one rather than leaving it looking like an oversight.

**Three marks in, three marks out.** The un-choose has to clear all three arrays. Clearing two of
them is a bug whose symptom is missing solutions in later branches, which
[06h](06h-feasibility-pruning.md) identifies as the "first branch right, later ones wrong" signature.

**The snapshot is `new String(row)`.** Adding the `char[]` would alias a buffer that keeps changing —
the trap [06b](06b-copies-and-the-two-path-designs.md) calls the exception that hides the rule.

## Bitmasks instead of arrays

The same three sets fit in three integers, one bit per column or diagonal, which makes the choose
and un-choose single instructions:

```ts
// Classic bitmask form. `n <= 31` in JavaScript — see the note below.
export function countNQueens(n: number): number {
  const full = (1 << n) - 1;
  let count = 0;
  const place = (cols: number, diag: number, anti: number): void => {
    if (cols === full) { count++; return; }
    let free = full & ~(cols | diag | anti);       // bits that are still legal in this row
    while (free !== 0) {
      const bit = free & -free;                     // lowest set bit — one candidate column
      free -= bit;
      place(cols | bit, (diag | bit) << 1 & full, (anti | bit) >> 1);
    }
  };
  place(0, 0, 0);
  return count;
}
```

The shifts are the diagonals moving with the row: a threatened ↘ diagonal shifts one column left as
you descend, a ↙ diagonal one column right. The choose and un-choose vanish entirely because the
sets are passed as parameters — per-frame state, self-restoring, which is
[06](06-the-backtracking-skeleton.md)'s "a parameter needs no undo" taken to its conclusion.

🔴 **The JavaScript ceiling is real.** MDN documents that bitwise operators convert their operands
to 32-bit integers — *"Numbers with more than 32 bits get their most significant bits discarded"* —
and that the result is signed two's complement, so this form is limited to boards small enough to
fit that, and `1 << 31` is negative. Java's `int` has the same limit and its `long` doubles it. That
is the bit-manipulation topic's territory: [Bit manipulation](04-bit-manipulation.md).

## Symmetry: the argument that halves the work

The set of solutions is closed under reflecting the board left-to-right, which maps a solution with
first-row column `c` to one with first-row column `n − 1 − c`. That reflection is an involution and
it has no fixed points unless `c = n − 1 − c`, which happens only for odd `n` at the middle column.

So, for **counting**:

- enumerate only first-row columns `c < ⌊n/2⌋` and double the count;
- for odd `n`, add the solutions with `c = (n−1)/2`, counted once.

That is a factor of two, exactly, and it is worth knowing for three reasons: it is the standard
follow-up after the basic solution; it demonstrates that you can reason about the *structure* of the
solution set rather than just the search; and it is a clean example of a transformation that is
sound for counting and needs care for enumeration — if the caller wants the boards, you must emit
the mirror of each solution too, not just double a number.

The board has more symmetry than this (rotations as well as reflections, eight in total), and
exploiting all of it is fiddlier because the orbits are not all the same size — some solutions are
fixed by a rotation. The left-right halving is the one to know; the full eight-fold reduction is
worth naming as existing and not attempting on a whiteboard.

## What you can and cannot say about the cost

**Can say.** Without the column constraint, n^n. With one queen per row and distinct columns, n! —
the same bound as permutations. Auxiliary space Θ(n): the path, three sets of size O(n), and n
stack frames. Each feasibility test is O(1) because the state is incremental, so the work per node
is O(n) for the candidate loop.

**Cannot say.** How many nodes the pruned search actually visits, for any given n. There is no
simple closed form; it is far below n! and nobody derives it on a whiteboard. Quoting a number here
is inventing one. The correct answer is "O(n!) worst case, far less in practice, and the pruned count
has no closed form" — which is [06c](06c-the-cost-of-the-search-tree.md)'s standard sentence for
every pruned search.

The same applies to the *solution* count. It grows fast and irregularly, has no closed form, and is
tabulated rather than computed by formula. If an interviewer wants the count for a specific n, they
want the program, not a recollection.

## Gotchas

**★ Symptom: `diag[r - c]` throws or silently reads the wrong slot.** Cause: `r − c` ranges over
`−(n−1) … n−1` and is used as an array index without the offset. Fix: `r - c + n - 1`, giving an
array of size `2n − 1`. In JavaScript a negative index does not throw — it becomes a property on the
array object that is never read again, so the diagonal test silently never fires and the search
returns invalid boards. In Java it throws immediately, which is the friendlier of the two failures.

**★ Symptom: solutions are missing, and the first ones found are correct.** Cause: the un-choose
clears only some of `cols`, `diag`, `anti`. Fix: all three marks in, all three out. This is the
canonical instance of the "first branch right, later branches wrong" signature — the prune is
correct and its bookkeeping is not.

**★ Symptom: every returned board is identical, or shows the last solution found.** Cause: the
`char[][]` board added to the results instead of rendered to strings, so all entries alias the live
buffer. Fix: `new String(row)` per row at the leaf — Java strings are immutable, so this both renders
and snapshots in one step.

**★ Symptom: the bitmask version breaks for larger boards.** Cause: JavaScript's bitwise operators
truncate to 32 signed bits, so `1 << 31` is negative and the mask arithmetic stops meaning what it
should. Fix: keep the bitmask form for boards that fit, use the boolean-array form otherwise, or move
to `long` in Java. MDN states the truncation explicitly and it is not an engine quirk.

**★ Symptom: the symmetry optimisation applied to an enumeration and half the boards are missing.**
Cause: doubling a *count* is sound; enumerating half the first-row columns and doubling does not
produce the other half's boards. Fix: emit the mirror image of each solution as well, and for odd `n`
do not mirror the ones whose first queen is in the middle column — they would be double-counted.

**Symptom: `queenCol[r] = c` flagged in review as a mutation without an inverse.** Cause: the
"undo everything" rule applied without its reason. Fix: it is overwritten by the next candidate at
this row and never read for rows at or beyond `r`, so no sibling can observe a stale value. Say so in
a comment; it is a real exception and looks exactly like the bug otherwise.

**Symptom: the conflict test written as a scan of the placed queens.** Cause: recomputing rather
than maintaining. Fix: three sets updated in the choose and un-choose make the test O(1) instead of
O(r); on a search of this shape that is the difference between the naive and the usable version.

**Symptom: a specific node count or solution count quoted for `n = 8` in an answer.** Cause: a
half-remembered figure. Fix: say the bound (n!), say the pruned count has no closed form, and offer
to write the program. A confident wrong number is worse than an honest "it is tabulated, not
derived".

## Interview questions

**★ Why is N-Queens O(n!) rather than O(n^n), and what does the diagonal check add?**
Because every solution has exactly one queen per row — forced, since n queens on n rows with no two
sharing a row — so the search levels are the rows and the choice at each level is the column. Adding
the constraint that no two queens share a column removes one option per level, turning n^n into
n · (n−1) · (n−2) · … = n!, which is the permutation bound; N-Queens *is* a constrained permutation
search. The diagonal check does not change the worst-case bound at all — it is a feasibility prune
that removes nodes the worst case does not contain, and it is what makes the search finish. The
honest complexity statement is "O(n!) worst case, far less in practice, and the pruned node count
has no simple closed form."

**★ How do you test the diagonals in O(1)?**
Two queens share a ↘ diagonal exactly when `row − col` is equal and a ↙ diagonal exactly when
`row + col` is equal, so each test is one arithmetic operation and one lookup in a set maintained
alongside the path. `row + col` is already in `0 … 2n−2` and indexes an array directly; `row − col`
runs from `−(n−1)` to `n−1`, so it needs `+ n − 1` to become an index — that offset is where the code
is usually wrong, and in JavaScript a negative index fails silently rather than throwing, so the
diagonal test simply never fires and invalid boards are returned.

**★ Where is the copy in your N-Queens solution, and what happens without it?**
At the leaf, rendering the column array into strings — `new String(row)` in Java,
`'.'.repeat(c) + 'Q' + …` in TypeScript. Both produce values that cannot change afterwards. Without
it, adding the live `char[][]` board to the results stores references into a buffer the search keeps
mutating, so every returned board ends up identical and reflects whatever the board looked like when
the search finished. The count is right and the contents are wrong, which is the diagnostic signature
of the aliasing bug generally.

**★ How does symmetry halve the work, and when can you not use it?**
Solutions are closed under left-right reflection, which maps first-row column `c` to `n − 1 − c`, an
involution with a fixed point only for odd `n` at the middle column. So for counting: enumerate only
first-row columns below `n/2`, double, then for odd `n` add the middle-column solutions counted once.
It is exactly a factor of two. It does **not** transfer unchanged to enumeration — doubling a count
is not the same as producing the other half's boards, so you must emit each solution's mirror as
well, and must not mirror the middle-column solutions for odd `n` or they appear twice. The board has
eight symmetries in total, but the orbits are not all the same size because some solutions are fixed
by a rotation, so the full reduction is fiddly and the left-right halving is the one to reach for.

**Why is `queenCol[r] = c` allowed to have no matching un-choose?**
Because nothing can observe a stale value. It is overwritten by the next candidate at row `r`, and
it is only ever *read* when the search reaches `r === n`, at which point every row from 0 to n−1 has
been assigned on the way down. A sibling branch at row `r` sets it before recursing, so it never sees
the previous sibling's value. It is a real exception to the undo rule rather than a bug, and it is
worth a comment for exactly that reason — an unmatched mutation is the shape everyone is trained to
flag.

**What would you change to count solutions instead of listing them?**
Drop the path and the rendering entirely and increment a counter at the leaf, which removes the Θ(n)
snapshot from every solution and the Θ(output) memory. Then switch the three sets to bitmasks passed
as parameters, so the choose and un-choose disappear into the argument list and the "lowest set bit"
trick enumerates the legal columns directly. Then apply the left-right symmetry to halve the search.
None of these change the asymptotic class — they are constant-factor and memory improvements on an
exponential search — and the JavaScript version is capped by the 32-bit truncation of the bitwise
operators, which is a language limit rather than an algorithmic one.

---

← Prev: [06i · Bound pruning and ordering](06i-bound-pruning-and-ordering.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [07 · Binary exponentiation](07-fast-exponentiation-and-the-modular-inverse.md)
