---
title: "noImplicitOverride"
sidebar_label: "01 · noImplicitOverride"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 from the **compiler's own option table** in the **TypeScript
> 5.9.3** build — `noImplicitOverride` carries `affectsSemanticDiagnostics`,
> `category: Type_Checking`, `defaultValueDescription: false` and **no
> `strictFlag`** — with the description *"Ensure overriding members in derived
> classes are marked with an `override` modifier"*. The **five** `override`
> diagnostics `TS4112`–`TS4116` and their exact `{0}` text come from the
> numbered diagnostic table. **No sandbox, no console block.**

The cheapest flag in this group by a wide margin, and the one that catches the
most alarming class of bug: **a subclass that silently stops overriding
anything.**

> **Without `override`, "I am replacing the base implementation" and "I am adding
> a new method" are written identically.** So a rename in the base class turns
> the first into the second, in a different file, with no error anywhere.

## The bug it exists for

```ts
class BaseController {
  handleRequest(req: Request) { … }        // ← renamed to `handle` next sprint
}

class UserController extends BaseController {
  handleRequest(req: Request) { … }        // was an override. now it is dead code.
}
```

The base class is renamed. `UserController.handleRequest` compiles perfectly —
it is now simply a method nobody calls, and the base implementation runs
instead. **Nothing in the type system objects**, because adding a method to a
subclass is a legal thing to do.

The failure surfaces as behaviour, in production, some distance from the rename:
authentication that stops being applied, a hook that stops firing, a
`serialize()` that quietly reverts to the generic one.

🔴 **This is the failure mode that makes the flag worth more than its cost.**
Nearly every other correctness flag catches something the code *might* get wrong;
this one catches a change that has *already* silently broken the code.

## What the flag requires

```ts
class UserController extends BaseController {
  override handleRequest(req: Request) { … }
}
```

Now the rename produces `TS4113` at the subclass — *"This member cannot have an
`'override'` modifier because it is not declared in the base class
`'BaseController'`."* The error lands on the file that is now wrong, naming the
base class it expected to find the member in.

## The five diagnostics, and what each one is telling you

| Code | Message | What happened |
|---|---|---|
| `TS4112` | *"This member cannot have an `'override'` modifier because its containing class `'{0}'` does not extend another class."* | `override` on a class with no `extends` at all |
| `TS4113` | *"This member cannot have an `'override'` modifier because it is not declared in the base class `'{0}'`."* | 🔴 **the rename** — you claimed an override that no longer exists |
| `TS4114` | *"This member must have an `'override'` modifier because it overrides a member in the base class `'{0}'`."* | the flag's main error: an unmarked override |
| `TS4115` | *"This **parameter property** must have an `'override'` modifier because it overrides a member in base class `'{0}'`."* | a constructor parameter property shadowing a base member |
| `TS4116` | *"This member must have an `'override'` modifier because it overrides an **abstract** method that is declared in the base class `'{0}'`."* | implementing an `abstract` member |

📌 **`TS4113` is the one that pays for the flag; `TS4114` is the one you will
actually see.** `TS4114` is the migration cost — every existing override needs
the keyword. `TS4113` is the return, and it only ever fires on the day something
broke.

⚠️ **`TS4116` is worth arguing about.** Implementing an `abstract` member is
required, not optional, so the compiler already guarantees you did it — an
unimplemented abstract member is `TS2515` and the class will not compile. Marking
it `override` is therefore documentation rather than protection. Some teams
find it noise; the counter-argument is that a base member changing from
`abstract` to concrete is exactly the kind of edit whose consequences you want
spelled out at each subclass. See
[phase 4 · Abstract classes](../../phase-4-classes-declarations/11-abstract-classes.md).

## `override` is erased

`override` is a **type-system modifier with no runtime meaning**. It compiles to
nothing:

```ts
override handleRequest(req: Request) { … }
//  ↓ emitted
handleRequest(req) { … }
```

Which means two things worth knowing:

- **It is safe under Node's type stripping.** Unlike a parameter property, it
  does not emit code, so it does not trip `erasableSyntaxOnly` /
  [`TS1294`](../../phase-4-classes-declarations/03-parameter-properties.md).
- **It provides no runtime guarantee whatsoever.** Nothing checks at runtime that
  the method still shadows anything. The protection is entirely at build time,
  and it disappears if the build is skipped.

## What it does not cover

Bounding the flag honestly, because each of these is a place people assume it
protects them and it does not:

