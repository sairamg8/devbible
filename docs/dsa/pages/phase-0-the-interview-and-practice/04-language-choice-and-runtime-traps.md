---
title: "TypeScript first, Java second — and each language has traps the interviewer knows: recursion depth in Node, no heap or sorted map in JavaScript, the default sort order, the safe-integer ceiling, int overflow and boxing in Java, and the cost of immutable strings"
sidebar_label: "04 · Language choice and traps"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against MDN —
> [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort),
> [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER),
> [*too much recursion*](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion) —
> and the JDK 25 API documentation for
> [`PriorityQueue`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/PriorityQueue.html),
> [`TreeMap`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/TreeMap.html) and
> [`Arrays`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Arrays.html).
> Runtime on this machine probed as **Node 24.20.0** (`node -v`); TypeScript not installed here, so
> no probe on it. Code is written to be runnable; **nothing was run**. Where a limit is not
> documented (V8's stack depth) the page says so rather than quoting a number.

**Pick the language you can write without thinking, and know its traps cold — because the
interviewer knows them, and several of them turn a correct algorithm into a wrong answer.** For
this reader that is TypeScript first and Java second. TypeScript's traps are a runtime with no
built-in heap or sorted map, a default sort that compares strings, a recursion limit low enough
that a deep DFS fails on a long path, and an integer ceiling at 2⁵³ − 1 after which arithmetic
silently loses precision. Java's are `int` overflow that wraps without a word, boxing that turns a
tight loop into allocation, `==` on boxed values, and strings that copy on every concatenation.
None of these is obscure; each is a follow-up an interviewer can ask in one sentence, and
"choosing per problem" — Java when the problem wants a heap or a sorted map, TypeScript when it
wants speed of writing — is itself a thing to say aloud.

## Choosing per problem

| The problem wants… | Prefer | Because |
|---|---|---|
| a priority queue / heap | Java | `PriorityQueue` is built in with documented O(log n) offer and poll; JavaScript has none |
| a sorted map or set with floor/ceiling | Java | `TreeMap` / `TreeSet` are built in with guaranteed log n operations; JavaScript has none |
| fast writing, string handling, closures | TypeScript | less ceremony; `Map`, `Set`, array methods and destructuring are quick |
| deep recursion on long inputs | either, converted to iteration | both runtimes have a stack limit; Node's is the one that bites first in practice |
| big integers | TypeScript with `BigInt`, or Java with `long` / `BigInteger` | say which and why |
| concurrency questions | Java | the primitives are in the language; Node's model is a different question |

Say the choice in the first minute: "I'll use TypeScript unless a heap comes up, in which case
I'd rather switch to Java than write one." Interviewers accept that; what they do not accept is
discovering at minute twenty that the language lacks the structure the plan needs.

## JavaScript trap 1 — the default sort compares strings

MDN states the default plainly:

> *"The default sort order is ascending, built upon converting the elements into strings, then
> comparing their sequences of UTF-16 code unit values."* — MDN, `Array.prototype.sort()`

So `[10, 9, 1].sort()` orders as strings — `1, 10, 9` — and a numeric sort needs a comparator.
The comparator's contract is also specified, and violating it is the second half of the trap:

> *"A negative value indicates that `a` should come before `b`. A positive value indicates that
> `a` should come after `b`. Zero or `NaN` indicates that `a` and `b` are considered equal."*
> — MDN, `Array.prototype.sort()`

```ts
const nums = [10, 9, 1, 100];
nums.sort();                    // ['1', '10', '100', '9'] order — strings, not numbers
nums.sort((a, b) => a - b);     // 1, 9, 10, 100 — the numeric comparator, always

// a comparator that returns a boolean is a bug, not a style choice:
// nums.sort((a, b) => a > b) returns true/false, which coerces to 1/0 — never negative,
// so the sort cannot know when a should come before b
```

Two more facts to have ready. Stability is guaranteed since ES2019 —
*"Since version 10 (or ECMAScript 2019), the specification dictates that `Array.prototype.sort` is
stable"* — so sorting by one key and then by another preserves the first order, which many
interval and scheduling solutions rely on. And the complexity is *not* specified:
*"The time and space complexity of the sort cannot be guaranteed as it depends on the
implementation"* — so in an interview you state O(n log n) as the assumption every engine meets,
and say it is an assumption.

## JavaScript trap 2 — no heap, no sorted map

JavaScript's standard library has `Map` and `Set` (hash-based, insertion-ordered) and arrays.
It has **no** priority queue and **no** sorted map or set. The consequences at the match step:

- **Top-k, merge-k, scheduling by earliest end** — the heap patterns — need either a hand-written
  heap (about thirty lines, rehearsed) or a reformulation: bucket sort when the key is bounded,
  sorting when n is small enough, quickselect for a single k-th element.
- **Floor and ceiling queries, "the smallest key greater than x"** — the sorted-map patterns —
  need a sorted array with binary search (O(log n) query, O(n) insert) or a hand-written
  balanced structure, which nobody writes in an interview. Say the trade: "sorted array plus
  binary search, O(n) inserts — fine if inserts are rare; otherwise this is a Java problem."

A minimal heap worth having memorised, because it is the one structure whose absence changes a
plan:

```ts
export class MinHeap<T> {
  private readonly a: T[] = [];
  constructor(private readonly less: (x: T, y: T) => boolean) {}
  get size(): number { return this.a.length; }
  peek(): T | undefined { return this.a[0]; }
  push(v: T): void {
    this.a.push(v);
    let i = this.a.length - 1;
    while (i > 0) {                               // sift up
      const p = (i - 1) >> 1;
      if (!this.less(this.a[i], this.a[p])) break;
      [this.a[i], this.a[p]] = [this.a[p], this.a[i]];
      i = p;
    }
  }
  pop(): T | undefined {
    if (this.a.length === 0) return undefined;
    const top = this.a[0];
    const last = this.a.pop() as T;
    if (this.a.length > 0) {
      this.a[0] = last;
      let i = 0;
      for (;;) {                                  // sift down
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < this.a.length && this.less(this.a[l], this.a[m])) m = l;
        if (r < this.a.length && this.less(this.a[r], this.a[m])) m = r;
        if (m === i) break;
        [this.a[i], this.a[m]] = [this.a[m], this.a[i]];
        i = m;
      }
    }
    return top;
  }
}
```

Java's `PriorityQueue` is the same structure with the cost documented — *O(log(n)) time for the
enqueuing and dequeuing methods* — and one detail worth knowing before you iterate it: *"The
Iterator provided in method `iterator()` and the Spliterator provided in method `spliterator()`
are not guaranteed to traverse the elements of the priority queue in any particular order."*
Iterating a heap does not give sorted order; polling does.

## JavaScript trap 3 — recursion depth

A recursive DFS on a path-shaped graph, or a recursive tree walk on a degenerate tree, fails in
Node with the V8 error MDN lists:

> Chrome/V8: *"RangeError: Maximum call stack size exceeded"* — MDN, *too much recursion*

The limit is implementation-defined and MDN gives no number; treat it as small enough that a
recursion 10⁵ deep will fail, and say so. The fix is mechanical — an explicit stack — and it is
worth having rehearsed because it is a common follow-up ("the tree is a million nodes deep"):

```ts
type Node = { val: number; left: Node | null; right: Node | null };

export function inorderIterative(root: Node | null): number[] {
  const out: number[] = [];
  const stack: Node[] = [];
  let cur = root;
  while (cur !== null || stack.length > 0) {
    while (cur !== null) { stack.push(cur); cur = cur.left; }   // go left as far as possible
    const n = stack.pop() as Node;
    out.push(n.val);
    cur = n.right;
  }
  return out;
}
```

Java has the same failure (`StackOverflowError`) with a different default depth; the conversion
is the same.

## JavaScript trap 4 — the safe-integer ceiling

JavaScript numbers are IEEE doubles, and MDN states the consequence exactly:

> *"Double precision floating point format only has 52 bits to represent the mantissa, so it can
> only safely represent integers between -(2^53 – 1) and 2^53 – 1. "Safe" in this context refers
> to the ability to represent integers exactly and to compare them correctly. For example,
> `Number.MAX_SAFE_INTEGER + 1 === Number.MAX_SAFE_INTEGER + 2` will evaluate to true, which is
> mathematically incorrect."* — MDN, `Number.MAX_SAFE_INTEGER`

So a product of two values near 10⁹ is fine (10¹⁸ is below 2⁵³ ≈ 9 × 10¹⁵? No — it is not, and
that is the point: 10¹⁸ exceeds the safe range). Multiplying two 32-bit-sized values can exceed
2⁵³, and the loss is silent. The two escapes are `BigInt` — MDN: *"For larger integers, consider
using `BigInt`"* — or, for modular problems, reducing before multiplying:

```ts
const MOD = 1_000_000_007n;
export function mulMod(a: bigint, b: bigint): bigint { return (a * b) % MOD; }
// with numbers: (a % m) * (b % m) can still reach ~1e18 for m ~ 1e9 — use BigInt, not Number
```

Bitwise operators are the other edge of this trap: they operate on 32-bit integers, so `1 << 31`
is negative and `x | 0` truncates — useful for fast integer division, dangerous above 2³¹.

The Java half of this topic — silent `int` overflow, boxing and `==`, `TreeMap`'s comparator
requirement, string building, and what Java's sorts guarantee — continues in
[04b · Java traps and sorting](04b-java-traps-and-sorting.md). One topic, two files.

## Gotchas

**★ Symptom: `[10, 9, 1].sort()` returned `[1, 10, 9]`.** Cause: the default sort compares
UTF-16 strings. Fix: always pass `(a, b) => a - b` for numbers; a boolean-returning comparator is
also wrong because it never returns a negative value.

**★ Symptom: "Maximum call stack size exceeded" on a long linked list or a path-shaped tree.**
Cause: recursion depth proportional to n in a runtime with a small, implementation-defined stack.
Fix: convert to iteration with an explicit stack, as in the in-order walk above; say the limit is
the reason.

**Symptom: the plan needs a heap, the language is TypeScript, and five minutes vanish.** Cause:
the missing built-in discovered at implement time. Fix: decide at the match step — bucket sort or
sorting if the constraints allow, a rehearsed thirty-line heap, or Java.

**Symptom: a product of two `number`s near 10⁹ is off by a few units.** Cause: the result
exceeds 2⁵³ − 1 and loses precision silently. Fix: `BigInt` for the multiplication, or reduce
modulo before multiplying when the problem is modular.

**Symptom: `nums.sort((a, b) => a > b)` "works" on small tests and fails on larger ones.** Cause: a boolean comparator coerces to `1` or `0`, never negative, so the engine is given an inconsistent ordering and the result depends on the algorithm's internal comparisons. Fix: return a number with the correct sign — `a - b` for numbers, `a.localeCompare(b)` for strings.

## Interview questions

**★ Which language would you use for this problem, and what does the choice depend on?**
TypeScript by default, for speed of writing; Java when the plan needs a priority queue or a
sorted map, because Java has `PriorityQueue` and `TreeMap` built in with documented logarithmic
operations and JavaScript has neither. The choice is said in the first minute so that a heap
appearing at the match step does not become a language problem at the implement step.

**★ What does JavaScript's `sort` do with no comparator, and what must a comparator return?**
It converts elements to strings and compares UTF-16 code unit sequences, so numbers sort
lexicographically. A comparator returns a negative number to put `a` first, a positive number to
put `b` first, and zero for equal; a boolean-returning comparator never returns a negative value
and is therefore wrong. The sort is stable since ES2019, and its complexity is not specified by
the language, so O(n log n) is stated as the assumption every engine meets.

**★ Why does a recursive DFS fail on a long input in Node, and what do you do?**
The recursion depth equals the path length, and V8's call stack is small and implementation-
defined — MDN gives no number and neither should you — so a depth of the order of 10⁵ throws
"Maximum call stack size exceeded". The fix is an explicit stack: push what recursion would have
suspended, loop until it is empty. Java fails the same way with `StackOverflowError`; the
conversion is identical.

**What is the largest integer JavaScript can represent exactly, and what happens beyond it?**
2⁵³ − 1, exposed as `Number.MAX_SAFE_INTEGER`. Beyond it, integers are represented
approximately, so distinct values can compare equal — MDN's example is `MAX_SAFE_INTEGER + 1 ===
MAX_SAFE_INTEGER + 2` being true. The fixes are `BigInt`, or reducing modulo before multiplying
in modular problems. Bitwise operators are separately limited to 32-bit integers.

---

← Prev: [03 · The method](03-the-method.md) · Index: [Phase 0 — The DSA interview and the practice system](README.md) · Next → [04b · Java traps and sorting](04b-java-traps-and-sorting.md)
