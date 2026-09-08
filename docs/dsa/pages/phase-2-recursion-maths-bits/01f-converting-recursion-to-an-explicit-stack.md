---
title: "Converting a recursion to a loop is mechanical rather than clever — the runtime's frame becomes an object you push, the children go on in reverse because a stack is LIFO, and any recursion with work after the call needs a resume point in the frame; the bound does not change, only which memory holds it"
sidebar_label: "01f · Converting to an explicit stack"
sidebar_position: 1.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. The JavaScript error strings and their engine mapping are MDN,
> [*too much recursion*](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion),
> verbatim below. 🔴 **The maximum depth is engine- and platform-dependent and no number is
> documented** — MDN gives none, and no figure for Node, V8 or any browser appears here. Java's
> `StackOverflowError` and the `Thread` `stackSize` parameter are quoted in
> [phase 1 · 04](../phase-1-complexity/04-space-and-the-recursion-stack.md) from the JDK 25
> javadocs, and are named here as mechanism only. ⚠️ I could not confirm from a primary source
> whether Node exposes a supported stack-size setting or what it defaults to, so this page does not
> claim one. [Phase 1 · 04b](../phase-1-complexity/04b-tail-calls-and-the-explicit-stack.md) owns
> the bound and the tail-call fact; this page owns writing the conversion for the cases with no
> work after the call, [01g](01g-post-order-and-the-resume-point-frame.md) owns the cases that have
> some, and [01h](01h-choosing-recursion-and-reading-the-overflow.md) owns the choice and the
> per-runtime failure. Sixth file of topic 01. **No sandbox run.**

**The conversion is not a rewrite, it is a transcription: whatever the runtime was keeping in a
frame, you keep in an object; whatever it was keeping on the call stack, you keep in an array; and
the loop pops, does one step, and pushes.** Getting it right is a matter of four mechanical rules
rather than insight, and they are worth being able to apply under pressure because the interviewer
who asks "the input can be 10⁵ deep, now what" is asking for exactly this and nothing else. The
bound is unchanged — Θ(depth) either way — but the depth moves from a stack whose size the engine
chose and neither runtime documents, to the heap, where it is bounded by memory.
[Phase 1 · 04b](../phase-1-complexity/04b-tail-calls-and-the-explicit-stack.md) states the bound and
the tail-call fact; this page is the four rules and the code for every recursion whose recursive
calls are the last thing it does per child — pre-order, sums, flood fill, graph DFS. The two cases
04b names and does not develop, post-order and the general resume-point frame, are
[01g](01g-post-order-and-the-resume-point-frame.md); whether you *should* convert, and what the
failure looks like in each runtime, is
[01h](01h-choosing-recursion-and-reading-the-overflow.md).

## The four rules

1. **A frame becomes an object.** Every parameter and local that the recursion needs *after* a
   recursive call goes into it. Everything that does not — an invariant like the grid, the target,
   the output array — stays outside the loop as a closure variable or a field, because putting it
   in the frame multiplies it by the depth.
2. **A recursive call becomes a push, and the code after it becomes a resume point.** If nothing
   follows the call, there is no resume point and the conversion is the easy one. If something
   does, the frame must record *which* call it is coming back from.
3. **Children go on in reverse.** A stack is last-in-first-out, so pushing `[a, b, c]` in order
   pops `c` first. Push them backwards to preserve the recursion's left-to-right order.
4. **The mark goes on the push, not on the pop.** Whatever the recursion did on entry — mark
   visited, set the colour — must happen when the node is pushed, or a node reachable by two edges
   is pushed twice and the "each node once" bound is lost.

## The easy case: nothing after the call

A pre-order traversal, a sum, any recursion whose recursive calls are the last thing it does per
child. Rule 2 is vacuous, so the frame is just the node.

```ts
type Node = { val: number; children: Node[] };

// recursive: Θ(depth) on the call stack
function sumRecursive(root: Node | null): number {
  if (!root) return 0;
  let s = root.val;
  for (const c of root.children) s += sumRecursive(c);
  return s;
}

// iterative: Θ(depth) on the heap. The accumulator moved OUT of the frame (rule 1).
export function sumIterative(root: Node | null): number {
  if (!root) return 0;
  let s = 0;
  const stack: Node[] = [root];
  while (stack.length) {
    const n = stack.pop()!;
    s += n.val;
    for (let i = n.children.length - 1; i >= 0; i--) stack.push(n.children[i]); // rule 3
  }
  return s;
}
```

