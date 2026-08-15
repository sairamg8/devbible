---
title: "`readonly` members and definite assignment `!:`"
sidebar_label: "08 · `readonly` and `!:`"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Classes →
> `strictPropertyInitialization`*, *Definite Assignment Assertions*) — the
> `OKGreeter` example and the statement about initialising through means other
> than the constructor are **quoted verbatim**. Error codes and their exact
> `{0}`-templated text are read out of the **compiler's own diagnostic table**
> (⚠️ install inspected: TypeScript **6.0.3**, not the 7.0.2 this corpus
> targets). **No console block** — no sandbox run covers this phase.

Two keywords that both amount to *"trust me, this field is fine"* — and they
promise completely different things:

- **`readonly`** — "nobody will reassign this after construction." The compiler
  **checks** it.
- **`!:`** — "this will be assigned before anything reads it." The compiler
  **stops checking** and takes your word.

One is a guarantee, the other is a waiver. Conflating them is how a `strict`
codebase ends up full of `undefined`.

## `readonly` — checked, and shallow

```ts
class Order {
  readonly id: string;
  constructor(id: string) {
    this.id = id;      // ✅ constructor assignment is allowed
  }
  rename(x: string) {
    this.id = x;       // ❌
  }
}
```

> **TS2540:** *"Cannot assign to '{0}' because it is a read-only property."*

Assignment is permitted **in the constructor and in the declaration's
initialiser**, and nowhere else. That is what makes `private readonly` such a
common pairing on injected dependencies
([topic 03](./03-parameter-properties.md)).

Two limits worth being precise about, because both surprise people:

**It is shallow.** `readonly items: string[]` stops you replacing the array; it
does nothing about `items.push(…)`. For that you want `readonly string[]`, which
removes the mutating methods:

```ts
readonly items: readonly string[];   // both: cannot reassign, cannot push
```

**It is erased.** Like `private` in
[topic 02](./02-access-modifiers/01-soft-private-and-hard-private.md), `readonly`
is a compile-time annotation and emits nothing. A JavaScript caller reassigns it
freely, and `Object.freeze` is the runtime tool.

Where the shallowness bites downstream:

> **TS4104:** *"The type '{0}' is 'readonly' and cannot be assigned to the mutable
> type '{1}'."*

That is a `readonly` array — often one inferred from `as const` or a
[`<const T>` parameter](../phase-3-generics/12-const-type-parameters/README.md) — reaching something that
wants a mutable one. Widen at that boundary with a spread rather than removing
the `readonly` upstream.

And on index signatures:

> **TS2542:** *"Index signature in type '{0}' only permits reading."*

## `strictPropertyInitialization` — the check `!` turns off

Under `strict`, a field with no initialiser and no constructor assignment is an
error:

```ts
class Greeter {
  name: string;      // ❌
}
```

> **TS2564:** *"Property '{0}' has no initializer and is not definitely assigned
> in the constructor."*

This is a genuinely valuable check. It catches the single most common source of
`undefined` in class-based code: a field the author intended to set and did not.

The handbook is explicit about the escape hatch and about when it is warranted:

> If you intend to definitely initialize a field through means other than the
> constructor (for example, maybe an external library is filling in part of your
> class for you), you can use the *definite assignment assertion operator*, `!`:

```ts
class OKGreeter {
  // Not initialized, but no error
  name!: string;
}
```

🔴 **Read what `!` actually does: it silences TS2564 and asserts nothing.** No
check replaces the one you removed. If nothing assigns `name`, the type still
says `string`, the value is `undefined`, and the failure appears wherever it is
first used — which is the exact bug `strictPropertyInitialization` exists to
prevent.

**"External library" is the operative phrase in the handbook's wording.** `!` is
right when something outside the constructor genuinely does the assignment —
a DI container, a test framework's lifecycle hook, an ORM hydrating an entity.
It is wrong as a way to make an error go away.

## The four honest alternatives to `!`

Reach for these first; most `!` in real codebases is one of them not taken.

| Situation | Better than `!` |
|---|---|
| The field genuinely may be absent | `name?: string` — the type tells the truth and callers must narrow |
| There is a sensible default | `name: string = ''` |
| It is always known at construction | Take it as a constructor parameter |
| It is set later by *your own* code, once | `#name?: string` behind a getter that throws if unset |

That last one is worth spelling out, because it is the honest version of `!`:

```ts
class Session {
  #user?: User;
  get user(): User {
    if (!this.#user) throw new Error('session not initialised');
    return this.#user;
  }
  attach(u: User) { this.#user = u; }
}
```

Same ergonomics at the use site — `session.user` is typed `User`, no narrowing
needed — but the failure is **loud, immediate and names the problem**, instead of
surfacing as `Cannot read properties of undefined` three frames away.

## `!` on variables, and where it is refused

The same operator works on a `let`, silencing:

> **TS2454:** *"Variable '{0}' is used before being assigned."*

Its property-level sibling is:

