---
title: "04.2 · Monotonic stacks and expressions"
sidebar_label: "02 · Monotonic stacks"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — algorithmic material at the standard treatment; JavaScript specifics against MDN ([`Array.prototype.push()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push), [`Array.prototype.at()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/at), [`Number`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)). Documentation-validated; **no timings**.

**A monotonic stack is the trick that turns a family of O(n²) problems into O(n)**, and it is
worth learning as a pattern rather than as individual solutions — because the individual solutions
look unrelated and are the same five lines.

## The pattern

Keep the stack **sorted** (increasing or decreasing) by popping anything that would break the
order before pushing. The elements you pop are exactly the ones whose answer you have just found.

```js
// "next greater element" — for each item, the first larger item to its right
function nextGreater(nums) {
  const result = new Array(nums.length).fill(-1);
  const stack = [];                       // holds INDICES, decreasing by value

  for (let i = 0; i < nums.length; i++) {
    while (stack.length && nums[stack.at(-1)] < nums[i]) {
      result[stack.pop()] = nums[i];      // nums[i] is the answer for that index
    }
    stack.push(i);
  }
  return result;
}
```

🔴 **Store indices, not values.** You almost always need the position — to write into a result
array, or to compute a distance. Storing values and then searching for their index reintroduces
the O(n) scan you were avoiding.

**Why it is O(n) despite the inner `while`:** every index is pushed exactly once and popped at
most once, so the total work across the whole loop is bounded by 2n. It is the "count total
iterations, not nesting depth" rule from
[Phase 13 · 01 · 02](../../phase-13-complexity/01-big-o/02-reading-a-bound.md), and it is the part
to say out loud — an interviewer asking "isn't that nested loops?" is asking exactly this.

## The family

Once you see the shape, these are all the same:

| Problem | Stack order | What a pop means |
|---|---|---|
| Next greater element | decreasing | found the next greater for the popped index |
| Next smaller element | increasing | mirror image |
| Daily temperatures (days until warmer) | decreasing | `i - poppedIndex` is the wait |
| Largest rectangle in a histogram | increasing | the popped bar's rectangle is complete |
| Trapping rain water | decreasing | a basin has been closed |
| Remove k digits to make the smallest number | increasing | a digit is worse than its successor |

🔴 **The recognition rule: if the brute force is "for each element, scan forward/backward until
some comparison holds", it is a monotonic stack.** That sentence is the entire pattern, and
recognising it is worth more than memorising any one solution.

## Expression evaluation

Two stacks — one for values, one for operators — or one stack over postfix notation.

**Postfix (RPN) is the easy case**, and it is why compilers convert to it:

```js
function evalRPN(tokens) {
  const stack = [];
  const ops = {
    "+": (a, b) => a + b,
    "-": (a, b) => a - b,
    "*": (a, b) => a * b,
    "/": (a, b) => Math.trunc(a / b),
  };

  for (const t of tokens) {
    if (t in ops) {
      const b = stack.pop();
      const a = stack.pop();          // ⚠️ order: b was pushed last
      stack.push(ops[t](a, b));
    } else {
      stack.push(Number(t));
    }
  }
  return stack.pop();
}
```

⚠️ **The operand order is the bug everyone writes once.** The second pop is the *left* operand,
because it was pushed first. It is invisible for `+` and `*` and wrong for `-` and `/`.

⚠️ **`Math.trunc(a / b)` rather than `Math.floor`** — these problems almost always specify
truncation toward zero, and `Math.floor(-7 / 2)` is `-4` while `Math.trunc(-7 / 2)` is `-3`. State
which the requirement wants rather than assuming.

**Infix needs precedence**, which is the shunting-yard algorithm: numbers go straight to output,
operators go to a stack, and before pushing an operator you pop everything of higher or equal
precedence. Parentheses push and pop as markers. **The stack exists to defer the operators you
cannot resolve yet** — which is the same job it does in bracket matching.

## Where this shows up outside interviews

- **Tokenisers and parsers** — nesting, precedence, and matching delimiters.
- **Undo/redo and navigation history** — [01 · The structure](./01-the-structure.md).
- **DOM traversal without recursion** — an explicit stack over a deep tree that would otherwise
  overflow.
- **The call stack itself**, which is why a stack trace reads the way it does.
- **Backtracking** — the recursion *is* a stack; making it explicit is what lets you pause,
  resume, or bound it.

## Gotchas

**Symptom:** A monotonic-stack solution needs an extra scan to find positions
**Cause:** Values were pushed instead of indices.
**Fix:** Push indices; read values through them.

**Symptom:** The solution is called O(n²) in review because of the inner `while`
**Cause:** Nesting depth was counted instead of total work.
**Fix:** Each index is pushed once and popped at most once — bounded by 2n.

**Symptom:** The last few elements have no answer
**Cause:** Items left on the stack at the end never found their match.
**Fix:** That is correct — initialise the result to the "none" value (`-1`), or drain the stack
deliberately.

**Symptom:** Subtraction and division give wrong RPN results
**Cause:** The operands were popped in the wrong order.
**Fix:** The **second** pop is the left operand.

**Symptom:** Negative division results are off by one
**Cause:** `Math.floor` rounds toward negative infinity.
**Fix:** `Math.trunc` when the requirement says "truncate toward zero".

**Symptom:** `t in ops` matches something unexpected
**Cause:** `in` consults the prototype — `"toString"` is "an operator".
**Fix:** `Object.hasOwn(ops, t)`, a `Map`, or `Object.create(null)`.

**Symptom:** Infix evaluation ignores precedence
**Cause:** Operators applied as encountered rather than deferred.
**Fix:** Shunting-yard — pop operators of higher or equal precedence before pushing.

**Symptom:** A deep DOM traversal throws `RangeError`
**Cause:** Recursion over an unbounded tree depth.
**Fix:** An explicit stack.

## Interview questions

**★ What is a monotonic stack and when do you reach for one?**
A stack kept sorted by popping anything that would break the order. Reach for it when the brute
force is *"for each element, scan forward or backward until some comparison holds"* — next
greater/smaller, daily temperatures, largest rectangle, trapping rain water are all that shape.

**★ Your solution has a `while` inside a `for`. Isn't it O(n²)?**
No. Each index is pushed exactly once and popped at most once, so total work across the whole loop
is bounded by 2n — O(n). Nesting depth is not the bound; total iterations are.

**★ Why push indices rather than values?**
Because the answer usually needs the position — to write into a result array or compute a distance
like "days until warmer". Storing values forces an index lookup that reintroduces a linear scan.

**★ Evaluate reverse Polish notation. What is the classic bug?**
Push numbers, and on an operator pop two operands and push the result. The bug is operand order:
the **second** pop is the left operand. It is invisible for `+` and `*` and wrong for `-` and `/`.

**★ Why do compilers convert infix to postfix?**
Because postfix needs no precedence rules and no parentheses — a single stack evaluates it left to
right. Infix requires shunting-yard, where the stack exists to defer operators that cannot be
resolved yet.

**★ What do the items left on the stack at the end mean?**
They never found a match — no next greater element, no closing bracket. Initialise the result to
the "none" value, or drain the stack deliberately, depending on the problem.

**How do you traverse a very deep DOM tree without a `RangeError`?**
Replace the recursion with an explicit stack on the heap. Push children in reverse to preserve
visit order.

---

← [01 · The structure](./01-the-structure.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
