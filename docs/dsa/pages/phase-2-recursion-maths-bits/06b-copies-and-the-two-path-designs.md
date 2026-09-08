---
title: "A backtracking search has one interesting memory decision — mutate the shared path and restore it, or allocate a fresh path per branch — and the first design buys the silent bug where every stored answer is the same object, empty by the time the search returns"
sidebar_label: "06b · Copies and the two path designs"
sidebar_position: 6.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The two path designs and their costs are **common practice, derived on
> this page, not cited**. Reference-versus-copy semantics in JavaScript and Java are stated as
> language mechanism — no benchmark, no figure, no measured allocation. Java targets **JDK 25**;
> TypeScript first, Java second. Part of the skeleton topic —
> [06](06-the-backtracking-skeleton.md) is the shape and the un-choose,
> [06c](06c-the-cost-of-the-search-tree.md) is what it all costs. **No sandbox run.**

**Mutate-and-undo is the default design, costs Θ(1) per edge of the search tree, and buys you the
single most common silent bug in this topic: a leaf stored by reference into a collection whose
contents are then wiped by the very un-choose that makes the search correct.** Allocate-per-branch
is immune to that class entirely, costs a factor of `depth` over the whole search, and is the
right call in three specific situations you should be able to name. This chunk is those two
designs and the snapshot at the leaf that the first one requires — including the two follow-ons
that catch people who already know the rule.

## The two designs

[06](06-the-backtracking-skeleton.md) showed the mutating skeleton. Here is the other one, which
never mutates and therefore has no un-choose at all:

```ts
// Allocation per branch — nothing is shared, so nothing needs restoring.
function subsetsImmutable(nums: number[]): number[][] {
  const out: number[][] = [];
  const go = (start: number, path: readonly number[]): void => {
    out.push([...path]);                 // still a copy — but only because `out` outlives `go`
    for (let i = start; i < nums.length; i++) {
      go(i + 1, [...path, nums[i]]);     // a new array per EDGE of the tree
    }
  };
  go(0, []);
  return out;
}
```

```java
// Java equivalent — a fresh ArrayList per edge, no undo step anywhere.
void go(int[] nums, int start, List<Integer> path, List<List<Integer>> out) {
    out.add(path);                                  // safe: `path` is never mutated after this
    for (int i = start; i < nums.length; i++) {
        List<Integer> next = new ArrayList<>(path);
        next.add(nums[i]);
        go(nums, i + 1, next, out);
    }
}
```

The trade-off, exactly:

| | Mutate + undo | Allocate per branch |
|---|---|---|
| Cost per **edge** of the search tree | Θ(1) — one push, one pop | Θ(depth) — the path is copied |
| Extra cost over the whole search | Θ(nodes) | Θ(nodes × depth) |
| Live auxiliary memory | one path, Θ(depth) | one path per live frame, Θ(depth²) |
| Snapshot at the leaf | **required** | not required — each path is already private |
| Failure mode | a missing or inexact undo | none of that class |
| Safe to hand the path to something outliving the call | no | yes |
| Safe to explore two branches concurrently | no | yes |

Mutate-and-undo is what an interviewer expects, because a factor of `depth` on a search that is
already exponential is a real cost, not a stylistic one. Allocate-per-branch earns it in three
situations: **the path outlives the call** (it is stored in a memo, captured in a closure, or
handed to a promise), **branches run concurrently** so two of them are live against the same
object, or **the state is a persistent structure** where extending it shares its representation
and the "copy" is not a real copy. Choosing it because the undo is fiddly is a defensible
engineering call in production code and a weak answer in a round — name which of the three applies,
or say you are trading Θ(depth) for safety on purpose.

There is a third design worth knowing exists, because it turns up in library code and looks wrong
at first glance: **emit through a callback and never build `out` at all.**

```ts
// Streaming: the consumer decides whether to snapshot. No output collection, Θ(depth) memory total.
function subsetsStreaming(nums: number[], emit: (path: readonly number[]) => void): void {
  const path: number[] = [];
  const go = (start: number): void => {
    emit(path);                                   // ⚠️ contract: valid ONLY during this call
    for (let i = start; i < nums.length; i++) {
      path.push(nums[i]);
      go(i + 1);
      path.pop();
    }
  };
  go(0);
}
```

