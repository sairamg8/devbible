---
title: "A bound is read off code in three moves — count the loops and what each one's variable does, count the work inside the innermost, and expand the recursion into a tree — and the loop that looks quadratic is linear whenever each element enters and leaves once"
sidebar_label: "02 · Reading complexity off code"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. Method, with textbook backing (CLRS, *growth of functions* and
> *recurrences*); the two runtime facts — `Array.prototype.includes` compares element by element
> with SameValueZero, and `Set.prototype.has` is on average faster than `includes` at equal size —
> are MDN ([`includes`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes),
> [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set),
> verbatim below). Solutions are TypeScript first, Java second. **No sandbox run; no timings.**

**The bound is in the code, and it is read, not recalled. Three moves cover almost every
function an interview produces: count the loops and ask what each loop's variable does per
iteration — steps by one, doubles, halves, or jumps to a computed position; count the work in
the innermost body, including every built-in it calls; and for recursion, draw the tree — how
many calls at each level, how much work each does, how deep it goes — and sum it.** The move
candidates miss is the second question inside the first: a nested loop is Θ(n²) only when the
inner loop's variable *restarts*; when it continues from where it stopped, the two loops together
do Θ(n) work, because each element is entered and left once. That single observation is the
whole complexity story of two pointers, sliding windows and the monotonic stack, and it is the
observation an interviewer is waiting for when the code has two loops and the candidate says
"quadratic". This page is the two loop moves with code for each, the amortised-in-disguise loops, and the
sentence that states the bound with the line that sets it; the third move — recursion as a tree — is
its sibling [02b](02b-recursion-as-a-tree.md).

## Move 1 — loops, and what the variable does

| The loop variable | Iterations | Example |
|---|---|---|
| steps by 1 from 0 to n | n | a scan |
| steps by k | n / k → Θ(n) | every k-th element |
| doubles (i = i · 2) or halves (n = n / 2) | log n | binary search, exponentiation by squaring |
| grows by squaring (i = i · i) | log log n | rare; sieve-style tricks |
| jumps to a computed position (i = next[i]) | depends — count visits per element | union-find, linked structures |
| nested, inner restarts at 0 each time | n · m | pairs, matrix |
| nested, inner runs from i to n | n²/2 → Θ(n²) | all pairs once |
| nested, inner **continues** where it stopped | Θ(n + m) total | two pointers, sliding window |

Two nested loops is not a class; it is a question — *does the inner variable restart?*

```ts
// Θ(n²): j restarts at i + 1 for every i — every pair is visited
export function hasDuplicatePair(nums: number[]): boolean {
  for (let i = 0; i < nums.length; i++)
    for (let j = i + 1; j < nums.length; j++)
      if (nums[i] === nums[j]) return true;
  return false;
}

// Θ(n): two loops, but `right` never moves backwards — each element enters the window once
// and leaves once, so the inner while runs at most n times over the WHOLE function.
export function longestWithoutRepeat(s: string): number {
  const last = new Map<string, number>();
  let left = 0, best = 0;
  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    const seen = last.get(ch);
    if (seen !== undefined && seen >= left) left = seen + 1; // the window's left edge only advances
    last.set(ch, right);
    best = Math.max(best, right - left + 1);
  }
  return best;
}
```

The second function is the shape to recognise: an outer loop over `right`, an inner adjustment
of `left` that only ever increases. Total work is bounded by the total distance both pointers
travel — at most n each — so Θ(n) regardless of how the moves are distributed.

## Move 2 — the work inside the innermost body

Every statement inside the innermost loop multiplies. Constant-time statements are constant;
built-ins are what they cost, and the cost is a fact about the library, not the pattern:

```ts
// looks linear — one loop; IS quadratic — includes() scans the array on every iteration
export function firstDuplicateSlow(nums: number[]): number | undefined {
  const seen: number[] = [];
  for (const x of nums) {
    if (seen.includes(x)) return x;   // Θ(k) at the k-th element → Θ(n²) overall
    seen.push(x);
  }
  return undefined;
}

// Θ(n): the same loop, Set.has instead of Array.includes
export function firstDuplicate(nums: number[]): number | undefined {
  const seen = new Set<number>();
  for (const x of nums) {
    if (seen.has(x)) return x;        // expected Θ(1)
    seen.add(x);
  }
  return undefined;
}
```