> **TS2565:** *"Property '{0}' is used before being assigned."*

Two constraints from the diagnostic table:

- *"Declarations with definite assignment assertions must also have type
  annotations."* — `let x! = 1` is meaningless; there is nothing to assert about.
- **TS1255:** *"A definite assignment assertion '!' is not permitted in this
  context."* — not on a parameter, not on an `abstract` or `declare`d member.

⚠️ **Do not confuse `x!` with `x!.y`.** The declaration-site `!` is a *definite
assignment assertion*; the postfix `!` in an expression is the *non-null
assertion* from [phase 2](../phase-2-narrowing/13-non-null-assertion.md). Same
character, different operators, and both are ways of overruling the compiler.

## Trade-off

**`readonly`** costs nothing and documents a real constraint the compiler
enforces at every assignment. Its limits are that it is shallow and erased — so
it prevents mistakes, not attacks.

**`!:`** buys silence. It is correct when an external mechanism genuinely assigns
the field and no other spelling expresses that. It costs you the single best
check TypeScript offers against `undefined` in classes, with nothing put in its
place — and it is invisible at every use site, so nobody downstream knows the
guarantee was waived.

The line worth holding: **`readonly` liberally, `!:` almost never.** Before
writing `!`, work down the table above; if a real answer fits, use it. If `!` is
genuinely right, leave a comment naming what does the assigning — that comment is
the only remaining evidence that anyone thought about it.

## Gotchas

**Symptom:** `TS2540: Cannot assign to 'x' because it is a read-only property.`
outside the constructor
**Cause:** `readonly` permits assignment only in the constructor or the
declaration.
**Fix:** Assign there, or drop `readonly` if the field really does change.

**Symptom:** A `readonly` array is still being mutated
**Cause:** `readonly items: string[]` protects the *binding*, not the contents.
**Fix:** `readonly items: readonly string[]`.

**Symptom:** `TS4104: The type '…' is 'readonly' and cannot be assigned to the
mutable type '…'`
**Cause:** A readonly array — often from `as const` or a `const` type parameter —
reaching something that wants a mutable one.
**Fix:** Spread at that boundary (`[...value]`), not by removing the `readonly`.

**Symptom:** A JavaScript caller reassigned a `readonly` field
**Cause:** It is erased at compile time.
**Fix:** `Object.freeze`, or accept that it documents intent rather than enforcing
it.

**Symptom:** `TS2564: Property 'x' has no initializer and is not definitely
assigned in the constructor.`
**Cause:** `strictPropertyInitialization` — the field is never assigned.
**Fix:** Initialise it, take it as a parameter, or make it optional. `!` only if
something outside the constructor truly assigns it.

**Symptom:** A field declared `name!: string` is `undefined` at runtime
**Cause:** `!` silences the check and asserts nothing.
**Fix:** Whatever was supposed to assign it, is not. Prefer `?` plus a throwing
getter so the failure is loud and local.

**Symptom:** `TS1255: A definite assignment assertion '!' is not permitted in this
context.`
**Cause:** `!` on a parameter, or on an `abstract`/`declare`d member.
**Fix:** Remove it; those positions have no initialisation to assert about.

**Symptom:** `Declarations with definite assignment assertions must also have type
annotations.`
**Cause:** `let x! = 1` — nothing to assert about.
**Fix:** Annotate the type, or drop the `!`.

## Interview questions

**★ What does `!:` on a class field do?**
It silences `strictPropertyInitialization` — `TS2564` — and asserts nothing else.
No check replaces the one it removes, so if nothing assigns the field the type
still claims `string` while the value is `undefined`. The handbook's warranted
case is narrow: something *outside* the constructor genuinely does the
assignment, such as a DI container or an ORM.

**★ How is `readonly` different from `!:`?**
`readonly` is a guarantee the compiler enforces — assignment is permitted only in
the constructor or the declaration, and anything else is `TS2540`. `!:` is a
waiver: it turns a check off. One adds safety, the other removes it.

**★ Does `readonly` make an object immutable?**
No, twice over. It is **shallow** — `readonly items: string[]` stops you replacing
the array but not `items.push(…)`, for which you want `readonly string[]` — and it
is **erased**, so a JavaScript caller reassigns freely. `Object.freeze` is the
runtime tool.

**What would you write instead of `!`?**
In order: make it optional (`?`) if it genuinely may be absent; give it a default;
take it as a constructor parameter; or keep it private-optional behind a getter
that throws when unset. That last one gives the same ergonomics as `!` at the use
site, but fails loudly and locally instead of producing an `undefined` three
frames away.

**Is the `!` in `name!: string` the same as in `user!.name`?**
No — same character, different operators. The declaration-site one is a definite
assignment assertion; the postfix one in an expression is the non-null assertion.
Both overrule the compiler, which is the only thing they have in common.

---

← Prev: [07 · Branded / nominal types](./07-branded-nominal-types.md) · Next → **09 · Typing getters and setters** *(not written yet)*
