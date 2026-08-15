---
title: "`implements` vs `extends`"
sidebar_label: "04 · `implements` vs `extends`"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Classes → implements
> Clauses* and its *Cautions* subsection, *extends Clauses*) — the emphatic
> statement about `implements` not changing the class type, the `NameChecker`
> example and the optional-property example are **quoted verbatim**. Error codes
> and their exact `{0}`-templated text are read out of the **compiler's own
> diagnostic table** (⚠️ install inspected: TypeScript **6.0.3**, not the 7.0.2
> this corpus targets). **No console block** — no sandbox run covers this phase.

Two keywords that look like variations on "this class is related to that thing".
They are not related at all:

- **`extends` gives you members.** Real inheritance — the derived class *has*
  everything the base has, and the base's types flow into it.
- **`implements` gives you nothing.** It is a **check**, run once, that the class
  is assignable to the interface. It adds no members and supplies no types.

Everything in this topic is a consequence of that second sentence, and the
handbook states it more forcefully than it states almost anything else.

## 🔴 `implements` is only a check

> It's important to understand that an `implements` clause is only a check that
> the class can be treated as the interface type. It doesn't change the type of
> the class or its methods **at all**. A common source of error is to assume that
> an `implements` clause will change the class type - it doesn't!

Note the handbook's own italics and exclamation mark. This is the misconception
it most expects you to arrive with — and the reason is that in Java or C#,
`implements` genuinely does feed types down into the implementation.

### Consequence 1 — no contextual typing for parameters

The handbook's example:

```ts
interface Checkable {
  check(name: string): boolean;
}

class NameChecker implements Checkable {
  check(s) {
    // Notice no error here
    return s.toLowerCase() === "ok";
                       // any
  }
}
```

`s` is `any`. The interface says `name: string`, the class says `check(s)`, and
nothing connects them — because `implements` does not push types into the
implementation. In a language where it does, `s` would be `string` for free.

⚠️ **`strict` rescues you here, but by a different route.** With `noImplicitAny`
on, `check(s)` is reported as an implicit-`any` parameter (`TS7006`) — so the
mistake is caught, but by the implicit-any rule rather than by anything to do
with `Checkable`. The interface still supplies nothing; you have merely been told
to write the annotation yourself. Worth understanding, because it explains why
the same code is silently `any` in a non-strict codebase.

The remedy is the same either way: **annotate the parameter**. If that
duplication bothers you, the honest alternatives are a type-annotated
property (`check: Checkable['check'] = (s) => …`, where contextual typing *does*
apply) or accepting the annotation as the cost of the check.

### Consequence 2 — optional members are not created

```ts
interface A {
  x: number;
  y?: number;
}

class C implements A {
  x = 0;
}

const c = new C();
c.y = 10;
// Property 'y' does not exist on type 'C'.
```

`C` satisfies `A` — `y` is optional, so omitting it is legal. But `C`'s own type
has no `y`, because `implements` did not add one. The class is assignable to `A`
and is still not an `A`.

**This is the same fact from the other side:** a check tells you a class *can be
treated as* an interface. It never makes the class *become* it.

## What the failure looks like

> **TS2420:** *"Class '{0}' incorrectly implements interface '{1}'."*

Followed by the specific member that does not fit. It fires when a required
member is missing or has an incompatible type — the entire job of the clause.

Two more, and they are worth knowing as a pair because each suggests the other
keyword:

> **TS2720:** *"Class '{0}' incorrectly implements class '{1}'. Did you mean to
> extend '{1}' and inherit its members as a subclass?"*
>
> **TS2689:** *"Cannot extend an interface '{0}'. Did you mean 'implements'?"*

The compiler is explicitly built to catch people reaching for the wrong one, in
both directions. If you see either, the fix is usually the swap it is proposing.

⚠️ TS2720's case is the subtler mistake: **you may `implements` a class**, since
a class declaration creates a type. It just means "match this shape without
inheriting anything" — so you must reimplement every member yourself, including
the ones you assumed you were getting. That is almost never what was wanted, and
private members make it impossible anyway (declaration-site comparison, from
[topic 02](./02-access-modifiers/02-visibility-rules-and-choosing.md)).

And a narrower one:

> **TS2422:** *"A class can only implement an object type or intersection of
> object types with statically known members."*

You cannot `implements` a union, or a type whose members are computed in a way
the compiler cannot pin down. The clause needs a fixed list to check against.

## What `extends` does that `implements` cannot

- **Members are inherited**, so the derived class really has them, at runtime as
  well as in the type system.
- **Types flow down.** An overriding method's parameters are contextually typed
  by the base — the exact thing `implements` refuses to do.
- **`super` exists.** There is a real prototype chain, and `instanceof` works.
- **The derived class is checked against the base.** An incompatible override is
  > **TS2416:** *"Property '{0}' in type '{1}' is not assignable to the same
  > property in base type '{2}'."*
- **Abstract members are enforced.**
  > **TS2515:** *"Non-abstract class '{0}' does not implement inherited abstract
  > member {1} from class '{2}'."*

  (`TS2653` is the same rule for a class *expression*.) Abstract classes are
  **topic 11** *(not written yet)*; the point here is that an `abstract` base
  gives you the "must implement" guarantee people often reach for `implements`
  to get, **plus** shared code and inherited types.