That shape is correct and is how you enumerate something too large to materialise — but it moves
the snapshot obligation to the caller, and that obligation must be *documented*, because a caller
who writes `subsetsStreaming(nums, p => results.push(p))` reproduces the empty-arrays bug exactly.
Either document "the argument is only valid for the duration of the call" or hand the callback a
copy and pay for it.

## 🔴 The leaf must be copied out, and both languages fail the same way

```ts
out.push(path);         // 🔴 pushes a REFERENCE to the one shared array
out.push([...path]);    // ✅ a snapshot
out.push(path.slice()); // ✅ same thing
```

```java
out.add(path);                     // 🔴 adds a REFERENCE to the one shared List
out.add(new ArrayList<>(path));    // ✅ a snapshot
out.add(List.copyOf(path));        // ✅ snapshot, and immutable
```

The mechanism: an array in JavaScript and a `List` in Java are objects, and pushing one stores the
object, not its contents. In the mutate-and-undo skeleton there is only ever **one** path object,
so `out` ends up holding N references to that same object — and because every choose is eventually
undone, the object is *empty* by the time the top-level call returns. The result is not subtly
wrong. It is a collection of identical empty collections, with the **correct length**. That
correct length is precisely what lets it survive a glance, a `.length` assertion, and a "looks
like it found 8 answers" in review.

Two follow-ons that catch people who already know the rule.

**A shallow copy is only enough if the elements are immutable.** `[...path]` copies the array, not
the objects inside it. If the path holds mutable records — a `{ row, col }` per queen, a cart line
whose quantity is decremented on the way down — the snapshot's elements are still the live
objects, and the un-choose reaches them through the snapshot. The robust habit: **put only
primitives in the path** and rebuild objects at the leaf.

```ts
// 🔴 the snapshot is shallow; the Move objects are still shared with the live path
type Move = { row: number; col: number };
out.push([...path]);                                  // elements alias

// ✅ rebuild at the leaf — or carry primitives and reconstruct there
out.push(path.map(m => ({ row: m.row, col: m.col })));
```

**Java strings are the exception that hides the rule.** `new String(charArray)`, `sb.toString()`
and `String.join(...)` all produce a value that cannot be mutated afterwards, so a board rendered
to strings at the leaf is automatically safe while the same board stored as `char[]` is not. Code
that works when the answer is `List<String>` and breaks when it is `List<int[]>` is this
asymmetry, not a logic error — and because the string version is the one usually written first,
the bug surfaces only when the return type changes.

```java
// N-Queens leaf: rendering to String copies; adding the char[][] would alias the live board.
List<String> render(char[][] board) {
    List<String> rows = new ArrayList<>(board.length);
    for (char[] row : board) rows.add(new String(row));   // a copy, because String is immutable
    return rows;
}
```

TypeScript has the same asymmetry with a different edge: a path of `string` or `number` is safe to
shallow-copy because those are values; a path of arrays or objects is not. `structuredClone(path)`
deep-copies and is the blunt fix — and if you find you need it, the real answer is usually that the
path should have held primitives.

## What the snapshot rule actually says

Not "always copy". The rule is **copy anything that is still going to change**, and it cuts both
ways:

| Situation | Copy at the leaf? |
|---|---|
| mutate-and-undo, storing into `out` | **yes** — the path is about to be unwound |
| allocate-per-branch, storing into `out` | no — the path is private and never mutated again |
| streaming through a callback | the *caller* decides; document the lifetime |
| the leaf renders to a `String` / joins to a value | already a copy; a second one is waste |
| the leaf stores an index into a shared board | 🔴 yes, and deeply — the board is mutated |

Applying "always copy" to the allocate-per-branch version is a small, common review error: there
each path is already private, so the copy is pure waste and doubles the design's already-higher
allocation cost.

## Gotchas

**★ Symptom: the answer is a list of N identical empty arrays, and N is correct.** Cause:
`out.push(path)` / `out.add(path)` stored a reference to the one shared path object, and every
choose is eventually undone, so that object is empty when the top-level call returns. Fix:
snapshot at the leaf — `out.push([...path])` in TypeScript, `out.add(new ArrayList<>(path))` in
Java. **The correct count with empty contents is the signature of this bug specifically**; no other
bug in this topic produces it.

**★ Symptom: it works when the answer type is `List<String>` and breaks when it is
`List<int[]>`.** Cause: `new String(row)`, `sb.toString()` and `String.join` produce immutable
copies, so the aliasing bug is invisible whenever the leaf renders to strings, while an `int[]`,
`char[]` or mutable record is stored live. Fix: snapshot at the leaf unconditionally, and never
let string immutability be the thing that makes the code correct.

