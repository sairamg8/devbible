---
title: "How a narrowing dies"
sidebar_label: "01 · How a narrowing dies"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. The reassignment and callback
> results below are **sandbox-measured** in
> `sandbox/ts-p2/ex2-guards-and-loss.sh` by the assign-to-`1` technique; that run
> saved no output file, so the findings are stated in prose and this page carries
> **no console block**. `TS18047` — *"'{0}' is possibly 'null'."* — was read out
> of the compiler's own diagnostic table (⚠️ TypeScript **6.0.3**, not 7.0.2),
> and matches the code the recorded run reported. Behaviour otherwise validated
> against the **TypeScript handbook** (*Narrowing → Control flow analysis*).

Every page in this phase so far has been about **creating** a narrowing. This one
is about the question that actually gets asked in code review:

> *"I checked it three lines ago. Why is it possibly `undefined` again?"*

The answer is never "TypeScript is being awkward". It is always that something
between the check and the use could have changed what the reference points at —
and the compiler noticed, even though you did not.

## The model: narrowing belongs to a reference, not to a value

Control flow analysis does not track *values*. It tracks **references** — a
variable name, or a path like `obj.a.b` — and it keeps a narrowed type for each
one along each path through the code.

A narrowing therefore lasts exactly as long as the compiler can be sure the
reference still denotes what it denoted at the check. Three things end that:

1. **The reference is reassigned.**
2. **The code moves somewhere the compiler cannot order relative to the check** —
   the inside of a callback.
3. **The reference is a path through something mutable, and the mutation is
   visible.**

Everything in this topic is one of those three. Learn the model and you stop
needing to memorise the cases.

## Loss 1 — reassignment

The simplest one, and the only one that is entirely unsurprising once you see it:

```ts
declare let v: string | number;

if (typeof v === 'string') {
  v.toUpperCase();       // string
  v = 42;
  v.toUpperCase();       // error — v is number here
}
```

**Sandbox-measured:** assigning `v = 42` inside a `typeof v === 'string'` branch
and then revealing the type shows **`number`** for the rest of the branch. The
compiler re-narrows on the assignment rather than clinging to the `if`.

This is CFA working correctly and it is worth stating plainly, because people
sometimes read it as a failure. The narrowing was never a fact about the branch;
it was a fact about the reference at each point in the branch.

The variant that actually bites is the loop:

```ts
declare let current: Node | null;

while (current) {
  visit(current);        // Node
  current = current.next; // now Node | null again
}                        // next iteration re-checks — fine
```

Here it is fine because the check is the loop condition. Move the check outside
the loop and the assignment inside it, and every iteration after the first is
unchecked — which the compiler will tell you about, and which is a real bug it
is catching, not an inconvenience.

## Loss 2 — callbacks

**This is the one that generates the code-review question**, and it is
sandbox-measured:

```ts
declare let value: string | null;

if (value !== null) {
  [1, 2, 3].forEach(() => {
    value.length;        // error
  });
}
```

```text
error TS18047: 'value' is possibly 'null'.
```

**Measured in `ex2`:** exactly one `TS18047`, on the `forEach` line. The
narrowing from the enclosing `if` did not reach inside the arrow function.

### Why

The compiler analyses the callback's body as **a separate flow that could run at
any time**. It has no idea whether `forEach` invokes it now, later, once, never,
or after something else has reassigned `value`. `forEach` happens to call it
synchronously and immediately — but that is a fact about the *implementation of
`forEach`*, and nothing in the type of `forEach` communicates it. There is no
"calls its argument before returning" annotation in TypeScript.

So the compiler falls back to the declared type of `value` at the point the
closure is created.

### Why `const` fixes it

```ts
declare let value: string | null;

if (value !== null) {
  const v = value;       // v: string
  [1, 2, 3].forEach(() => {
    v.length;            // fine, forever
  });
}
```

A `const` binding **cannot be reassigned**, so "when does the callback run?"
stops being a question the compiler needs to answer. Whenever it runs, `v` is
still what it was, so the narrowing is safe to carry inside.

**That single line — capture the narrowed value in a `const` — is the fix for
the overwhelming majority of "it lost my narrowing" reports.** It costs one
identifier and it is not a workaround; it is the code saying what you meant.

