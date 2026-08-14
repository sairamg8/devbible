---
title: "04.1 · The structure"
sidebar_label: "01 · The structure"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Array.prototype.push()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push), [`Array.prototype.pop()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/pop), [`Array.prototype.at()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/at), [`RangeError`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RangeError). Documentation-validated; **no timings**.

**In JavaScript a stack is an array, and that is the whole implementation.** `push` and `pop`
operate at the end, which is the cheap end
([01 · The cost table](../01-dynamic-arrays/01-the-real-cost-table.md)) — so the array *is* the
data structure, and everything interesting about this topic is what stacks are **for**.

## The implementation, for completeness

```js
class Stack {
  #items = [];

  push(x)  { this.#items.push(x); return this; }
  pop()    { return this.#items.pop(); }                 // undefined when empty
  peek()   { return this.#items.at(-1); }
  get size() { return this.#items.length; }
  get isEmpty() { return this.#items.length === 0; }
}
```

Every operation is O(1) — `pop` genuinely so, `push` amortised.

⚠️ **`pop()` on an empty stack returns `undefined`, it does not throw.** So `undefined` is
ambiguous between "empty" and "the top was `undefined`". If that distinction matters, check
`isEmpty` first — the same reason `Map.has` exists separately from `Map.get`.

**Most of the time you should just use an array.** A wrapper class earns its place when the
vocabulary matters (`peek` reads better than `arr.at(-1)`) or when you want to forbid indexed
access. Otherwise it is ceremony.

## Why the *call stack* is the same idea

Function calls push a frame; returns pop it. That is why:

- **a stack trace reads bottom-up** — the deepest call is the top of the stack;
- **recursion depth is space** ([Phase 13 · 01](../../phase-13-complexity/01-big-o/README.md));
- **`RangeError: Maximum call stack size exceeded`** happens at a few thousand to a few tens of
  thousands of frames, depending on the engine and frame size. It is a small limit, and it is the
  reason a recursive algorithm over a large linear structure needs converting to a loop.

🔴 **Converting recursion to iteration is mechanical: use an explicit stack.** Push what the
recursive call would have received; loop while the stack is non-empty.

```js
// recursive — RangeError on a deep tree
function walk(node, out) {
  out.push(node.value);
  for (const child of node.children) walk(child, out);
}

// iterative — heap-allocated stack, no frame limit
function walk(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    out.push(node.value);
    for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i]);
  }
  return out;
}
```

⚠️ **Note the reversed push.** A stack reverses order, so pushing children left-to-right visits
them right-to-left. Pushing in reverse restores the recursive order — and forgetting it is the
most common bug in this conversion.

**JavaScript has no tail-call optimisation in practice.** The specification defines proper tail
calls, but engines outside JavaScriptCore have not shipped them, so rewriting a recursion into
tail position does **not** save you from the stack limit. Convert to a loop instead — this is
worth stating carefully, because the folklore says otherwise.

## Bracket matching — the canonical problem

```js
const PAIRS = { ")": "(", "]": "[", "}": "{" };

function isBalanced(str) {
  const stack = [];
  for (const ch of str) {
    if (ch === "(" || ch === "[" || ch === "{") stack.push(ch);
    else if (ch in PAIRS) {
      if (stack.pop() !== PAIRS[ch]) return false;     // wrong type, or empty
    }
  }
  return stack.length === 0;                            // nothing left open
}
```

Three details that are the actual answer:

- **`stack.pop() !== PAIRS[ch]` handles both failures at once** — a mismatched closer and a closer
  with nothing open (`pop()` returns `undefined`, which matches no opener).
- **The final `length === 0` check is required.** Without it, `"((("` passes.
- 🔴 **`ch in PAIRS` is safe here only because `PAIRS` has known keys.** For user-controlled input
  a plain object lookup answers for `"constructor"` — a `Map`, or `Object.create(null)`, avoids it
  ([Phase 13 · 03](../../phase-13-complexity/03-choosing-a-structure/01-the-decision-table.md)).

**The generalisation: a stack is how you match nested structure.** Parsers, JSON readers, XML/HTML
tag matching and template engines are all this problem wearing a costume.

## Undo/redo — two stacks

