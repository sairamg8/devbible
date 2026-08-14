---
title: "The non-null assertion `!`"
sidebar_label: "13 · Non-null assertion `!`"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08. `TS2564` (*"Property '{0}' has no initializer and is not
> definitely assigned in the constructor."*), `TS1255` (*"A definite assignment
> assertion '!' is not permitted in this context."*), `TS8013` and `TS18047` were
> read out of the **TypeScript compiler's own diagnostic table**, not recalled.
> ⚠️ Compiler inspected: TypeScript **6.0.3**, not the 7.0.2 this corpus targets.
> Behaviour otherwise validated against the **handbook** (*Everyday Types →
> Non-null Assertion Operator*). **No console block** — no recorded run covers
> this topic.

The last page of the phase, and deliberately the shortest, because the honest
summary is one line:

> **`!` is `as NonNullable<T>` with better syntax and the same total absence of
> checking.**

```ts
declare const el: HTMLElement | null;

el!.focus();          // compiles
el.focus();           // TS18047: 'el' is possibly 'null'.
```

It removes `null` and `undefined` from the type at that expression, does nothing
at runtime, and is erased along with every other type-layer construct
([Phase 0 · Erasure](../phase-0-how-typescript-runs/02-erasure.md)). `el!.focus()`
emits `el.focus()`. If `el` is `null`, you get the `TypeError` you were going to
get anyway — the only thing that changed is that nobody was warned.

## Why it belongs at the end of this phase

Because **the majority of `!` in real code is a narrowing that was lost**, and
losing narrowings is [topic 11](./11-narrowing-lost/README.md).

```ts
if (user !== null) {
  items.forEach(() => {
    save(user!.id);          // ← the ! is here because the narrowing did not
  });                        //   cross into the callback
}
```

The `!` works, and it also permanently disconnects this line from the check
above it. If someone later moves the callback, or makes `user` reassignable
inside the block, the `!` keeps compiling and starts being wrong. The `const`
capture costs one line and cannot:

```ts
if (user !== null) {
  const u = user;
  items.forEach(() => save(u.id));
}
```

**Reading `!` as "the narrowing broke here" is the most useful habit in this
topic.** Nine times in ten, fixing the narrowing is available, shorter to reason
about, and correct under later edits.

## When it is legitimate

There is a real category: **you know something the compiler cannot express**, and
the alternative is noise rather than safety.

```ts
// 1. A DOM element you control and ship in the same file as its markup.
const root = document.getElementById('app')!;

// 2. A key you just put in the map.
cache.set(id, value);
const back = cache.get(id)!;          // Map.get is T | undefined, always

// 3. A regex you wrote, with a group you know matched.
const m = /(\d{4})-(\d{2})/.exec(s);
if (m) { const year = m[1]!; }        // under noUncheckedIndexedAccess
```

All three share the shape that makes an assertion defensible: **the guarantee is
local, visible in the same few lines, and would be checked by a test the moment
it broke.** Case 1 fails loudly and immediately on the first page load if the
element is missing — which is a fine way for a build-time invariant to fail.

Compare that with `apiResponse.data!.items!` — where the guarantee lives on
another machine, is not visible anywhere in the file, and fails in production for
one user.

## The other `!` — definite assignment

The same character means something different on a declaration:

```ts
class Service {
  private client!: HttpClient;         // assigned in init(), not the constructor

  init(c: HttpClient) { this.client = c; }
}

let config!: Config;                   // assigned by a setup hook
```

Without it:

```text
error TS2564: Property 'client' has no initializer and is not definitely
assigned in the constructor.
```

This is the **definite assignment assertion**, and it is a promise about
*initialisation order* rather than about a single expression. It is legitimate
for genuine framework-driven lifecycles — dependency injection, a test fixture
assigned in `beforeEach` — where the compiler cannot see the assignment because
it happens through a mechanism it does not model.

It is not legitimate as a way past `strictPropertyInitialization` on a field
that simply might not be set. If the field can genuinely be absent, the honest
type is `Client | undefined`, and every reader then has to acknowledge it.

The compiler restricts where it can go:

```text
error TS1255: A definite assignment assertion '!' is not permitted in this
context.
```

And, for completeness, `!` is TypeScript-only syntax — in a `.js` file checked
with `// @ts-check` you get `TS8013: Non-null assertions can only be used in
TypeScript files.` Optional chaining is the JavaScript-compatible tool.

## The honest alternatives, in order of preference

1. **Fix the narrowing.** A `const` capture, an early return, or a discriminated
   union ([05](./05-discriminated-unions.md)).
2. **Optional chaining and `??`** — `el?.focus()`, `name ?? 'anonymous'`. These
   are *runtime* behaviour, not claims: they handle the null case rather than
   denying it.
3. **A guard clause** — `if (!el) throw new Error('#app is missing');`. One extra
   line, and now the failure names itself instead of arriving as
   `Cannot read properties of null`.
4. **An assertion function** ([09](./09-assertion-functions/README.md)) when the
   same invariant is asserted in several places.
5. **`!`** — when the invariant is local, visible, and cheap to verify.

Options 2 and 3 are the ones people skip. A guard clause converts a mystery
`TypeError` into a sentence naming what was missing, which is worth far more than
the character it costs.

## Where it silently does nothing

⚠️ **With `strictNullChecks` off, `!` is meaningless** — `null` and `undefined`
are already assignable everywhere, so there is nothing to strip. A codebase that
is full of `!` and has `strict` disabled has decoration, not assertions. Turning
`strict` on later is when they all start mattering at once, and by then nobody
remembers which were load-bearing.

⚠️ **`a?.b!.c` is confusing and usually wrong.** The `?.` says "this might be
absent", the `!` says "it is not". Written together they cancel out visually
while behaving asymmetrically. Pick one.

## Trade-off

**`!`** is short, needs no restructuring, and reads as intent when the invariant
is genuinely local. It costs you every future guarantee: it does not re-check
when the code around it moves, it is invisible in review because it is one
character, and it produces the same runtime failure as no check at all.

**`?.`/`??`** cost a runtime branch and handle the case honestly.

**Fixing the narrowing** costs a line and is the only option that makes the
compiler agree with you rather than stand aside.

## Gotchas

**Symptom:** `!` scattered through a block that starts with a null check
**Cause:** The narrowing was lost — usually a callback ([11](./11-narrowing-lost/README.md)).
**Fix:** `const` capture after the check. Delete the assertions.

**Symptom:** `TS2564: Property 'x' has no initializer and is not definitely
assigned in the constructor`
**Cause:** `strictPropertyInitialization`, with the field assigned elsewhere.
**Fix:** `x!: T` if a framework really does assign it; `x?: T` or
`x: T | undefined` if it might genuinely be absent. Do not use `!` to dodge the
question.

**Symptom:** `!` compiles but the value is still `null` at runtime
**Cause:** That is the design — it is erased and checks nothing.
**Fix:** A guard clause, so the failure names itself.

**Symptom:** `TS8013: Non-null assertions can only be used in TypeScript files`
**Cause:** `!` in a `.js` file under `// @ts-check`.
**Fix:** `?.`, or a real check.

**Symptom:** Removing `!` from an old codebase produces hundreds of errors at
once
**Cause:** `strictNullChecks` was off while they were written, so none of them
were ever meaningful.
**Fix:** Enable strictness per-file or per-directory and work through it; the
errors are pre-existing bugs surfacing, not new ones.

**Symptom:** `arr[0]!` needed everywhere after enabling a flag
**Cause:** `noUncheckedIndexedAccess` adds `| undefined` to every index access.
**Fix:** `!` is defensible right after a length check; better, destructure or
use `.at()` with a real check.

## Interview questions

**★ What does `!` actually do?**
It removes `null` and `undefined` from the expression's type and nothing else.
It is erased at compile time, so `a!.b` emits `a.b` — identical runtime
behaviour to writing no assertion, with the warning suppressed. It is
`as NonNullable<T>` with shorter syntax and the same absence of checking.

**★ When is `!` acceptable?**
When the invariant is local, visible in the same few lines, and would fail
loudly and immediately if broken — `document.getElementById('app')!` in code
shipped with its own markup, or a `Map.get` right after the matching `set`. It
is not acceptable for data from a network response, where the guarantee lives
somewhere you cannot see.

**★ You see `user!.id` inside a `forEach` that is inside `if (user !== null)`.
What do you say?**
That the `!` is compensating for a lost narrowing, not expressing knowledge. The
narrowing did not cross into the callback because `user` is a mutable binding.
`const u = user` after the check removes the assertion and stays correct if the
code is later moved.

**What is the difference between `x!` and `let x!: T`?**
The first is a non-null assertion on an expression. The second is a *definite
assignment assertion* on a declaration — a promise that something outside the
compiler's view assigns it before use, which is what silences `TS2564`. Same
character, different feature.

**What happens to `!` when `strictNullChecks` is off?**
Nothing — `null` and `undefined` are assignable everywhere, so there is nothing
to strip. Every `!` in such a codebase is decoration, which is why enabling
`strict` later surfaces so much at once.

---

← Prev: [12 · `unknown` in `catch`](./12-unknown-in-catch.md) · [Phase 2 index](./README.md) · Next → [Phase 3 · Generics](../phase-3-generics/README.md)
