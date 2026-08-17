---
title: "Mixins"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Mixins* — *Setup*, *The
> `Constructor` type*, *Constrained mixins*, *Alternative pattern*,
> *Constraints*) with every example quoted verbatim, and the **TypeScript 4.2
> release notes** (*Abstract construct signatures*). Every diagnostic quoted in
> this topic was read out of the **installed compiler's own message table** and
> its text confirmed present in **TypeScript 7.0.2**
> (`sandbox/ts-p1/node_modules/@typescript/`); code numbers come from the 5.9.3
> table in `sandbox/ts-p0`. **No console block** — no sandbox run covers this
> phase, and a plausible `tsc` transcript written from memory is not evidence.

A mixin is **a function that takes a class and returns a subclass of it**. That
is the whole idea, and the rest of this topic is the type system's reaction to
it.

The pattern earns its "When Needed" tier honestly. You will read mixins far more
often than you write them — they are how library authors add a capability to a
class *you* supply, which is a problem application code almost never has. But
when you do meet one, the failure modes are unusually sharp: the factory that
will not build with `declaration: true`, the base class whose statics silently
disappear, the intersection that reduces to `never`, the package that cannot be
built at all under `isolatedDeclarations`. Those are the reason this topic is
long.

| # | Chunk | What it settles |
|---|---|---|
| 01 | [The pattern](./01-the-pattern.md) | The class-expression factory, the `Constructor` alias, and why the constructor must be `(...args: any[])` |
| 02 | [Composing and naming](./02-composing-and-naming.md) | Nesting mixins, what order decides, and how to write down the type of a class that has no declaration |
| 03 | [Constrained mixins](./03-constrained-mixins.md) | `GConstructor<T>`, requiring instance members **and** statics of the base, and where the error lands when a base does not qualify |
| 04 | [Abstract bases and the two fences](./04-abstract-and-fences.md) | `abstract new` construct signatures (TS 4.2), and the two errors that bound the pattern — `TS2510` and `TS2562` |
| 05 | [The cost in the build](./05-the-cost-in-the-build.md) | Declaration emit (`TS4060`), `isolatedDeclarations` (`TS9021`/`TS9022`), `TS7056`, and the costs that never produce an error |
| 06 | [Identity, statics and privacy](./06-identity-and-statics.md) | Why every call makes a different class, `#private` turning composition nominal, the static-side limit, and why a decorator cannot do this |
| 07 | [The alternatives](./07-the-alternatives.md) | The handbook's `applyMixins` pattern, plain composition, and the decision — which is usually "not a mixin" |

## The one-sentence version

**A mixin is a generic function `<T extends Constructor>(Base: T)` that returns
`class extends Base`** — the type flows through because the parameter is generic
and the return type is inferred, and every constraint in this topic exists
because that inferred type has to survive being written down.

## The three sentences to keep

1. **The base is a type parameter, not a type.** `TBase extends Constructor` is
   what makes the result keep the base's own members; annotate the parameter as
   `Constructor` instead and you get a class with nothing but the mixin's own
   members.
2. **`new (...args: any[]) => {}` is not laziness.** The constructor signature
   has to accept anything, because the mixin subclass forwards arguments it knows
   nothing about — and `TS2545` is the compiler saying exactly that.
3. **The cost is in the emit, not the runtime.** Mixins run fine. What breaks is
   writing their type down: `.d.ts` generation, `isolatedDeclarations`, and error
   messages that print the whole intersection.

## Phase gate

You do not need to write a mixin to finish this phase. You need to be able to
**read one** — to look at `function Scale<TBase extends Constructor>(Base: TBase)`
and say what `Scale(Sprite)` is, and to name one reason a team would refuse the
pattern.

## Where this connects

- **← [12 · Static members and the static side](../12-static-members-and-the-static-side.md)**
  — the instance type and the constructor type being two different types is the
  fact the whole mixin pattern is built on. `Constructor` is a *static side*.
- **← [11 · Abstract classes](../11-abstract-classes.md)** — construct signatures
  (`new (…args) => T`) get their own page there; [chunk 04](./04-abstract-and-fences.md) adds the `abstract new`
  form that TypeScript 4.2 introduced for exactly this pattern.
- **← [02 · Access modifiers](../02-access-modifiers/README.md)** — soft `private`
  versus hard `#private` decides whether a composed intersection survives or
  reduces to `never` ([chunk 06](./06-identity-and-statics.md)).
- **← [Phase 3 · Generic functions and inference](../../phase-3-generics/01-generic-functions-and-inference/README.md)**
  — a mixin factory is a generic function whose return type is inferred, so
  everything about inference sites applies here unchanged.
- **→ [Phase 6 · `isolatedDeclarations`](../../phase-6-modules-build/15-isolateddeclarations/README.md)** — the flag that makes
  the mixin factory unbuildable, and the trade it is asking you to make.

---

← [Phase 4 index](../README.md) · Next → [01 · The pattern](./01-the-pattern.md)
