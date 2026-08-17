---
title: "The cost in the build"
sidebar_label: "05 · The cost in the build"
sidebar_position: 5
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Mixins*) and the
> compiler's own message table for `TS4060`, `TS9005`, `TS9007`, `TS9021`,
> `TS9022` and `TS7056` — every message quoted here was confirmed present in the
> installed **TypeScript 7.0.2** compiler. The `isolatedDeclarations` behaviour
> is described from those diagnostics and the flag's documented purpose, **not
> from a build** — no sandbox run covers this phase, so there is **no console
> block**.

Mixins cost nothing at runtime. They are a function call and a `class extends`,
both of which JavaScript has always had. **The entire bill arrives when something
has to write the type down** — and three things do: `.d.ts` generation, the
`isolatedDeclarations` flag, and your editor.

This chunk is the reason a team says no to the pattern, so it is worth reading
before the pattern is adopted rather than after.

## The inferred return type is the whole problem

Recall what the factory declares:

```ts
function Scale<TBase extends Constructor>(Base: TBase) {
  return class Scaling extends Base {
    _scale = 1;
    setScale(scale: number) { this._scale = scale; }
    get scale(): number { return this._scale; }
  };
}
```

There is no return type annotation, and there cannot easily be one: the thing
being returned is an **anonymous class expression that extends a type variable**.
Its type has no name anywhere in your program. Inside one file that is fine —
the compiler simply carries the structure around.

Across a file boundary it is not fine, because a `.d.ts` file may only contain
things that can be *written*.

## `TS4060` — the export that will not emit

Turn on `declaration: true` and export the factory:

```ts
export function Scale<TBase extends Constructor>(Base: TBase) { /* … */ }
```

> **`TS4060`: Return type of exported function has or is using private name
> `'{0}'`.**

The "private name" is `Scaling` — the class expression's own name, which exists
only inside the function body. The declaration file would have to refer to it,
and it has nothing to refer to.

The sibling diagnostic says the same thing with the fix attached:

> **`TS9005`: Declaration emit for this file requires using private name `'{0}'`.
> An explicit type annotation may unblock declaration emit.**

### The fix: name the shape yourself

Write the mixin's own members as an interface, and annotate the return type as an
intersection of a constructor for that interface with the base:

```ts
export interface Scaling {
  _scale: number;
  setScale(scale: number): void;
  readonly scale: number;
}

export function Scale<TBase extends Constructor>(
  Base: TBase,
): TBase & GConstructor<Scaling> {
  return class extends Base {
    _scale = 1;
    setScale(scale: number) { this._scale = scale; }
    get scale(): number { return this._scale; }
  };
}
```

`TBase & GConstructor<Scaling>` is writable, so the `.d.ts` emits. Note what it
cost: **the members are now declared twice** — once in the interface, once in the
class body — and nothing keeps them in sync except review. Add a method to the
class and forget the interface, and callers simply cannot see it. That
duplication is the standard tax on an exported mixin, and it is the honest reason
most codebases keep mixins internal to one file.

Two smaller variants worth knowing:

- **`ReturnType` cannot help you here.** `ReturnType<typeof Scale>` is defined in
  terms of the function whose type you are trying to emit; it does not give the
  compiler a nameable type, and for a generic function it collapses the type
  parameter to its constraint.
- **A named class inside the factory does not help either.** `class Scaling` is
  still local to the function body — naming it is what produces the *"private
  name `Scaling`"* wording in the first place.

## `isolatedDeclarations` — where the fix runs out

`isolatedDeclarations` asks for something stricter: that a `.d.ts` be produced
for each file **without the type checker**, from that file's syntax alone. Every
exported thing must therefore carry an explicit, writable type. The flag exists
to make declaration emit parallelisable and to let non-TypeScript tools generate
declarations, and it is increasingly what library build pipelines turn on.

Mixins collide with it head-on, and there are two dedicated diagnostics:

> **`TS9021`: Extends clause can't contain an expression with
> `--isolatedDeclarations`.**
>
> **`TS9022`: Inference from class expressions is not supported with
> `--isolatedDeclarations`.**

Read those together and the position is unambiguous. `class extends Base` inside
the factory is an **expression** in an extends clause, and the value returned is
a **class expression** whose type must be inferred. The mixin pattern is built
from precisely the two constructs the flag refuses.

