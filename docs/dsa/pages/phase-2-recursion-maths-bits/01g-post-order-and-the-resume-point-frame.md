---
title: "A recursion that does work after its recursive calls cannot be converted with a bare node stack — the node has to come off twice, and the general encoding is the one the runtime already uses: a frame carrying a resume index and a single return-value register"
sidebar_label: "01g · Post-order and the resume-point frame"
sidebar_position: 1.6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. Traversal conversions are common practice, written out rather than cited.
> The `ArrayDeque` null restriction is JDK behaviour named as mechanism; its amortised-constant
> `push`/`pop` is the JDK 25 javadoc quoted in
> [phase 1 · 03](../phase-1-complexity/03-amortised-analysis.md). 🔴 **No stack-depth number for
> any engine.** Seventh file of topic 01 —
> [01f](01f-converting-recursion-to-an-explicit-stack.md) is the four rules and the easy case.
> **No sandbox run.**

**The pre-order conversion works because the node's work happens before any recursive call, so one
pop is enough; every other recursion needs the node scheduled twice, and getting that schedule
right is the whole of the difficulty.** In-order, post-order, "sum of the subtree", "is this
balanced", the merge in merge sort, and any backtracking recursion with an undo after the call are
all in this class. There are exactly two encodings — a done flag, and a child index that acts as a
program counter — and the second is the general one, because it is literally what the runtime keeps
in a frame.

## The hard case: work after the call

In-order and post-order traversals, any recursion that combines its children's results, and every
divide-and-conquer merge. The node must come off the stack *twice*: once to schedule its children,
once to do its own work after they are done. Two encodings, and both get asked.

**A visited flag in the frame.** Simple, general, one extra boolean per entry.

```ts
// post-order, iteratively: push (node, false); on the second visit, emit
export function postorder(root: TreeNode | null): number[] {
  const out: number[] = [];
  const stack: Array<{ node: TreeNode; done: boolean }> = [];
  if (root) stack.push({ node: root, done: false });
  while (stack.length) {
    const f = stack.pop()!;
    if (f.done) { out.push(f.node.val); continue; }   // the resume point (rule 2)
    stack.push({ node: f.node, done: true });         // schedule my own work AFTER the children
    if (f.node.right) stack.push({ node: f.node.right, done: false });
    if (f.node.left) stack.push({ node: f.node.left, done: false });
  }
  return out;
}
```

Read the push order carefully: the node's own re-entry goes on *first*, so it is popped *last* —
after both children. That is rule 3 applied to a schedule rather than to siblings, and it is the
single line the conversion lives or dies on.

**A child index in the frame.** Better when the node has many children or when the combine happens
incrementally, and it is the encoding closest to what the runtime actually does — the index is a
program counter.

```ts
// n-ary post-order sum: the frame holds the node, the next child to visit, and the running total
export function sumPostorder(root: Node | null): number {
  if (!root) return 0;
  type Frame = { node: Node; i: number; acc: number };
  const stack: Frame[] = [{ node: root, i: 0, acc: root.val }];
  let returned = 0;                                   // the value the "call" that just finished gave back
  while (stack.length) {
    const f = stack[stack.length - 1];
    if (f.i > 0) f.acc += returned;                   // fold in the child that just returned
    if (f.i < f.node.children.length) {
      const child = f.node.children[f.i++];
      stack.push({ node: child, i: 0, acc: child.val });
      continue;                                       // "call"
    }
    stack.pop();
    returned = f.acc;                                 // "return"
  }
  return returned;
}
```

That is the fully general conversion, and it is worth writing once by hand so it is available under
pressure: the stack holds frames, the frame holds a resume index, `returned` is the return-value
register. Every recursion converts this way, including ones with several recursive calls in
different places — each call site is a distinct value of the resume index.

**In-order**, the third of the classic three, has a neater specialised form that is worth knowing
separately because it is what interviewers expect for a BST:

```ts
// in-order without a flag: walk left as far as possible, emit, then go right
export function inorder(root: TreeNode | null): number[] {
  const out: number[] = [];
  const stack: TreeNode[] = [];
  let cur: TreeNode | null = root;
  while (cur || stack.length) {
    while (cur) { stack.push(cur); cur = cur.left; }   // descend, remembering the path
    const n = stack.pop()!;
    out.push(n.val);
    cur = n.right;
  }
  return out;
}
```

This is the iterator that a BST's `next()` is built from, and it is why "iterative in-order" and
"BST iterator" are the same question asked twice.

## Reading it back as the runtime

It is worth naming what the general form corresponds to, because it makes the recipe memorable
rather than something to re-derive:

| In the recursion | In the conversion |
|---|---|
| a call | `stack.push(newFrame)` and `continue` |
| a return | `stack.pop()` and assign to the return register |
| the parameters and locals that survive a call | fields of the frame object |
| the *instruction pointer* — which call site to come back to | the resume index (`i`, or `done`) |
| the value the callee handed back | one variable outside the loop (`returned`) |
| the call stack | the array |

Anything that does not survive across a call — a temporary computed and consumed between two
calls — does not belong in the frame; putting it there multiplies it by the depth for nothing.

## Gotchas

