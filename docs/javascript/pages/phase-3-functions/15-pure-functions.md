---
title: "15 · Pure functions and side effects"
sidebar_label: "15 · Pure functions and side effects"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Object.freeze()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze), [`Array.prototype.toSorted()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted), [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort), [`Array.prototype.with()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/with), [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone), [`Math.random()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random). Documentation-validated; **no timings**.

**A pure function has two properties**, and both are needed:

> 1. **Same arguments, same result** — every time, forever.
> 2. **No observable effect** beyond the value it returns.

Everything else in this topic follows from those two lines. **Purity is not a moral position
about how to write JavaScript** — it is a property that buys specific, nameable things, and the
useful skill is knowing which things and where to give them up.

## What counts as a side effect

Wider than most people first say. A function is impure if it does any of these:

- **Mutates an argument**, or anything reachable from one.
- **Reads or writes anything outside itself** — a module-level `let`, `this`, a DOM node,
  `localStorage`, a global counter.
- **Performs I/O** — network, disk, `console.log`.
- **Reads ambient state** — `Date.now()`, `Math.random()`, `document.title`, `process.env`.
- **Throws depending on something other than its arguments.**

🔴 **Reading impure input is as disqualifying as writing impure output**, and this is the half
people miss:

```js
const isExpired = (token) => token.exp < Date.now();     // ⚠️ impure — reads the clock
const isExpired = (token, now) => token.exp < now;       // ✅ pure — now is an argument
```

The second is not ceremony. It is the difference between a function you can test with a fixed
`now` and one whose test either mocks the global clock or is flaky.

**`console.log` is technically a side effect** and practically nobody cares — the honest position
is that logging is an effect you tolerate because it is not *observable to the program*. Say
that rather than pretending it is pure; it shows you know the definition and can apply judgement
to it.

## What purity actually buys

Four things, and it is worth being able to name them rather than saying "it's cleaner":

**Testability.** A pure function needs no mocks, no setup, no teardown, no fake timers — the
test is `expect(f(input)).toEqual(output)`. This is the biggest practical win by a distance, and
it is why the argument-not-ambient rule above matters so much.

**Cacheability.** Memoization is *only correct* on a pure function
([13 · Memoization](./13-memoization.md)). Purity is the precondition, and an impure function
memoized freezes its first answer forever.

**Reorderability and parallelism.** Pure calls have no dependency on each other beyond their
data, so they can be reordered, batched, or run concurrently. It is also why a pure function is
safe to call twice — which matters more than it sounds, because React's StrictMode does exactly
that in development specifically to surface impure renders.

**Local reasoning.** You can understand the function by reading the function. An impure one
requires knowing what else touched the state it reads — which is unbounded work in a large
codebase.

## Mutation is the side effect you will actually ship

Argument mutation is the common case in real code, and JavaScript's built-ins historically make
it easy to do by accident, because **some array methods mutate and some do not**:

```js
const sorted = items.sort((a, b) => a.price - b.price);   // ⚠️ sorted IS items, reordered
```

`sort` sorts **in place** and returns the same array — so a "sorted copy" that shares the
reference has quietly reordered the caller's data. `reverse`, `splice`, `push`, `pop`, `shift`,
`unshift` and `fill` are the same story.

🔴 **ES2023 added non-mutating counterparts, and they are the fix**: `toSorted()`,
`toReversed()`, `toSpliced()` and `with()` each return a **new array** and leave the original
alone. `items.toSorted(cmp)` is the one-word answer to the bug above, and knowing these exist is
a current, checkable piece of knowledge rather than folklore.

Where a counterpart does not exist, copy first — `[...items].sort(cmp)`, `{ ...user, name }`.

⚠️ **Both of those are shallow.** `{ ...user }` copies the top level; `user.address` is still the
same object, so mutating it mutates the original. For a deep copy MDN documents
`structuredClone()`, which handles cycles and many built-in types — and **throws on functions,
DOM nodes and property descriptors**, so it is not universal.

**`Object.freeze` is also shallow**, and MDN is explicit about that: it prevents adding,
removing and reconfiguring the object's own properties, but a nested object stays mutable. And
it fails *silently* in sloppy mode while throwing a `TypeError` in strict mode — which, since
module code is always strict, means the throw is what you will actually see.

## Where the impurity is supposed to live

The useful design rule is not "make everything pure" — it is **push effects to the edges**.

> Keep a pure core: decisions, calculations, transformations.
> Keep a thin impure shell: I/O, the DOM, the clock, randomness, storage.

```js
// impure shell — knows about the network and the clock
async function checkout(cartId) {
  const cart = await api.getCart(cartId);
  const totals = computeTotals(cart, Date.now());     // 🔴 pure core, clock injected
  await api.submit(totals);
}

// pure core — the whole test suite lives here
export const computeTotals = (cart, now) => { /* … */ };
```

Every interesting rule — pricing, validation, eligibility, formatting — is in `computeTotals`,
which is trivially testable. The shell has almost no logic to get wrong, so it needs few tests
and those tests are the integration ones you would want anyway.

🔴 **The tell that you have the split right: the hard-to-test part is boring.** If mocking is
painful, it is usually because a decision is trapped inside an effectful function and wants
extracting.

**Injecting ambient state as a parameter** is the mechanical version of this — `now`, a random
source, an id generator. It looks fussy and it is what makes deterministic tests possible.
MDN notes `Math.random()` does not provide cryptographically secure randomness, so anything
security-relevant wants `crypto.getRandomValues()` — but for purity the point is the same:
whichever source, pass it in.

## Idempotent, deterministic, pure — three different words

Worth separating, because interviews use them loosely:

- **Deterministic** — same input, same output. Half of purity.
- **Pure** — deterministic *and* no side effects.
- **Idempotent** — doing it twice has the same effect as doing it once. This is about
  *effects*, so it applies to impure operations: `DELETE /cart/1` is idempotent and not pure;
  `cart.items.push(x)` is neither.

**Every pure function is trivially idempotent in its effects** (it has none), but the words are
not interchangeable, and the distinction is the whole basis of retry-safety in an API.

## Gotchas

**Symptom:** A "sorted copy" reordered the original array
**Cause:** `sort` sorts in place and returns the same reference.
**Fix:** `toSorted()`, or `[...items].sort()`.

**Symptom:** A spread copy still shares nested data
**Cause:** Spread and `Object.assign` are shallow.
**Fix:** Copy the nested level too, or `structuredClone()` — which throws on functions and DOM nodes.

**Symptom:** `Object.freeze` did not prevent a mutation
**Cause:** It is shallow — nested objects stay mutable.
**Fix:** Freeze recursively, or do not rely on freezing for deep immutability.

**Symptom:** A frozen object's assignment silently did nothing
**Cause:** Sloppy mode ignores it; strict mode throws a `TypeError`.
**Fix:** Modules are always strict, so you will see the throw — do not test this in a sloppy console.

**Symptom:** A test needs fake timers to be deterministic
**Cause:** The function reads `Date.now()` rather than taking it.
**Fix:** Pass `now` as an argument; keep the clock in the shell.

**Symptom:** Memoization returns a stale answer
**Cause:** The function was not pure — the result depended on something outside the arguments.
**Fix:** Do not memoize it; purity is the precondition.

**Symptom:** A function behaves differently when React calls it twice
**Cause:** StrictMode double-invokes in development to surface impure renders.
**Fix:** That is the bug being reported, not a React problem — remove the effect from the render path.

**Symptom:** The interesting logic is unreachable without mocking the network
**Cause:** A decision is trapped inside an effectful function.
**Fix:** Extract the decision into a pure function that takes data and returns data.

## Interview questions

**★ What makes a function pure?**
Same arguments produce the same result every time, and it has no observable effect beyond its
return value. Both halves are required.

**★ Give a side effect people forget.**
*Reading* ambient state — `Date.now()`, `Math.random()`, `process.env`, a module-level `let`.
Reading impure input breaks purity just as surely as writing impure output, and it is the half
that makes a function untestable without mocks.

**★ What does purity actually buy?**
Testability without mocks, correct memoization, safe reordering and repeat calls, and local
reasoning. Naming the four is better than "it's cleaner".

**★ Which array methods mutate?**
`sort`, `reverse`, `splice`, `push`, `pop`, `shift`, `unshift`, `fill`. ES2023 added
non-mutating counterparts — `toSorted`, `toReversed`, `toSpliced` and `with` — which return a
new array. `arr.sort()` returning the *same* array is the bug people actually ship.

**★ Is `Object.freeze` deep?**
No. It stops adding, removing and reconfiguring the object's own properties; nested objects
remain mutable. It also fails silently in sloppy mode and throws in strict mode — and module
code is always strict.

**★ Where should side effects live?**
At the edges. A pure core holds every decision and calculation; a thin impure shell does I/O,
the DOM, the clock and storage. The tell that the split is right is that the hard-to-test part
has no interesting logic left in it.

**★ Pure versus idempotent?**
Pure is about the *function* — deterministic and effect-free. Idempotent is about the *effect* —
doing it twice is the same as doing it once, which is why it applies to impure operations like
`DELETE`. Not interchangeable.

**How would you make an impure function testable without changing its behaviour?**
Inject what it reads. Take `now`, the random source, or the id generator as parameters with
sensible defaults — the call sites stay unchanged and the tests become deterministic.

---

← [14 · Recursion](./14-recursion.md) · [Phase index](./README.md) · **16 · There is no function overloading** *(not written yet)* →
