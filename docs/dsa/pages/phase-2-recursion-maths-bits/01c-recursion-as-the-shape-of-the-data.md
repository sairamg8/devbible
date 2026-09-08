---
title: "For a tree, a grid or a decision sequence the recursion is not a technique but the type definition read aloud — one recursive call per recursive position, one base case per terminal — and the only real decision left is whether the work happens on the way down or on the way back up"
sidebar_label: "01c · Recursion as the shape of the data"
sidebar_position: 1.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. That V8 does not implement ES2015's proper tail calls and that the JVM has
> never eliminated tail calls is widely reported engine behaviour, stated as such and **not** quoted
> from a specification — [phase 1 · 04b](../phase-1-complexity/04b-tail-calls-and-the-explicit-stack.md)
> carries that argument in full and this page states it in one paragraph. 🔴 **No stack-depth
> number** for any engine: MDN documents none. The traversal and flood-fill patterns are common
> practice, written out rather than cited. Third file of topic 01 —
> [01](01-recursion-and-the-call-stack.md) is the frame and the contract,
> [01b](01b-the-three-ways-the-contract-breaks.md) is how the contract breaks, and
> [01d](01d-tail-position-and-mutual-recursion.md) is tail position and mutual recursion.
> **No sandbox run.**

**When people say "recursion is natural for trees" they usually mean it feels nice; the precise
statement is stronger and more useful — the shape of the function is forced by the shape of the
type, so once you can write the type you have already written the control flow.** A binary tree
node is a value plus two nullable nodes, so a function over it has one base case (`null`) and two
recursive calls. A grid cell has four neighbours, so it has four recursive calls and one extra
obligation, because a grid has cycles and cycles have no measure until you mark. This page is that
transcription rule applied to trees, grids and the decision sequence, plus the one genuine design
choice recursion leaves you: whether the work happens before the calls or after them.
[01d](01d-tail-position-and-mutual-recursion.md) takes tail position and functions that recurse into
each other, and [01e](01e-memoising-a-recursive-function.md) takes memoisation, which collapses the
call tree into a table.

## Recursion as the shape of the data

For a tree, the recursion is not a technique; it is the type definition read aloud. A `TreeNode`
*is* a value plus two `TreeNode | null`s, so a function over a `TreeNode` *is* a base case for
`null` plus a combine over two recursive results. The code is a transcription:

```ts
// The type has two recursive positions, so the function has two recursive calls. That is the rule.
export function maxDepth(node: TreeNode | null): number {
  if (node === null) return 0;
  return 1 + Math.max(maxDepth(node.left), maxDepth(node.right));
}

// Same transcription, different combine: the answer for a node from the answers for its children.
export function countLeaves(node: TreeNode | null): number {
  if (node === null) return 0;
  if (node.left === null && node.right === null) return 1;
  return countLeaves(node.left) + countLeaves(node.right);
}
```

```java
// Java: identical shape. The null check is the base case; the combine is the return expression.
record TreeNode(int val, TreeNode left, TreeNode right) {}

static int maxDepth(TreeNode node) {
    if (node == null) return 0;
    return 1 + Math.max(maxDepth(node.left()), maxDepth(node.right()));
}
```

A **grid** is the same idea with four recursive positions instead of two, and one extra
obligation — a grid has cycles, so clause 2 needs a measure, and the measure is "cells not yet
visited". Marking is what supplies it:

```ts
// Flood fill: 4 recursive positions, and the mark is what makes the recursion terminate.
export function floodFill(grid: number[][], r: number, c: number, from: number, to: number): void {
  if (r < 0 || r >= grid.length || c < 0 || c >= grid[0].length) return;  // base: off the grid
  if (grid[r][c] !== from) return;                                        // base: wrong colour, or already done
  grid[r][c] = to;                                                        // THE MEASURE DECREASES HERE
  floodFill(grid, r + 1, c, from, to);
  floodFill(grid, r - 1, c, from, to);
  floodFill(grid, r, c + 1, from, to);
  floodFill(grid, r, c - 1, from, to);
}
```

Note where the mark is: **before** the four calls, never after. Marking after the calls return means
a neighbour re-enters the current cell while it is still `from`, and you get mutual infinite
recursion between two adjacent cells. This is the same rule as phase 1's "mark on enqueue, not on
dequeue" for BFS, and it fails the same way.

Also note the bound this buys and the bound it does not: the recursion is Θ(rows × cols) in *time*
because each cell is repainted once, and Θ(rows × cols) in *depth* in the worst case, because a
snake-shaped region is a single path through every cell. That second one is the overflow, and it
is why grid problems above trivial size get an explicit stack or a BFS queue —
[01f](01f-converting-recursion-to-an-explicit-stack.md) is the conversion.

## Where the work sits: down, up, or both

The transcription rule fixes the calls; what it does not fix is *where you put the work*, and that
is the one real choice. It has a name in each direction, and the names show up in tree questions
constantly.

