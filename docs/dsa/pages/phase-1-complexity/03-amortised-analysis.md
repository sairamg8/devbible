---
title: "Amortised cost is the total over a sequence divided by its length — an array that doubles is constant per push because n pushes cost about 2n copies, and the sentence that makes an interviewer believe the bound is \"each element is pushed once and popped at most once, so the total is n\""
sidebar_label: "03 · Amortised analysis"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. The method — aggregate, accounting and potential — is textbook (CLRS,
> *amortized analysis*) and the union-find bound (inverse Ackermann) is textbook (CLRS, *disjoint
> sets*); neither is quoted. The runtime facts are the JDK 25 javadocs for
> [`ArrayList`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/ArrayList.html),
> [`ArrayDeque`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/ArrayDeque.html),
> [`HashMap`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/HashMap.html) and
> [`StringBuilder`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/StringBuilder.html)
> (verbatim below). MDN states **no** complexity for `Array.prototype.push`; the JavaScript array's
> growth policy is stated as engine behaviour, not a documented guarantee. **No sandbox run.**

**Amortised cost answers a different question from worst case: not "how slow can one operation
be" but "how slow can n of them be, divided by n".** A push onto a dynamic array is occasionally
Θ(n) — the buffer is full and every element is copied — and yet n pushes cost Θ(n) in total,
because the copies happen at sizes 1, 2, 4, 8, … and sum to less than 2n; so the amortised cost
per push is constant, and that is the honest bound to state. The interview form of the idea is a
sentence, not a proof: *"each element is pushed once and popped at most once, so the total work
over the whole loop is at most 2n, and that's linear."* Said of a monotonic stack, a two-pointer
scan, a BFS with a queue, a union-find with path compression, the sentence is what makes the
interviewer write "linear" instead of asking "but there's a while loop inside". This page is the
three textbook methods reduced to the one that works on a whiteboard, the dynamic array with its
javadoc backing, and the sentence for each loop it covers; its sibling
[03b](03b-union-find-and-the-limits-of-amortised.md) is union-find and the two ways the claim goes
wrong — amortised mistaken for worst case when a latency matters, and amortised claimed for a loop
where an element can be visited twice.

## The idea, and the three methods

**Aggregate.** Total cost of any sequence of n operations is T(n); amortised cost is T(n)/n. The
whiteboard method: bound the total, divide.

**Accounting.** Charge each operation a fixed amount; cheap operations overpay and bank credit,
expensive ones spend it; the bank never goes negative. For a doubling array: charge 3 per push —
one to write the element, one to copy it later, one to copy an older element that has already
been moved once. The accounting method is where "each push pays for its own future copy" comes
from.

**Potential.** A function Φ of the structure's state; amortised cost = actual cost + ΔΦ. The
rigorous form of accounting, and the one used for union-find. Not needed on a board.

The three agree; the round needs the aggregate one said as a sentence, and the accounting one
if the interviewer pushes on "why is the copy free?" — "because each element paid for its copy
when it was pushed."

## The dynamic array

A push into a full buffer allocates a new buffer of double the capacity and copies. Copies over
n pushes happen at sizes 1, 2, 4, …, up to n, and 1 + 2 + 4 + … + n < 2n; so n pushes do at most
n writes and 2n copies — Θ(n) total, Θ(1) amortised per push. The javadoc says exactly this:

> *"The `add`, and `addLast` operations runs in amortized constant time, that is, adding n
> elements requires O(n) time."* — JDK 25, `ArrayList`

The two conditions under which the argument holds, and both are asked: the growth must be
*geometric* — doubling, or any constant factor above one; growing by a fixed increment k makes
n pushes cost n²/2k copies, quadratic — and the *shrink* on removal, if any, must be at a
different threshold from the growth (shrink at a quarter full, not at half), or a push–pop
sequence at the boundary copies on every operation.