**★ Symptom: a snapshot was taken at the leaf and the answers still mutate.** Cause: the snapshot
is shallow — `[...path]` copies the array but not the objects in it, so a path of mutable records
still aliases them. Fix: carry primitives in the path and rebuild objects at the leaf; if objects
genuinely must be carried, deep-copy (`structuredClone` in TypeScript, an explicit copy
constructor in Java).

**★ Symptom: the path reads as garbage inside a memo, a closure or an async continuation.** Cause:
the mutate-and-undo skeleton guarantees the path object is valid only for the duration of the
call, so anything reading it later sees whatever the search is doing at that moment. Fix: snapshot
before storing, or switch that part of the design to allocate-per-branch — this is exactly the
situation that design exists for.

**Symptom: `out.add(path)` flagged in review as the reference bug, in the allocate-per-branch
version.** Cause: the rule "always copy at the leaf" applied without its reason. Fix: there each
path is already private and never mutated again, so storing it is correct and copying it is waste.
The rule is "copy anything that is still going to change".

**Symptom: memory grows unexpectedly in the immutable version.** Cause: Θ(depth) live paths, one
per frame, each up to Θ(depth) long — Θ(depth²) at once, plus every intermediate path retained
until collected. Fix: nothing, if the design was chosen deliberately; that is its stated cost. If
the depth is large, mutate and undo.

**Symptom: a streaming enumerator's consumer collects empty arrays.** Cause: the callback was
handed the live path and the consumer stored the reference. Fix: document the lifetime as part of
the callback's contract, or copy before calling the consumer and accept the per-leaf cost.

**Symptom: `structuredClone` reached for on every leaf and the search crawls.** Cause: a deep copy
used as insurance rather than because the path holds objects. Fix: check what is actually in the
path; if it is numbers and strings, `[...path]` is both correct and the cheap one.

## Interview questions

**★ You push the path into the results and every result is empty. What happened?**
`out.push(path)` stored a reference to the shared path object rather than a snapshot. The search
continued, every choose was eventually undone, and by the time the top-level call returned that
one object was empty — so the results collection has the right length and holds N references to
one empty array. The fix is a snapshot at the leaf: `[...path]` or `path.slice()` in TypeScript,
`new ArrayList<>(path)` or `List.copyOf(path)` in Java. And the snapshot must be deep enough: a
shallow copy of a path holding mutable objects still aliases those objects, which is why the
disciplined version carries only primitives in the path.

**★ When would you copy the path down each branch instead of mutating and undoing?**
When something outlives the call. Three cases: the path is stored in a memo, closure or promise
read after the frame returns; branches are explored concurrently, so two are live against the same
object; or the state is a persistent structure where extending it shares most of its
representation and the copy is not a real copy. Otherwise mutate and undo, because copying costs
Θ(depth) per edge instead of Θ(1), which multiplies the whole search by its depth — on a search
that is already exponential.

**★ Your search returns the right number of answers but the wrong contents. Where do you look
first?**
Two places, in order. First the leaf: is the path snapshotted or stored by reference — the
right-count-empty-contents symptom is diagnostic on its own. Second the loop body: count the
mutations of shared state and count their inverses, because a missing or misplaced un-choose
changes contents while often leaving the shape of the enumeration recognisable. Both are static
checks and neither requires running anything, which matters because these searches are exponential
and stepping through one in a debugger is not a strategy.

**Why does the Java version of this bug sometimes not reproduce?**
Because the leaf frequently renders to `String` — `new String(board[i])`, `sb.toString()`,
`String.join` — and every one of those produces an immutable value, so the reference that gets
stored can never be changed by the ongoing search. The moment the answer type becomes
`List<int[]>`, `List<char[]>` or a list of mutable records, the same code aliases live state. It
is worth saying explicitly in a round: the correctness came from `String`'s immutability, not from
the search, so the code was never right — it was lucky.

**How would you enumerate something too large to hold in memory?**
Stream it: pass a callback and invoke it at each leaf instead of collecting into a list. The search
then uses Θ(depth) memory in total rather than Θ(output). The catch is that the callback receives
the *live* path, so the lifetime contract has to be part of the API — either document that the
argument is valid only for the duration of the call, or snapshot before invoking and pay the
Θ(depth) per leaf. Iterators and generators are the same trade with nicer syntax and the identical
lifetime question.

{/* FOOTER */}