**★ Symptom: an iterative post-order that processes a node before its children.** Cause: the
pre-order conversion reused for a recursion that has work after the call. Fix: the node needs a
resume point — push `{node, done: false}`, and on the first pop push `{node, done: true}` *before*
the children so it comes back off last. Or carry a child index in the frame.

**Symptom: an iterative in-order that emits nothing, or loops on the leftmost node.** Cause: the
inner descend-left loop written without advancing `cur = n.right` after the emit, so the same node
is re-pushed. Fix: the three-line shape — descend while `cur`, pop and emit, `cur = n.right` — is
one unit; do not rewrite it from memory in pieces.

**★ Symptom: the iterative version's frame object is bigger than it needs to be and memory is the
bottleneck.** Cause: invariants and temporaries stored per frame. Fix: only values that are read
*after* a recursive call belong in the frame; the grid, the target, the output array and any value
consumed before the next call stay outside.

**★ Symptom: the general conversion returns the wrong value for a node with multiple children.**
Cause: the single `returned` register read at the wrong moment — it must be folded into the parent
frame *on re-entry*, before the next child is scheduled, because the next push overwrites the
context. Fix: the `if (f.i > 0) f.acc += returned;` line at the top of the loop body, which is the
"we just came back from a call" branch.

**Symptom: a done-flag conversion where the node is emitted before its children even though the
flag is there.** Cause: the re-entry frame pushed *after* the children instead of before, so it
pops first. Fix: push the node's own resume frame first; a stack pops in reverse push order, so
"first pushed" means "last processed".

**Symptom: an iterative post-order over an n-ary tree using the "reverse a pre-order" trick and the
sibling order is wrong.** Cause: the trick (pre-order with children pushed left-to-right, then
reverse the output) produces root-right-left reversed, which is exactly post-order for a *binary*
tree and needs care for n-ary. Fix: use the done flag or the child index, both of which are
order-explicit and generalise without thought.

## Interview questions

**★ How do you write an iterative post-order traversal, and why is it harder than pre-order?**
Harder because post-order has work *after* the recursive calls, so the node must be scheduled
twice: once to push its children, once to emit itself. Two encodings. A visited flag: push
`{node, done: false}`; on popping an undone frame, push `{node, done: true}` first and then the
children, so the node's own re-entry is underneath them on the stack and comes off last; emit on
the done frame. Or a child index in the frame, which is the general form — the index is a program
counter recording which recursive call to resume from, and it handles n-ary nodes and multiple
distinct call sites uniformly. Pre-order needs neither because the node's work happens before any
call, so it can be done on the first and only pop.

**★ Can every recursion be converted mechanically, or only some?**
Every one. The general recipe is a frame object containing all the parameters and locals that
survive across a recursive call, plus a resume index saying which call site to come back to, plus a
single "returned value" register outside the loop. A push is a call, a pop with the register set is
a return. That is precisely what the runtime does, which is why the conversion always works — the
question is only how ugly the frame is, and for the shapes that show up in interviews (traversals,
divide and conquer, backtracking) it is small. What varies is whether a *simpler* conversion exists:
tail recursion converts to a plain loop with no stack at all, pre-order converts with a bare node
stack, and only the work-after-the-call cases need the full frame.

**★ What is the connection between the explicit-stack conversion and what the runtime does?**
They are the same thing, which is why the conversion always exists. The runtime keeps an activation
record per live call holding the arguments, the locals, and the address to resume at; the
conversion keeps an object per live call holding the same arguments and locals and an integer
saying which recursive call site to resume from. The runtime has a register for the returned value;
the conversion has a variable outside the loop. Push is call, pop is return. Once that mapping is
explicit, converting an unfamiliar recursion stops being a puzzle and becomes clerical work: list
what survives a call, count the call sites, write the switch.

**★ Why does the done-flag frame get pushed before the children rather than after?**
Because the stack pops in reverse push order, so the last thing pushed is the first thing
processed, and the node's own work must be the *last* thing processed. Pushing `{node, done: true}`
first puts it at the bottom of the group, underneath both children, so both children are popped and
fully processed before it resurfaces. Pushing it after the children would make it pop first, which
is pre-order with an extra allocation.

**Is there a way to get post-order without a flag?**
For a binary tree, yes and it is worth knowing as a party trick: do a pre-order that visits
root, then right, then left, and reverse the output — that is post-order. It costs an extra
reversal and Θ(n) output space, and it does not generalise cleanly to n-ary trees or to recursions
where the node's work is not "emit a value" but "combine the children's results", which is most of
them. The flag and the index both do generalise, so they are what I would write unless the
interviewer asked for the trick specifically.

**When does the in-order iterative pattern show up outside a traversal question?**
As a BST iterator. The "descend left pushing as you go, pop and emit, then move to the right child"
shape is exactly a `next()` that returns the smallest unvisited key, with the stack as the
iterator's state between calls — which makes it Θ(h) space and amortised Θ(1) per `next()`, since
each node is pushed once and popped once over a full traversal. That amortised argument is phase
1's "each element pushed once and popped at most once" sentence applied to an iterator, and saying
it is what distinguishes a memorised pattern from an understood one.

---

← Prev: [01f · Converting to an explicit stack](01f-converting-recursion-to-an-explicit-stack.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [01h · Choosing, and reading the overflow](01h-choosing-recursion-and-reading-the-overflow.md)