The explicit-return-type fix above helps with `TS9007` (*"Function must have an
explicit return type annotation with `--isolatedDeclarations`"*), which is a
general requirement, but it does not dissolve `TS9021`/`TS9022` — the extends
clause is still an expression.

**So the practical rule is: a package built with `isolatedDeclarations` cannot
export mixin factories.** If you own that build setting, that is a decision to
make deliberately, and it is a strong argument for the composition alternative in
[chunk 07](./07-the-alternatives.md). If you are *adding* mixins to a codebase,
check the flag first — discovering this after the pattern has spread through a
package is an expensive afternoon.

## `TS7056` — the type that got too big

Stack enough mixins and the inferred type stops being serialisable at all:

> **`TS7056`: The inferred type of this node exceeds the maximum length the
> compiler will serialize. An explicit type annotation is needed.**

Each application produces an intersection carrying every member from every layer,
and the type printed in a declaration file is the accumulation of all of them.
Four or five deep with generic bases is enough to meet this in real code. The
message names its own fix — annotate explicitly — which lands you back at the
hand-written interface above, now for the composed result rather than one mixin.

## The costs that never produce an error

These are the ones that decide whether a team keeps the pattern.

**Error messages print the whole intersection.** When something does not match, the
compiler has no short name to use, so it prints the structure: every member of
every layer, inline. A three-mixin composition produces an error that fills the
terminal and buries the one property that is actually wrong. This is the most
common day-to-day complaint about mixins, and there is no fix beyond naming the
intersection with an interface.

**Go-to-definition lands in the factory.** Jumping to `setScale` takes you to the
mixin body, which is correct but disorienting — the class you were reading does
not appear in the file you land in. Nothing in the source of `EightBitSprite`
mentions `setScale` at all.

**The language server re-derives the composition constantly.** Each application is
a fresh instantiation of a generic function returning a class expression; the
results are recomputed as you type, and deep compositions in a large project are a
known source of editor lag. This is qualitative — the corpus has no measurement
of it (rules 7 and 8: no sandbox, no invented numbers) — but the mechanism is the
same one `TS7056` reports, so treat depth as the thing to control.

**A `.d.ts` you cannot read.** Even when emit succeeds, the emitted declaration for
a mixed class is an intersection of intersections. Consumers reading your types
to understand your API will not enjoy it.

## Gotchas

**Symptom:** `TS4060` the moment `declaration: true` is switched on, in a file
that compiled fine for months
**Cause:** The exported factory's return type refers to the class expression's
name, which is local to the function body.
**Fix:** Declare an interface for the mixin's members and annotate the return type
as `TBase & GConstructor<ThatInterface>`.

**Symptom:** `TS9005` mentioning a name you did not write
**Cause:** Same problem; this is the declaration-emit phrasing, and it names the
inaccessible symbol.
**Fix:** Add the explicit annotation it asks for.

**Symptom:** The interface fix works, but a new mixin method is invisible to
callers
**Cause:** The explicit return type is now the source of truth, and the class body
is not checked against it for *extra* members.
**Fix:** Treat the interface and the class body as one edit. If this keeps
happening, that is the pattern telling you the mixin should be a plain class.

**Symptom:** `TS9021` / `TS9022` in a package that builds fine elsewhere
**Cause:** `isolatedDeclarations` is on for this package. Mixins use exactly the
two constructs it forbids — an expression in an extends clause, and inference
from a class expression.
**Fix:** There is no annotation that clears it. Either keep the mixin unexported
and internal to one file, or replace it with composition.

**Symptom:** `TS7056` on a deeply composed class
**Cause:** The accumulated intersection exceeded the serialisation limit.
**Fix:** Annotate the composed result explicitly, and reduce the depth. Treat it
as a design signal, not a compiler limitation to route around.

**Symptom:** A type error in one field prints forty lines of structure
**Cause:** The composed type has no name, so the compiler prints it in full.
**Fix:** Name it — `interface PlayerSprite extends …` or an explicit alias — so the
error can say `PlayerSprite` instead of the whole shape.

**Symptom:** The build is fine but the editor lags in files that use the
composition
**Cause:** Each application re-instantiates a generic returning a class
expression; deep stacks are recomputed constantly.
**Fix:** Keep compositions shallow, and annotate the result so downstream files
consume a named type rather than re-deriving it.

## Interview questions

**★ Why does an exported mixin factory break `declaration: true`?**
Its return type is an anonymous class expression that extends a type variable, so
it has no name that can be written in a `.d.ts`. The compiler reports `TS4060`
(*"Return type of exported function has or is using private name"*) — the private
name being the class expression's own. The fix is to declare an interface of the
mixin's members and annotate the return type as
`TBase & GConstructor<ThatInterface>`, at the cost of declaring every member
twice.

**★ Can you use mixins in a package built with `isolatedDeclarations`?**
Not as exports. The flag requires each file's declarations to be derivable from
its syntax alone, and it has two diagnostics aimed squarely at this pattern:
`TS9021` (*"Extends clause can't contain an expression"*) and `TS9022`
(*"Inference from class expressions is not supported"*). An explicit return type
satisfies `TS9007` but not those two. Keep the mixin internal to a file, or use
composition.

**★ What is `TS7056` and what does it tell you about your design?**
*"The inferred type of this node exceeds the maximum length the compiler will
serialize."* Each mixin layer adds to an intersection carrying every member of
every layer; stack enough and the type can no longer be written out. The message
asks for an explicit annotation, but the real reading is that the composition has
grown past what anyone can follow either.

**Why are mixin error messages so long?**
Because the composed type has no name. The compiler prints the structure it has —
the full intersection of every layer's members — and the one mismatched property
is somewhere inside it. Naming the result with an interface is the only real
mitigation, and it is the same interface the declaration-emit fix needs.

**Does any of this cost anything at runtime?**
No. A mixin is a function call returning a subclass; the emitted JavaScript is
ordinary prototype inheritance. Every cost in this chunk is a compile-time,
build-time or editor cost. That asymmetry is worth stating plainly in a design
discussion, because "mixins are slow" is a claim about the compiler, not the
program.

---

← Prev: [02 · Constrained and abstract](./03-constrained-mixins.md) · Next → [04 · Identity, statics and privacy](./06-identity-and-statics.md)