| Style | Work happens | Passed | Returned | Typical question |
|---|---|---|---|---|
| **top-down** (pre-order, "work on the way down") | before the recursive calls | state accumulated from the root — depth, path, running sum, bounds | often nothing; the answer is written into an accumulator | "is this a valid BST" with `(min, max)` bounds; "print all root-to-leaf paths" |
| **bottom-up** (post-order, "work on the way back") | after the calls return | little or nothing | the answer for this subtree | height, "is this balanced", "diameter", "sum of subtree" |
| **both** | both | root-side context | subtree answer | "longest path through a node", where the node needs its children's answers *and* its own depth |

The choice is decided by one question: **does this node's answer depend on what is above it, or on
what is below it?** Above → pass it down as a parameter. Below → return it up. Both → do both, and
say so, because the interviewer's follow-up ("can you do it in one pass?") is asking whether you
noticed.

```ts
// bottom-up: the answer for a node is computed from the children's answers
export function isBalanced(node: TreeNode | null): boolean {
  return heightOrFail(node) !== -1;
}
function heightOrFail(node: TreeNode | null): number {
  if (node === null) return 0;                       // identity for the max/height combine
  const l = heightOrFail(node.left);
  if (l === -1) return -1;                           // short-circuit: already unbalanced below
  const r = heightOrFail(node.right);
  if (r === -1) return -1;
  if (Math.abs(l - r) > 1) return -1;                // -1 is the "failed" sentinel travelling up
  return 1 + Math.max(l, r);
}

// top-down: the answer for a node depends on the bounds inherited from its ancestors
export function isBST(node: TreeNode | null, lo = -Infinity, hi = Infinity): boolean {
  if (node === null) return true;                    // identity for the && combine
  if (node.val <= lo || node.val >= hi) return false;
  return isBST(node.left, lo, node.val) && isBST(node.right, node.val, hi);
}
```

```java
// Java, bottom-up: the sentinel is an int, so -1 doubles as "unbalanced" because a height is never negative
static boolean isBalanced(TreeNode node) { return heightOrFail(node) != -1; }

static int heightOrFail(TreeNode node) {
    if (node == null) return 0;
    int l = heightOrFail(node.left());
    if (l == -1) return -1;
    int r = heightOrFail(node.right());
    if (r == -1) return -1;
    if (Math.abs(l - r) > 1) return -1;
    return 1 + Math.max(l, r);
}
```

The `-1` sentinel is worth defending out loud, because it is the pattern that turns a two-pass
Θ(n log n) "compute the height at every node" solution into a one-pass Θ(n) one: the recursion
returns *either* the height or a flag, and the flag propagates without unwinding the whole tree by
hand. In Java the sentinel is safe because a height is never negative; in TypeScript, prefer a
sentinel that cannot collide with a legal answer, or return a small object, and say which you chose.

## The decision sequence

The third recursive shape is not a data structure at all — it is a sequence of choices, and it is
the one every subset, permutation and combination problem is. The "type" being transcribed is
"a solution is a choice for position `i`, followed by a solution for the rest":

```ts
// one recursive call per option at this position; the base case is "no positions left"
export function subsets(nums: number[]): number[][] {
  const out: number[][] = [];
  const path: number[] = [];
  const go = (i: number): void => {
    if (i === nums.length) { out.push([...path]); return; }  // base: a complete decision sequence
    go(i + 1);                                               // choice: exclude nums[i]
    path.push(nums[i]);
    go(i + 1);                                               // choice: include nums[i]
    path.pop();                                              // undo — the recursion shares one array
  };
  go(0);
  return out;
}
```

The `push` / `go` / `pop` triple is the whole of what makes this a *backtracking* recursion rather
than a plain one: the path is shared mutable state, and the undo restores the invariant that the
function found on entry. The depth is the number of positions, so it is bounded by the input length
rather than by the exponential number of outputs — which is why this recursion is Θ(n) on the stack
while producing 2ⁿ results. The full skeleton, the pruning and the pitfalls belong to **06 · The
backtracking skeleton** *(not written yet)*; what belongs here is that the recursion's *shape* came
from the same transcription rule, with "one call per option" in place of "one call per child".

## Gotchas

**★ Symptom: flood fill or grid DFS recurses forever between two adjacent cells.** Cause: the cell
is marked *after* the recursive calls rather than before, so a neighbour re-enters it while it
still matches the source colour. Fix: the mark goes on the line immediately before the calls. It is
the same rule as marking on enqueue rather than dequeue in BFS, and it fails the same way.

**★ Symptom: a grid recursion that is correct at the sample size and dies on the real grid.**
Cause: the depth is the number of cells in the connected region, and a snake-shaped region is a
single path through all of them — so a large grid is a large depth by construction. Fix: BFS with
an explicit queue, or DFS with an explicit stack; both are the same Θ(rows × cols) bound moved from
the call stack to the heap.
[01f](01f-converting-recursion-to-an-explicit-stack.md) is the conversion.