MDN states the mechanism and the contrast, which is why the second is the answer and the
first is the trap:

> *"The `includes()` method compares `searchElement` to elements of the array using the
> SameValueZero algorithm."* — MDN, `Array.prototype.includes`

> *"The `has` method checks if a value is in the set, using an approach that is, on average,
> quicker than testing most of the elements that have previously been added to the set. In
> particular, it is, on average, faster than the `Array.prototype.includes` method when an array
> has a `length` equal to a set's `size`."* — MDN, `Set`

Other multipliers hiding in a body: `slice`, `splice`, spread `[...arr]`, `indexOf`, string
concatenation `s += ch`, `Array.from`, `sort` inside a loop, `Object.keys`, `shift` from the
front. Each is a Θ(k) operation dressed as a token. **06 · Hidden costs** *(not written yet)*
and **07 · Complexity of the built-ins** *(not written yet)* are the lists; the reading rule
is: *a method call inside a loop is a loop inside a loop until proven otherwise.*

```java
// Java: the same trap — contains on a List is a scan, on a HashSet a hash lookup
static int firstDuplicateSlow(int[] nums) {
    List<Integer> seen = new ArrayList<>();
    for (int x : nums) {
        if (seen.contains(x)) return x;   // ArrayList.contains: linear ("roughly speaking", JDK javadoc)
        seen.add(x);
    }
    return -1;
}
static int firstDuplicate(int[] nums) {
    Set<Integer> seen = new HashSet<>();
    for (int x : nums) {
        if (!seen.add(x)) return x;       // add returns false if present — one lookup, not two
    }
    return -1;
}
```

## The loop that looks quadratic but is linear

The observation that separates a candidate who reads from one who pattern-matches. A nested
loop is Θ(n) when the inner loop's total iterations, *summed over the whole run*, are bounded by
n — which happens whenever each element can enter and leave a structure at most once.

**Two pointers.** Both indices only move forward; total moves ≤ 2n.

**Sliding window.** `right` advances n times; `left` advances at most n times in total.

**Monotonic stack.** Each element is pushed once and popped at most once, so the inner
`while (stack not empty and top < x) pop` runs at most n times across the entire loop:

```ts
// next greater element — Θ(n), though there is a while inside the for
export function nextGreater(nums: number[]): number[] {
  const out = new Array<number>(nums.length).fill(-1);
  const stack: number[] = [];                    // indices, values decreasing from bottom to top
  for (let i = 0; i < nums.length; i++) {
    while (stack.length && nums[stack[stack.length - 1]] < nums[i]) {
      out[stack.pop()!] = nums[i];               // each index is popped at most once — total pops ≤ n
    }
    stack.push(i);                               // each index is pushed exactly once
  }
  return out;
}
```

**Union-find with path compression.** `find` follows parent pointers; the amortised bound is
near-constant per operation, and the argument is the same "total work over all operations"
shape — **03 · Amortised analysis** *(not written yet)* is the page.

The sentence for all of these: *"Two loops, but the inner one's work is bounded across the whole
run — each element is pushed and popped at most once — so it's linear total, not linear per
iteration."* The words "across the whole run" are what tell the interviewer you are counting
rather than guessing.

## The loop that looks linear but is not

The mirror: one loop, with a cost hidden in the body or in the loop variable.

- `for (const x of nums) result = result.concat([x])` — each `concat` copies; Θ(n²).
- `while (queue.length) { const x = queue.shift(); … }` — `shift` moves every remaining element
  left by one (MDN: *"shifts all values to the left by 1"*); Θ(n²) for a BFS that should be
  Θ(n). Use an index into the array, or a deque.
- `for (let i = 0; i < n; i++) s += chars[i]` — string building; engines optimise many cases,
  but the cost is not guaranteed constant; a `join` on an array is the safe Θ(n).
- `for (const key of Object.keys(obj))` inside another loop over keys — Θ(k²) when the keys are
  the same set.