```js
class History {
  #undo = [];
  #redo = [];

  do(command) { command.apply(); this.#undo.push(command); this.#redo.length = 0; }

  undo() {
    const c = this.#undo.pop();
    if (!c) return;
    c.revert();
    this.#redo.push(c);
  }

  redo() {
    const c = this.#redo.pop();
    if (!c) return;
    c.apply();
    this.#undo.push(c);
  }
}
```

🔴 **`this.#redo.length = 0` is the whole design.** A new action after an undo invalidates the redo
branch — that is what every editor does, and leaving it out produces a redo that reapplies an
operation onto a state it was never recorded against.

⚠️ **Unbounded undo stacks are a memory leak in disguise.** Each command holds whatever it needs to
revert; a long session accumulates all of it. Cap the depth and drop from the *bottom* — which an
array makes O(n) with `shift`, so a ring buffer or a periodic `splice(0, k)` is the practical
answer.

## Gotchas

**Symptom:** `pop()` returns `undefined` and the code cannot tell why
**Cause:** Empty stack and a stored `undefined` are indistinguishable.
**Fix:** Check `isEmpty` before popping.

**Symptom:** `RangeError: Maximum call stack size exceeded`
**Cause:** Recursion deeper than the engine's frame limit.
**Fix:** Convert to an explicit stack and a loop. Tail-call rewriting does **not** help in most
engines.

**Symptom:** An iterative traversal visits children in the wrong order
**Cause:** A stack reverses; children were pushed left-to-right.
**Fix:** Push them in reverse.

**Symptom:** `"((("` is reported as balanced
**Cause:** The final "stack is empty" check is missing.
**Fix:** `return stack.length === 0`.

**Symptom:** A bracket matcher accepts `")"` as a first character
**Cause:** Popping an empty stack yields `undefined`, which was not compared.
**Fix:** Compare the popped value against the expected opener — `undefined` fails it.

**Symptom:** A lookup table answers for `"constructor"`
**Cause:** `in` on a plain object consults the prototype.
**Fix:** `Map`, `Object.hasOwn`, or `Object.create(null)`.

**Symptom:** Redo reapplies a stale operation
**Cause:** The redo stack was not cleared when a new action was performed.
**Fix:** Clear it in `do`.

**Symptom:** Memory grows over a long editing session
**Cause:** An unbounded undo stack retaining every command's captured state.
**Fix:** Cap the depth and drop from the bottom.

## Interview questions

**★ How do you implement a stack in JavaScript?**
An array with `push`/`pop` — both operate at the cheap end, so it is O(1) (amortised for `push`).
A wrapper class is optional and adds vocabulary, not capability.

**★ Why does deep recursion throw, and what is the fix?**
Each call pushes a frame onto the call stack, which is a few thousand to a few tens of thousands
of frames deep. The fix is an explicit heap-allocated stack and a loop. **Rewriting into tail
position does not help** — proper tail calls are specified but unimplemented in most engines.

**★ Convert a recursive tree walk to an iterative one.**
Push the root; loop while the stack is non-empty, popping a node and pushing its children **in
reverse** so they are visited in the original order. The reversal is the detail people miss.

**★ Write a bracket matcher and name the two easy bugs.**
Push openers, and on a closer pop and compare against the expected opener. The bugs are forgetting
the final `stack.length === 0` check (so `"((("` passes) and not handling a pop from an empty
stack (which returns `undefined` and must fail the comparison).

**★ How does undo/redo work, and what is the one line people forget?**
Two stacks. `do` applies and pushes to undo; `undo` pops, reverts and pushes to redo; `redo` does
the reverse. The forgotten line is **clearing the redo stack when a new action is performed** —
without it, redo reapplies an operation onto a state it was never recorded against.

**★ What is the memory risk in an undo stack?**
Every command retains whatever it needs to revert, so an unbounded stack grows with the session.
Cap the depth and drop from the bottom — noting that dropping from the front of an array is O(n).

**Why is a stack the right structure for nested syntax?**
Because nesting is last-opened-first-closed by definition. Parsers, JSON readers and tag matchers
are all the bracket problem in different clothing.

---

[Topic index](./README.md) · Next → [02 · Monotonic stacks](./02-monotonic-stacks.md)