The `for (let i = len - 1; i >= 0; i--)` is rule 3 and it is worth saying out loud when you write
it: *"reversed, because the stack pops in the opposite order to the pushes."* For a sum it makes no
difference to the answer; for a pre-order traversal that must emit nodes left to right, it is the
difference between correct and reversed, and an interviewer watching you write `push(left)` then
`push(right)` for a binary tree will wait to see whether you notice that `right` comes off first.

```ts
// binary pre-order: right is pushed FIRST so that left pops first
export function preorder(root: TreeNode | null): number[] {
  const out: number[] = [];
  const stack: (TreeNode | null)[] = [root];
  while (stack.length) {
    const n = stack.pop();
    if (!n) continue;
    out.push(n.val);
    stack.push(n.right);       // pushed first → popped second
    stack.push(n.left);        // pushed second → popped first
  }
  return out;
}
```

```java
// Java: ArrayDeque as the stack. push/pop are amortised constant per its javadoc.
static List<Integer> preorder(TreeNode root) {
    List<Integer> out = new ArrayList<>();
    Deque<TreeNode> stack = new ArrayDeque<>();
    if (root != null) stack.push(root);
    while (!stack.isEmpty()) {
        TreeNode n = stack.pop();
        out.add(n.val());
        if (n.right() != null) stack.push(n.right());   // right first
        if (n.left() != null) stack.push(n.left());     // left second, pops first
    }
    return out;
}
```

⚠️ One Java detail that bites: `ArrayDeque` rejects `null`, so the "push the child even if it is
null and skip it on pop" trick from the TypeScript version does not compile-and-run — the null
check has to be at the push. `LinkedList` accepts nulls and is the wrong tool for other reasons;
check at the push.

## Grids, and the case where the queue is better

Flood fill converts the same way, with rule 4 doing real work: the cell is marked when it is
*pushed*, not when it is popped, or a cell reachable from two neighbours enters the stack twice.

```ts
// iterative flood fill — Θ(rows × cols) on the heap, no call stack at all
export function floodFillIterative(grid: number[][], r0: number, c0: number, to: number): void {
  const from = grid[r0][c0];
  if (from === to) return;                             // otherwise the mark never changes anything
  const stack: Array<[number, number]> = [[r0, c0]];
  grid[r0][c0] = to;                                   // rule 4: mark on push
  const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (stack.length) {
    const [r, c] = stack.pop()!;
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= grid.length || nc < 0 || nc >= grid[0].length) continue;
      if (grid[nr][nc] !== from) continue;
      grid[nr][nc] = to;                               // mark BEFORE pushing
      stack.push([nr, nc]);
    }
  }
}
```

The `from === to` guard is not decoration: without it the mark is a no-op, the visited test never
becomes false, and the loop runs forever. It is the same clause-2 failure as
[01b](01b-the-three-ways-the-contract-breaks.md)'s graph case, moved into the iterative form.

When the problem does not care about traversal order, swapping `pop()` for `shift()` — or better, a
proper queue, since `shift()` on a JavaScript array is not constant time in the general case —
turns the DFS into a BFS with the same bound and a frontier that is usually shallower. For "is this
region connected" or "how many islands", BFS and DFS are interchangeable; for shortest path on an
unweighted grid, only BFS is correct.

## Gotchas

**★ Symptom: an iterative pre-order that emits children right to left.** Cause: rule 3 skipped —
children pushed in natural order onto a LIFO stack. Fix: push in reverse; for a binary tree, push
`right` first so `left` pops first. Say it out loud as you write it, because the reviewer is
watching for exactly this line.

**★ Symptom: an iterative graph DFS whose stack grows past the number of vertices.** Cause: rule 4
skipped — vertices marked on pop instead of on push, so a vertex reachable by k edges is pushed k
times. Fix: mark at the push. It is the same rule as BFS marking on enqueue, and it is what keeps
the stack bounded by V.

**★ Symptom: an iterative flood fill that never terminates.** Cause: the source colour equals the
target colour, so painting a cell does not change the visited test. Fix: the `from === to` early
return, before the loop. Every version of "mark by mutating the input" needs the equivalent guard.

**★ Symptom: `NullPointerException` from `ArrayDeque` in the Java conversion.** Cause: the
TypeScript habit of pushing a possibly-null child and skipping it on pop. `ArrayDeque` does not
permit null elements. Fix: null-check at the push site.

**★ Symptom: the iterative version uses far more memory than the recursive one.** Cause: rule 1
ignored — invariants copied into every frame. A frame holding the whole grid, the target array or a
copy of the path is multiplied by the depth. Fix: keep invariants in a closure variable or a field
outside the loop; the frame holds only what varies per level.