```ts
// a dynamic array's push, written out — the copy is the occasional Θ(n) that amortises away
export class DynArray<T> {
  private buf: (T | undefined)[] = new Array(4);
  private n = 0;
  push(x: T): void {
    if (this.n === this.buf.length) {
      const bigger = new Array<T | undefined>(this.buf.length * 2); // geometric growth is the whole point
      for (let i = 0; i < this.n; i++) bigger[i] = this.buf[i];      // Θ(n) — but only at sizes 4, 8, 16, …
      this.buf = bigger;
    }
    this.buf[this.n++] = x;
  }
  get(i: number): T { return this.buf[i] as T; }
  get length(): number { return this.n; }
}
// n pushes: at most 4 + 8 + … + n < 2n copies → Θ(1) amortised per push
```

JavaScript's built-in `Array.prototype.push` is the same structure in every major engine, but
MDN documents no complexity for it; say "amortised constant, as a dynamic array" and, if
pressed, that the specification does not promise it. `StringBuilder` is the same argument on
characters:

> *"Every string builder has a capacity. As long as the length of the character sequence
> contained in the string builder does not exceed the capacity, it is not necessary to allocate
> a new internal buffer. If the internal buffer overflows, it is automatically made larger."*
> — JDK 25, `StringBuilder`

And `HashMap`'s rehash is the same shape at the level of buckets — the table doubles when the
entry count exceeds load factor × capacity, so the rehashes over n inserts sum to Θ(n):

> *"When the number of entries in the hash table exceeds the product of the load factor and
> the current capacity, the hash table is rehashed (that is, internal data structures are
> rebuilt) so that the hash table has approximately twice the number of buckets."* — JDK 25,
> `HashMap`

## "Each element is pushed once and popped at most once"

The sentence, and the loops it is true of. The argument is aggregate: the inner loop's total
iterations across the whole run are bounded by the number of elements that can ever be in the
structure, because each is added once and removed at most once.

```ts
// monotonic stack — the while inside the for is Θ(n) TOTAL, not per iteration
export function dailyTemperatures(t: number[]): number[] {
  const out = new Array<number>(t.length).fill(0);
  const stack: number[] = [];                     // indices with decreasing temperatures
  for (let i = 0; i < t.length; i++) {
    while (stack.length && t[stack[stack.length - 1]] < t[i]) {
      const j = stack.pop()!;                     // each index popped at most once
      out[j] = i - j;
    }
    stack.push(i);                                // each index pushed exactly once
  }
  return out;
}
```

The same sentence, adapted:

| Structure | The sentence | Total |
|---|---|---|
| **monotonic stack / queue** | each index pushed once, popped at most once | ≤ 2n |
| **two pointers** | each pointer only advances; each moves at most n | ≤ 2n |
| **sliding window** | `right` advances n times; `left` never retreats | ≤ 2n |
| **BFS with a queue** | each vertex enqueued once (marked on enqueue), each edge examined once | V + E |
| **stack-based DFS** | each vertex pushed once if marked on push; each edge once | V + E |
| **merging k sorted lists with a heap** | each element enters and leaves the heap once, log k each | n log k |
| **the "two stacks" queue** | each element moved from the in-stack to the out-stack once | Θ(1) amortised per op |

The BFS row has a condition worth saying: the vertex is marked *when enqueued*, not when
dequeued — marking on dequeue lets a vertex be enqueued once per incoming edge, and the "once"
in the sentence stops being true.

```java
// Java: the two-stack queue — ArrayDeque's own operations are amortised constant per the javadoc
final class TwoStackQueue<T> {
    private final Deque<T> in = new ArrayDeque<>(), out = new ArrayDeque<>();
    void enqueue(T x) { in.push(x); }
    T dequeue() {
        if (out.isEmpty()) while (!in.isEmpty()) out.push(in.pop()); // each element crosses once
        return out.pop();
    }
}
```