- `for (let i = 1; i <= n; i *= 2)` — looks like a scan, is Θ(log n); the mirror of the mirror.

## Saying it, with the line that sets it

After the code, unprompted: *"Time Θ(n): the for on line 4 runs n times and the while inside it
runs at most n times total because each index is popped once — line 6. Space Θ(n) for the stack
in the worst case, a strictly decreasing input."* The line numbers are the evidence that the
bound was read; "it's a monotonic stack so it's linear" is the pattern's name, and names are not
graded.

## Gotchas

**★ Symptom: "two loops, so O(n²)" for a sliding window.** Cause: the inner variable's behaviour
not asked. Fix: does it restart or continue? If it only advances, total inner work is ≤ n and
the function is Θ(n); say "across the whole run".

**★ Symptom: "one loop, so O(n)" with `includes` or `indexOf` inside it.** Cause: a built-in
read as a token. Fix: every method call in a body is a loop until proven otherwise; `Set.has`
or a map lookup makes it linear, and MDN's sentence on `has` versus `includes` is the citation.

**Symptom: BFS written with `queue.shift()`, and the large test times out.** Cause: `shift` is a
left-shift of the whole array. Fix: an index pointer into the array (`head++`) or a real deque;
the queue is then Θ(n) total.

**Symptom: the monotonic stack explained as "amortised O(1)" and the interviewer asks "why?"**
Cause: the word without the argument. Fix: "each index is pushed once and popped at most once,
so the pops over the whole loop are at most n" — the argument, in one sentence.

**Symptom: a halving loop called linear.** Cause: the variable's step unread. Fix: `i *= 2` or
`n = n >> 1` is log n iterations; say which variable halves.

**Symptom: Θ(n) claimed for a nested loop where the inner one restarts at i + 1.** Cause:
"upper triangle" mistaken for a two-pointer shape. Fix: n(n − 1)/2 iterations is Θ(n²); the
inner variable restarts, so the two-pointer argument does not apply.

**Symptom: the bound stated without a line number.** Cause: pattern named, code not read. Fix:
"the loop on line 4, the pop on line 6" — the line that sets each bound.

## Interview questions

**★ Why is a sliding window linear when it has two loops?**
Because the inner loop's variable never moves backwards. `right` advances once per outer
iteration — n times — and `left` only ever increases, so it advances at most n times over the
whole run; total work is bounded by the distance both pointers travel, at most 2n. Nested loops
are quadratic only when the inner variable restarts; when it continues, the loops share a
budget. The same argument gives two pointers and the monotonic stack.

**★ Why is the monotonic stack's inner while not a nested loop in the complexity sense?**
Because its total iterations across the whole function are bounded by n: every index is pushed
exactly once and can be popped at most once, so the while runs at most n times in total, not n
times per outer iteration. The bound is Θ(n) for the loop, with Θ(n) stack space in the worst
case — a strictly decreasing input, where nothing is popped until the end.

**Why does `includes` inside a loop make a linear-looking function quadratic, and what is the
citation?**
`includes` compares the search element to the array's elements one by one — MDN describes the
comparison as SameValueZero over the elements — so at the k-th iteration it does Θ(k) work,
summing to Θ(n²). A `Set` gives sublinear-by-spec, hash-table-in-practice lookups, and MDN says
`Set.prototype.has` is on average faster than `Array.prototype.includes` at equal size. The
reading rule: a method call inside a loop is a loop inside a loop until proven otherwise.

**A BFS is written with `queue.shift()`. What is its complexity, and how do you fix it?**
Θ(n²) in the worst case: `shift` removes the first element by shifting every remaining element
left by one, so each dequeue is linear in the queue's length. Replace it with an index pointer
into the array — `const x = queue[head++]` — which is Θ(1) per dequeue and leaves the traversal
at Θ(V + E); or use a deque. In Java, `ArrayDeque` is the queue, and its javadoc says most
operations run in amortised constant time.

---

← Prev: [01 · Big-O, Theta and Omega](01-big-o-theta-and-omega.md) · Index: [Phase 1 — Complexity analysis](README.md) · Next → [02b · Recursion as a tree](02b-recursion-as-a-tree.md)