**★ Symptom: the iterative graph traversal visits a vertex twice even though it marks on push.**
Cause: the mark test read at the push site but the vertex already sitting on the stack from an
earlier neighbour — the check and the mark must be the same atomic step. Fix: `if (!seen.has(v)) {
seen.add(v); stack.push(v); }` as one unit; testing without marking, or marking a different set from
the one tested, reintroduces the duplicate.

**Symptom: the explicit stack is an array of arrays (`[r, c]` pairs) and the traversal is slower and
allocates heavily.** Cause: a heap object per pushed cell. Fix: for a grid, push a single encoded
integer — `r * cols + c` — and decode on pop; the stack becomes a flat array of numbers, which is
both the smaller allocation and the closer analogue of what the frame held.

**Symptom: a conversion that changes which node is reported first in a "find any" search.** Cause:
the push order reversed relative to the recursion, so the search explores in a different order and
returns a different valid answer. Fix: if the problem accepts any answer this is harmless and worth
saying; if it wants a specific one — leftmost, smallest — preserve the order with rule 3 and check
it on a two-child example.

## Interview questions

**★ The recursive solution overflows the stack. What do you do?**
Convert it, once I have confirmed the contract is not the problem. The runtime's call stack becomes
an explicit array on the heap, each entry holding exactly what a frame held — the node, plus an
index or a done flag if there is work after the recursive call — and the loop pops, does one step,
and pushes. Children go on in reverse because the stack is LIFO, and anything the recursion did on
entry, like marking visited, happens at the push. The bound is unchanged, Θ(depth), but the heap
holds far more entries than a call stack whose size neither runtime documents. What I would not do
is make it tail-recursive: V8 does not implement proper tail calls and the JVM never had them, so
the depth is identical. In Java, a larger thread stack is a hedge the javadoc itself calls platform
dependent, and it is only a fix for a depth I can bound.

**★ Why do the children get pushed in reverse order?**
Because a stack is last-in-first-out and the recursion was first-to-last. `sumRecursive` iterated
children left to right, so the iterative version must pop them left to right, which means pushing
them right to left. For a binary tree that is `push(right)` then `push(left)`. If the traversal's
output order does not matter — a sum, a count, a connectivity check — the reversal is optional and
worth saying is optional; if the problem asks for pre-order output, it is the difference between
right and wrong.

**Is BFS or DFS the better conversion for a grid?**
DFS with an explicit stack is the closer transcription of the recursive code and keeps the same
traversal order; BFS with a queue usually keeps a shallower frontier and is the only correct choice
if the problem wants a shortest path on an unweighted grid. Both are Θ(rows × cols) time and space,
both mark on insertion, and for connectivity questions — number of islands, region size, does this
region touch the border — they are interchangeable, so pick whichever you can write without a bug.
The one implementation note is that a JavaScript array's `shift()` is not a constant-time dequeue
in general; for a BFS over a large grid, keep a head index into the array rather than shifting.

**★ Where does the invariant data live after the conversion, and why does it matter?**
Outside the loop — as a closure variable in TypeScript, a field or a local in Java. The frame should
hold only what differs from level to level: the node, the index, the accumulated value. Anything
constant across the whole traversal — the grid, the target, the output array, the adjacency map —
would otherwise be duplicated into every stack entry and multiplied by the depth, turning a Θ(depth)
structure into Θ(depth × payload). This is the one place where the conversion can be asymptotically
worse than the recursion, and it is entirely avoidable.

**Why mark visited when you push rather than when you pop?**
Because the bound depends on each vertex entering the stack once. Marking on pop lets a vertex with
k incoming edges be pushed k times before it is first processed, so the stack can hold more entries
than there are vertices and the "each vertex once" sentence stops being true — the traversal is
still correct, and the space bound you would state is now wrong. It is precisely the same rule as
BFS marking on enqueue rather than on dequeue, and it fails in the same way, which is worth saying
because it shows the two are one idea.

**What is the space bound of the iterative version compared with the recursive one?**
The same, Θ(depth), and that is the honest answer — the conversion does not reduce memory, it moves
it. What changes is *which* memory: the call stack has a size the engine chose and neither Node nor
the JVM documents as a depth, while the heap is bounded by the process's memory. A conversion is
therefore never justified by "it uses less space"; it is justified by "the depth is proportional to
the input and the call stack will not take it", which is a different claim and the one to make.

---

← Prev: [01e · Memoising a recursive function](01e-memoising-a-recursive-function.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [01g · Post-order and the resume-point frame](01g-post-order-and-the-resume-point-frame.md)