## The arithmetic that decides it

**One class, many interfaces.** A class extends exactly one class and may
implement any number of interfaces:

```ts
class C implements A, B {
  // implementation
}
```

That asymmetry is usually the deciding factor in practice. If you need a shape
guarantee from several directions, `implements` is the only option. If you need
shared behaviour, only `extends` provides it.

**And `implements` is free.** It emits nothing and changes nothing, so adding it
costs a compile-time check and no more. Use it liberally for its documentation
value — it states an intent the compiler will hold you to, and it makes the
"which interfaces does this satisfy?" question answerable by reading the class
header.

## Which to reach for

| You want | Use |
|---|---|
| A compile-time guarantee that the shape is right | `implements` |
| To state intent for readers, at no runtime cost | `implements` |
| To satisfy several contracts at once | `implements` (multiple) |
| Shared implementation code | `extends` |
| Parameter types supplied to overrides | `extends` |
| `super`, `instanceof`, a real prototype chain | `extends` |
| "Must implement these members" **and** shared code | `abstract class` + `extends` |

⚠️ **Structural typing means you often need neither.** A class that happens to
have the right members is already assignable to the interface — that is
[phase 1's structural typing](../phase-1-type-vocabulary/09-structural-typing.md)
and it is why omitting `implements` is not a bug. What the clause buys is finding
out at the *class* rather than at the first call site that passes it somewhere.

## Trade-off

**`implements`** is a cheap, zero-runtime assertion that catches a broken
contract where the class is written rather than where it is used, and documents
intent in the header. It costs a little duplication — parameters still need
annotating — and it tempts readers into believing it does more than it does.

**`extends`** genuinely shares code and types, and gives you `super` and a real
prototype chain. It costs coupling: one base class only, and every change to the
base reaches every descendant.

The line worth holding: **`implements` for contracts, `extends` for code.** When
you want both, that is what `abstract class` is for.

## Gotchas

**Symptom:** A method parameter is `any` in a class that implements an interface
**Cause:** `implements` supplies no contextual types — it only checks.
**Fix:** Annotate the parameter. `noImplicitAny` will insist, via `TS7006`, which
is a different rule doing the catching.

**Symptom:** `Property 'y' does not exist on type 'C'` for an optional interface
member
**Cause:** Implementing an interface does not create its optional members on the
class.
**Fix:** Declare the member on the class if you intend to use it.

**Symptom:** `TS2720: … Did you mean to extend '{1}' and inherit its members as a
subclass?`
**Cause:** `implements` on a class, which asks you to reimplement every member.
**Fix:** Take the suggestion — `extends`.

**Symptom:** `TS2689: Cannot extend an interface. Did you mean 'implements'?`
**Cause:** The mirror mistake.
**Fix:** Take that suggestion instead.

**Symptom:** `TS2422: A class can only implement an object type or intersection
of object types with statically known members.`
**Cause:** Trying to implement a union, or a type without a statically known
member list.
**Fix:** Implement a concrete interface; narrow the union into one.

**Symptom:** `implements` on a class with private members always fails
**Cause:** Private and protected members compare by declaration site, so nothing
outside that class can satisfy them.
**Fix:** `extends`, or extract a public interface.

**Symptom:** `TS2515: Non-abstract class does not implement inherited abstract
member`
**Cause:** An `abstract` base member was not implemented.
**Fix:** Implement it, or mark the derived class `abstract` too.

## Interview questions

**★ What does `implements` actually do?**
It runs one check: that the class is assignable to the interface. The handbook is
emphatic that it *"doesn't change the type of the class or its methods at all"*.
It adds no members, supplies no parameter types, and emits nothing. `extends`, by
contrast, actually gives the class the base's members and lets its types flow
down.

**★ Why is a parameter `any` in a class that implements an interface declaring
it as `string`?**
Because `implements` provides no contextual typing — it checks the class against
the interface, it does not push the interface's types into the implementation.
Under `noImplicitAny` you get `TS7006` for the unannotated parameter, but that is
the implicit-any rule catching it, not the `implements` clause.

**★ If a class satisfies an interface structurally, why write `implements` at
all?**
For where the error appears. Without it, a missing or mistyped member surfaces at
the first place the class is passed somewhere expecting the interface — possibly
far away and possibly not at all. With it, you find out at the class. It is also
documentation, and it costs nothing at runtime.

**Can a class implement several interfaces?**
Yes, any number; it can extend only one class. That asymmetry is often what
decides the design. When you need "must implement these members" *plus* shared
code, an `abstract class` gives both.

**What does `implements` on a class mean?**
That you want to match the class's shape without inheriting anything — so every
member must be reimplemented. The compiler suspects a mistake and says so:
`TS2720` suggests `extends` explicitly. Private members make it impossible
anyway, since they compare by declaration site.

---

← Prev: [03 · Parameter properties](./03-parameter-properties.md) · Next → **05 · Interface declaration merging** *(not written yet)*