**★ Symptom: a "validate BST" that compares each node only to its immediate children and passes an
invalid tree.** Cause: the property is a top-down one — a node must lie inside bounds inherited
from *every* ancestor, not just its parent — written bottom-up. Fix: pass `(lo, hi)` down and
narrow them at each step; a local parent-child comparison cannot see the ancestor that a value
violates.

**★ Symptom: an `isBalanced` that recomputes the height at every node and is Θ(n log n) or worse.**
Cause: two recursions where one would do — height computed inside the balance check. Fix: one
bottom-up recursion returning either the height or a sentinel; the sentinel propagates the failure
up without a second traversal.

**★ Symptom: a subsets or permutations recursion that returns n copies of the same array.** Cause:
the shared `path` array pushed into the output by reference, so every entry aliases the one array
that the recursion keeps mutating. Fix: push a copy — `[...path]` in TypeScript,
`new ArrayList<>(path)` in Java — at the base case.

**Symptom: a per-call `arr.slice(1)` recursion that is quadratic in time and space.** Cause: the
"smaller input" made by copying rather than by moving an index. Fix: pass an index; the subproblem
is `(arr, i + 1)`, not a new array. The recursion is identical and the copy disappears.

**Symptom: an accumulator threaded through a recursion as a default parameter, and a second call to
the function sees the first call's data.** Cause: a mutable default (`seen = new Set()` is fine per
call in JavaScript, but a module-level `const seen` hoisted out of the function is not; in Java, a
`static` collection field is the same bug). Fix: allocate the accumulator in a wrapper and pass it
in, or reset it explicitly; never let recursion state outlive one top-level call.

**Symptom: a four-direction grid recursion that visits diagonals, or misses them, and the problem
wanted the other one.** Cause: connectivity unstated. Fix: ask, or say which you assumed — 4-way
versus 8-way changes the answer for "number of islands" and is a one-line difference in the
direction array.

## Interview questions

**★ Why is recursion the natural shape for a tree?**
Because the type is recursive and the function transcribes the type. A node is a value plus two
things of the same type, possibly absent, so a function over a node is: a base case for the absent
one, returning the identity for whatever you are combining, plus two recursive calls and a combine
expression. There is no design work left after that — the number of recursive calls is the number
of recursive positions in the type, and the number of base cases is the number of terminals. That
is also why the same code shape reappears for a grid (four recursive positions) and a decision
sequence (one call per option): it is the same rule with a different branching factor.

**★ When do you pass state down as a parameter and when do you return it up?**
Down when the node's answer depends on its ancestors, up when it depends on its descendants. "Is
this a valid BST" needs the interval inherited from every ancestor, so the bounds go down as
parameters. "What is the height" or "is this balanced" needs the children's answers, so they come
up as return values. "Longest path through some node" needs both, which is why it is written as a
bottom-up recursion returning the downward-path length while updating an outer variable with the
through-node answer. Naming which one you are doing, before you write it, is what prevents the
classic wrong answer of comparing each node only to its parent.

**★ Why does the flood fill mark the cell before recursing rather than after?**
Because the mark *is* the termination measure. Without it, a grid recursion has no decreasing
quantity at all — cell A recurses into neighbour B, B recurses back into A, and nothing has
changed. Marking before the calls makes "number of unmarked cells matching the source colour"
strictly decrease on every call that does not immediately return, which is the termination proof.
Marking after the calls means the neighbour sees the current cell unmarked and re-enters it, which
is unbounded mutual recursion between two adjacent cells.

**★ How deep does a recursion over a grid go, and why is that different from a tree?**
Up to the number of cells in the connected region, because a region shaped like a snake is a single
path visiting every cell, and the recursion follows that path before it can backtrack. A balanced
tree caps the depth at its height, which is logarithmic in the node count; a grid gives you no such
cap, and neither does a skewed tree or a path graph. That is the whole reason grid problems get
written iteratively at realistic sizes while tree problems usually do not: the same Θ(n) space
bound sits on the call stack in one case and is genuinely reachable in the other.

**When is recursion the wrong shape even though it is correct?**
When the depth is proportional to the input size and the input is large: a linked list, a path
graph, a string processed one character per call, a grid flooded cell by cell. All are correct
recursions with a valid contract, and all overflow at the constraint sizes those problems carry.
The tell in the problem statement is a bound like 10⁵ on something linear. It is also the wrong
shape when there is no combine step at all — if the function does its work and then tail-calls,
the loop is shorter, faster and Θ(1) space, and the recursion is a stylistic choice you are paying
frames for.

**Why does a subsets recursion use Θ(n) stack space while producing 2ⁿ results?**
Because the depth is the number of decisions, not the number of outcomes. At any instant the live
frames are one root-to-leaf path through the decision tree — one frame per position in the input —
and the 2ⁿ leaves are visited one after another, not simultaneously. That is the same distinction
as naive Fibonacci: total calls is time, simultaneously live calls is space. The honest bound is
"Θ(n) auxiliary for the recursion and the path, beyond an output of 2ⁿ subsets."

{/* FOOTER */}