- **`implements`, not `extends`.** A class implementing an interface gets no
  `override` requirement, because it is not overriding — it is satisfying. If
  the interface member is renamed you get `TS2420` instead, which is a good
  error, but it comes from a different rule. See
  [phase 4 · `implements` vs `extends`](../../phase-4-classes-declarations/04-implements-vs-extends.md).
- **Properties assigned in the constructor** rather than declared. `this.x = …`
  in a subclass constructor overwrites a base field with no modifier involved.
- **Object literals and plain functions.** The flag is a class feature only.
- **`super` calls.** Marking a method `override` says nothing about whether you
  remembered to call `super.method()`. A subclass that overrides and forgets the
  `super` call is a separate bug this flag does not see.

## Adopting it

The cheapest migration in this phase, and it is genuinely mechanical:

1. Turn it on. Every error is `TS4114`.
2. Add `override` to each. There is no judgement call — the compiler has told you
   the member exists in the base.
3. **Read any `TS4113` extremely carefully.** If one appears on the *first* run,
   you have just found a live bug: a method that believes it overrides something
   and does not.

📌 **A `TS4113` on the first enable is the flag paying for itself before it has
finished being adopted.** It is worth telling the team when it happens, because
it is the most concrete argument available for the rest of these flags.

## Gotchas

**Symptom:** a subclass method stopped being called and nothing errors.
**Cause:** the base member was renamed; the subclass method is now an addition,
not an override.
**Fix:** `noImplicitOverride`, which turns exactly this into `TS4113`. Without
the flag there is no compile-time signal at all.

**Symptom:** `TS4112` on a class you are sure has a base.
**Cause:** it `implements` an interface rather than `extends` a class. `override`
applies to class inheritance only.
**Fix:** remove the modifier. Interface conformance is checked by `TS2420`.

**Symptom:** `TS4115` on a constructor parameter you did not think was an
override.
**Cause:** a parameter property (`constructor(private name: string)`) declares a
member, and that member shadows one in the base.
**Fix:** `constructor(private override name: string)`, or stop using a parameter
property there. Note that parameter properties **emit code** —
[phase 4 · Parameter properties](../../phase-4-classes-declarations/03-parameter-properties.md).

**Symptom:** the team objects to `override` on every `abstract` implementation.
**Cause:** `TS4116`. The compiler already requires the implementation, so the
keyword is documentation rather than protection here.
**Fix:** there is no separate flag for it — `noImplicitOverride` covers both. Take
the whole flag or none of it; the `TS4113` protection is worth the `TS4116`
noise.

**Symptom:** a subclass overrides correctly but the base behaviour is lost.
**Cause:** a missing `super.method()` call. The flag has no opinion on this.
**Fix:** a linter rule or code review. `override` marks the relationship, not the
delegation.

**Symptom:** `override` in a `.d.ts` or on an interface member is rejected.
**Cause:** it is a class-implementation modifier; there is nothing to override in
a type declaration.
**Fix:** remove it. Declaration files describe shapes, not inheritance decisions.

## Interview questions

**What bug does `noImplicitOverride` catch that nothing else does?**
A subclass that stops overriding. If a base method is renamed, the subclass
method keeps compiling — it is now simply a new method nobody calls, and the base
implementation runs instead. There is no error anywhere without the flag, and the
symptom appears at runtime in a different file from the change.

**Which of its diagnostics is the migration cost and which is the payoff?**
`TS4114` — "this member must have an `override` modifier" — is the cost; it fires
once per existing override during adoption. `TS4113` — "cannot have an `override`
modifier because it is not declared in the base class" — is the payoff, and it
only ever fires when something is genuinely broken.

**Does `override` do anything at runtime?**
No. It is erased entirely, like a type annotation, so it is safe under Node's
type-stripping mode and provides no runtime guarantee at all. If the build does
not run, the protection is not there.

**Why does `override` not apply to `implements`?**
Because implementing an interface is not overriding — there is no base
implementation being replaced. If an interface member is renamed you get
`TS2420` from the conformance check instead, which is a different rule with a
different error.

**Is `noImplicitOverride` part of `strict`?**
No. The compiler's option record has no `strictFlag` and its default is `false`.
That is arguably the least defensible omission in the whole family, because the
adoption cost is purely mechanical — add a keyword where the compiler tells you
— and the bug it catches is silent and behavioural.

**Someone objects that `override` on abstract implementations is pointless. Are
they right?**
Partly. `TS4116` fires where the compiler already forces you to implement the
member, so the keyword is documentation rather than protection. But there is no
way to take the `TS4113` protection without it, and a base member changing from
abstract to concrete is a change you want visible at every subclass.

---

← [Topic index](./README.md) · Next → [02 · Index-signature access](./02-index-signature-access.md)