## The rule to carry

> **A narrowing crosses into a nested function only when the binding cannot
> change.**

Which in practice means: `const` yes, `let` no. The check is about the
*binding*, not about the type — a `const` holding a mutable object still has its
*properties* invalidated by the rules in
[chunk 02](./02-the-surprising-cases.md); what `const` guarantees is only that
the name keeps pointing at the same thing.

## The shapes this hides in

The `forEach` example is deliberately obvious. In real code the closure is
usually not called a closure:

```ts
if (user !== null) {
  items.map(i => i.owner === user.id);        // callback
  setTimeout(() => save(user), 1000);         // callback
  promise.then(() => notify(user.email));     // callback
  button.onclick = () => open(user);          // callback
  useEffect(() => { track(user.id); }, []);   // callback
}
```

Every one of those is the same failure, and in every one the fix is the same
`const` capture above the block. React code hits this constantly, because almost
everything in a component body is a callback that outlives the render it was
created in.

## What this is *not*

⚠️ **It is not a soundness guarantee.** The compiler is not proving your callback
is safe; it is refusing to assume something it cannot check. In the `forEach`
case the code was actually fine and TypeScript complained anyway — a false
positive.

That matters for how you respond to it. The right reaction is a `const` capture,
which is honest. The wrong reactions are a non-null `!`
([13](../13-non-null-assertion.md)) or an `as`
([08](../08-as-assertions/README.md)), which silence the same message in the
cases where it was *right* — and there is nothing at the call site to tell you
which case you are in.

## Gotchas

**Symptom:** `TS18047: 'x' is possibly 'null'` inside a `map`/`forEach`/`then`
after an outer null check
**Cause:** The narrowing does not cross into a nested function for a mutable
binding.
**Fix:** `const x2 = x;` immediately after the check, and use `x2` inside.

**Symptom:** The same code is fine when the variable is a `const`
**Cause:** That is the rule — a `const` binding cannot change, so the narrowing
is safe to carry in.
**Fix:** Nothing to fix. Prefer `const` for anything you narrow.

**Symptom:** A narrowing disappears halfway down a branch
**Cause:** The variable was reassigned in between; the compiler re-narrows from
the assigned value.
**Fix:** Read the assignment — this is usually a real bug being reported, not a
false positive.

**Symptom:** A `while` loop body complains on the second use of a variable it
just checked
**Cause:** The variable is reassigned inside the loop, so the check no longer
covers the rest of the iteration.
**Fix:** Re-check inside the loop, or restructure so the check is the loop
condition.

**Symptom:** `!` makes the callback error go away and something still crashes
**Cause:** `!` silences the message in both the false-positive and the
true-positive case, and they look identical.
**Fix:** Use the `const` capture. It is the same number of characters and it
cannot lie.

## Interview questions

**★ Why does a null check not survive into a `forEach` callback?**
Because the compiler analyses the callback as a flow that could run at any time,
and nothing in `forEach`'s type says it calls its argument synchronously. If the
variable is a mutable binding, it could have been reassigned before the callback
runs, so the narrowing is dropped and you get `TS18047`. Capturing the value in a
`const` first fixes it, because a `const` cannot be reassigned.

**★ What is the general rule for when a narrowing survives?**
A narrowing belongs to a *reference*, and it lasts until the compiler sees
something that could change what that reference denotes: a reassignment, a
nested function whose execution time is unknown, or a mutation of a path through
a mutable object. `const` removes the first two for a local.

**Is losing the narrowing in a callback a bug in TypeScript?**
No, but it is a deliberate false positive. `forEach` really does call its
argument immediately, so the code was safe; the type system has no way to express
"calls this now", so it refuses rather than assumes. The honest response is a
`const` capture, not `!`.

**Why is `const` the fix rather than an assertion?**
Because it changes the fact rather than the report. `!` and `as` suppress the
message in the cases where it was correct as well as the cases where it was not,
and nothing at the call site distinguishes them. A `const` capture makes the
narrowing genuinely valid.

---

← [Topic index](./README.md) · Next → [02 · The cases that surprise you](./02-the-surprising-cases.md)
