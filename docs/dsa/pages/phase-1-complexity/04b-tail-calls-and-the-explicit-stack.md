---
title: "A tail-recursive rewrite overflows at exactly the same depth, because V8 does not eliminate tail calls and the JVM never has — the fix for a deep recursion is structural: the runtime's stack becomes an array on the heap, the conversion is mechanical, and the bound does not change"
sidebar_label: "04b · Tail calls, and the explicit stack"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. ES2015's proper-tail-call section could **not** be fetched this session;
> that V8 does not implement it is widely reported engine behaviour, stated as such, and the
> JVM's lack of tail-call elimination likewise. The `ArrayDeque` amortised-constant sentence is
> the JDK 25 javadoc quoted in phase 0. Second half of topic 04 —
> [04](04-space-and-the-recursion-stack.md) is what counts as space, the recursion stack as a
> bound, and the runtime limits. **No sandbox run.**

**The wrong fix for a stack overflow is the one candidates reach for first: "I'll make it
tail-recursive."** A tail call is a call in return position that a compiler *could* turn into a
jump, reusing the frame; ES2015 specified that JavaScript engines must, and V8 — Node — does
not, while the JVM has never eliminated tail calls in bytecode or JIT. In both runtimes the
rewrite produces one frame per call exactly as before and fails at the same depth. The right fix
is structural: the stack the runtime was keeping becomes an array you keep, each frame becomes
an entry holding what the frame held, and the loop pops, processes and pushes. The bound is
unchanged — Θ(depth) either way — but the depth now lives on the heap, which holds millions of
entries where the call stack holds thousands. This page is the tail-call fact, the conversion
with code in both languages, the post-order case that needs a marker, where recursion is safe
to keep, and the sentence that says all of it.

## Why tail calls do not save you

A tail call is a call in return position — `return f(n - 1, acc)` — that a compiler *could*
turn into a jump, reusing the frame, so that depth stays constant. ES2015 specified this
("proper tail calls"); V8 does not implement it, so Node runs tail-recursive code with one frame
per call like any other recursion. The JVM has never had tail-call elimination in the bytecode
or the JIT. In both runtimes a tail-recursive rewrite of a deep recursion overflows at the same
depth as the original, and an interviewer who hears "I'll make it tail-recursive" as the fix for
a stack overflow has heard a wrong answer. The correct one: an explicit stack, or a loop.

```ts
// tail-recursive — and it STILL overflows in Node at large n; the accumulator changes nothing
export function sumTail(n: number, acc = 0): number {
  return n === 0 ? acc : sumTail(n - 1, acc + n);
}
```

## Recursive to iterative: the explicit stack

The conversion is mechanical: the stack the runtime was keeping becomes an array you keep, and
each frame becomes an entry holding what the frame held. For a DFS that is a node and, when the
order of children matters, an index into them:

```ts
type Node = { val: number; children: Node[] };

// recursive — Θ(depth) on the call stack; overflows on a long path
export function sumRecursive(root: Node | null): number {
  if (!root) return 0;
  let s = root.val;
  for (const c of root.children) s += sumRecursive(c);
  return s;
}

// iterative — Θ(depth) on the heap, which is bounded by memory, not by the call-stack limit
export function sumIterative(root: Node | null): number {
  if (!root) return 0;
  let s = 0;
  const stack: Node[] = [root];
  while (stack.length) {
    const n = stack.pop()!;
    s += n.val;
    for (let i = n.children.length - 1; i >= 0; i--) stack.push(n.children[i]); // reversed to keep left-to-right order
  }
  return s;
}
```

```java
// Java: the same conversion; ArrayDeque is the stack (amortised constant push/pop per the javadoc)
static int sumIterative(Node root) {
    if (root == null) return 0;
    int s = 0;
    Deque<Node> stack = new ArrayDeque<>();
    stack.push(root);
    while (!stack.isEmpty()) {
        Node n = stack.pop();
        s += n.val;
        for (int i = n.children.size() - 1; i >= 0; i--) stack.push(n.children.get(i));
    }
    return s;
}
```

Post-order and in-order traversals need the "index into children" form, or a second visit
marker, because the node must be processed *after* its children return; a pre-order sum does
not. The space bound is unchanged by the conversion — Θ(depth) either way — but the depth now
lives on the heap, which holds millions of entries where the call stack holds thousands.

Where recursion is safe: depth bounded by log n (binary search, balanced-tree operations, merge
sort, quicksort with a randomised pivot), or by a small constant from the problem (the height of
a trie over short words, a recursion over the digits of a number). Where it is not: anything
whose depth is the input size — linked lists, paths, grids flooded cell by cell, DFS on a graph
that might be a long chain, a recursion over the characters of a long string — and anything a
constraint of 10⁵ puts in that class.

## Saying it

*"Time Θ(n) — each node once. Space Θ(h) for the recursion, where h is the height; that's log n
on a balanced tree and n on a skewed one, and at n up to 10⁵ I'd write it iteratively with an
explicit stack, because Node's call stack won't take a hundred thousand frames."* The last
clause is the one that separates a candidate who knows the bound from one who has hit the
limit.

## Gotchas

**★ Symptom: `RangeError: Maximum call stack size exceeded` on the large test.** Cause:
recursion depth equal to the input size — a path, a list, a grid. Fix: an explicit stack on the
heap; the conversion is mechanical and the bound is unchanged.

**★ Symptom: "I'll make it tail-recursive" offered as the fix.** Cause: tail-call elimination
assumed. Fix: V8 does not implement it and the JVM never had it; the depth is the same. Loop, or
explicit stack.

**Symptom: flood fill on a 1000 × 1000 grid recursed cell by cell.** Cause: depth up to a
million on a snake-shaped region. Fix: BFS with a queue, or DFS with an explicit stack, both
Θ(rows × cols) on the heap.

**Symptom: an iterative post-order that processes nodes before their children.** Cause: the
pre-order conversion reused. Fix: push a (node, visited) marker or an index into children;
process on the second visit.

## Interview questions

**★ The recursive solution overflows the stack. What do you do?**
Convert it: the runtime's call stack becomes an explicit array on the heap, each entry holding
what a frame held — the node, and an index into its children when order matters — and the
loop pops, processes and pushes. The bound is unchanged, Θ(depth), but the heap holds millions
of entries where the call stack holds thousands. Not a tail-recursive rewrite: V8 does not
implement proper tail calls and the JVM never had them, so the depth is identical. In Java, a
larger thread stack is a hedge the javadoc calls platform dependent, not a fix.

**★ Why doesn't a tail-recursive rewrite fix a stack overflow in Node or Java?**
Because neither runtime eliminates tail calls. ES2015 specified proper tail calls — a call in
return position reusing the frame — and V8 does not implement them; the JVM has no tail-call
elimination in the bytecode or the JIT. The rewrite produces one frame per call exactly as
before and overflows at the same depth. The fix is structural: an explicit stack or a loop.

**How do you write an iterative post-order traversal?**
With a marker or an index: push (node, false); on pop, if unvisited, push (node, true) back and
then its children, so the node comes off the stack again only after every child has been
processed; process it on the second pop. Or keep an index into each node's children on the
stack entry and advance it, processing the node when the index runs out. Pre-order does not
need this because the node is processed on the first pop.

---

← Prev: [04 · Space and the recursion stack](04-space-and-the-recursion-stack.md) · Index: [Phase 1 — Complexity analysis](README.md) · Next → [05 · The common classes and the limits](05-the-common-classes-and-what-the-limits-imply.md)