> *"Most `ArrayDeque` operations run in amortized constant time. Exceptions include `remove`,
> `removeFirstOccurrence`, `removeLastOccurrence`, `contains`, `iterator.remove()`, and the
> bulk operations, all of which run in linear time."* — JDK 25, `ArrayDeque`

## Gotchas

**★ Symptom: "there's a while loop inside the for, so it's O(n²)."** Cause: the inner loop's
iterations counted per outer iteration instead of over the whole run. Fix: the sentence — "each
index is pushed once and popped at most once, so the while runs at most n times in total."

**★ Symptom: "push is O(1)" and the interviewer asks "always?"** Cause: amortised stated as
worst case. Fix: "amortised constant — the occasional doubling copies the array, and the
doublings over n pushes sum to under 2n; a single push can be linear."

**Symptom: a dynamic array that grows by a fixed 16 slots, and n pushes are quadratic.** Cause:
arithmetic growth. Fix: geometric — double, or any constant factor above one; the copies then
form a geometric series bounded by a constant times n.

**Symptom: an array that shrinks at half and a push–pop sequence at the boundary copies every
time.** Cause: grow and shrink thresholds coincide. Fix: shrink at a quarter full; the
thresholds are then separated by a factor that a single operation cannot cross.

**Symptom: BFS "linear" with a vertex enqueued once per incoming edge.** Cause: marking on
dequeue. Fix: mark when enqueuing; each vertex enters the queue once and the sentence holds.

**Symptom: the accounting explanation asked for and none given.** Cause: only the aggregate sum
known. Fix: "charge three per push — one to write, one to copy itself later, one to copy an
already-moved element — and the bank never goes negative."

## Interview questions

**★ Why is push onto a dynamic array O(1) when some pushes copy the whole array?**
Because the copies happen only when the buffer is full and the buffer doubles, so over n pushes
the copies happen at sizes 1, 2, 4, …, n and sum to under 2n; the total for n pushes is Θ(n) and
the cost per push, averaged over the sequence, is constant. That is an amortised bound, not a
worst-case one — a single push can be linear. The JDK's `ArrayList` javadoc states it in those
words: amortised constant time, adding n elements requires O(n). The argument needs geometric
growth; growing by a fixed increment makes n pushes quadratic.

**★ How do you convince an interviewer that a loop with a while inside it is linear?**
With the aggregate sentence: each element is pushed exactly once and popped at most once, so
the inner while runs at most n times over the whole function, not n times per outer iteration;
total work is at most 2n. The same sentence, adapted, covers two pointers (each only advances),
the sliding window (`left` never retreats), BFS (each vertex enqueued once when marked on
enqueue) and the two-stack queue (each element crosses once). The check before saying it: can
any element enter the structure twice? If not, the sentence holds.

**What do the accounting and potential methods add to the aggregate argument?**
The aggregate method bounds the total of a sequence and divides. The accounting method assigns
each operation a charge — three per push on a doubling array: one to write, one to pay for its
own later copy, one for an already-moved element's copy — and shows the bank of prepaid credit
never goes negative, which explains *why* the expensive operation is free. The potential method
generalises that with a function of the structure's state, and is what the union-find proof
uses; on a whiteboard, the aggregate sentence and, if pushed, the accounting one.

**Why must BFS mark a vertex when it is enqueued rather than when it is dequeued?**
Because the linear bound rests on each vertex entering the queue once. Marked on dequeue, a
vertex with k incoming edges can be enqueued k times before it is first processed — the queue
work becomes Θ(E) and the visited check has silently moved; the traversal is still correct, and
still Θ(V + E) overall, but the "each vertex once" sentence is false and the queue can hold more
than V entries. Marking on enqueue keeps the sentence true and the queue bounded by V.

---

← Prev: [02b · Recursion as a tree](02b-recursion-as-a-tree.md) · Index: [Phase 1 — Complexity analysis](README.md) · Next → [03b · Union-find, and the limits of amortised](03b-union-find-and-the-limits-of-amortised.md)
