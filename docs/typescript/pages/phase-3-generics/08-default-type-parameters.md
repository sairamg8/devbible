---
title: "Default type parameters"
sidebar_label: "08 · Default type parameters"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Generics*) and the
> **2.3 release notes**, which introduced generic parameter defaults.
> `TS2706` (*"Required type parameters may not follow optional type
> parameters."*), `TS2707` (*"Generic type '{0}' requires between {1} and {2}
> type arguments."*), `TS2716` (*"Type parameter '{0}' has a circular default."*)
> and `TS2314` were read out of the **compiler's own diagnostic table**. ⚠️
> Install inspected: TypeScript **6.0.3**, not the 7.0.2 this corpus targets.
> **No console block** — no sandbox run covers this phase.

```ts
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

type A = Result<User>;                    // E is Error
type B = Result<User, 'not-found'>;       // E is the literal
```

A default is what keeps the common case to one type argument without hiding the
second from anyone who needs it. It is a small feature and it is the difference
between an API people use and one they find noisy.

## Where the default actually applies

There are exactly two situations, and separating them removes most of the
confusion:

**For a *type*, the default fills in an omitted argument.**

```ts
interface Box<T = string> { value: T }

const b: Box = { value: 'hi' };      // legal — without the default this is TS2314
```

Recall from [topic 03](./03-generic-interfaces-and-aliases/README.md) that
`Box` alone is otherwise `TS2314: Generic type 'Box' requires 1 type
argument(s).` A default is what makes the bare name a usable type.

**For a *function*, the default applies only when inference has nothing.**

```ts
declare function make<T = string>(value?: T): T[];

make('a');        // T = string   — inferred from the argument
make(42);         // T = number   — inferred; the default is irrelevant
make();           // T = string   — no argument, so the default applies
```

The order of precedence is: **an explicit type argument, then inference, then
the default.** A default never overrides something the compiler could work out —
which is why adding one to an existing function is usually safe.

## Defaults and constraints compose

```ts
type Sorted<T extends string = 'asc'> = …;
```

The order is fixed: `<T extends Bound = Default>`. The default must satisfy the
bound, and it is checked:

```ts
type Bad<T extends string = number> = T;   // TS2344 — number does not satisfy string
```

⚠️ **They are still different mechanisms**, and [topic 02](./02-constraints/README.md)
warned about the confusion. With no inference site, an unconstrained parameter
falls back to `unknown` and a *constrained* one falls back to its constraint —
which looks like a default in that one case and is not one. A default is a
declared fallback; a constraint's fallback is a consequence.

## A default may reference earlier parameters

```ts
type Paged<T, Cursor = string, Items = T[]> = {
  items: Items;
  next: Cursor | null;
};

function group<T, K extends keyof T, R = Map<T[K], T[]>>(…): R { … }
```

Left to right only. A default that refers to a later parameter, or to itself, is
rejected:

```text
error TS2716: Type parameter 'T' has a circular default.
```

## Required parameters may not follow optional ones

```ts
type Bad<T = string, U> = [T, U];
```

```text
error TS2706: Required type parameters may not follow optional type parameters.
```

Same rule as function parameters, for the same reason: arguments are supplied
positionally, so once one is omittable everything after it must be too. **Put the
parameters everyone supplies first, and the defaulted ones last.**

Once some are defaulted, the arity error becomes a range:

```text
error TS2707: Generic type 'Paged' requires between 1 and 3 type arguments.
```

## Where defaults genuinely pay

**The one common configuration, several rare ones.**

```ts
type Result<T, E = Error> = …;
interface Repository<T, Id = string> { … }
type ApiResponse<T, Meta = Record<string, never>> = { data: T; meta: Meta };
```

Ninety per cent of uses want the default; the rest are still expressible without
a second type.

**Escaping the all-or-nothing type argument rule.** From
[topic 01](./01-generic-functions-and-inference/02-where-inference-comes-from.md):
there are no partial type argument lists, so `convert<string>('x')` on a
two-parameter function is `TS2558: Expected 2 type arguments, but got 1.` A
default on the trailing parameter makes the shorter call legal:

```ts
declare function convert<T, U = string>(input: T): U;
convert<Buffer>(buf);        // U falls back to string
```

**Backwards compatibility when adding a parameter.** Adding `<T>` to an existing
type is a breaking change for every consumer; adding `<T = TheOldBehaviour>` is
not. This is the main reason library types accumulate defaults over time, and
worth knowing when a signature looks over-parameterised — it is often history
rather than design.

## 🔴 The trap: a default that hides a missing inference

```ts
declare function getJson<T = any>(url: string): Promise<T>;

const user = await getJson('/api/me');    // any. No error, no clue.
```

Two separate problems compounding. `T` appears only in the return type, so there
is no inference site at all
([topic 01](./01-generic-functions-and-inference/README.md)) — and the `= any`
default means the failure produces a silent `any` rather than the `unknown` that
would have forced the caller to look.

**`= any` on a type parameter is almost always wrong.** If a fallback is really
needed, `= unknown` keeps the caller honest; better still, fix the signature so
there is something to infer from.

The general form of the smell: **a default that is doing the job inference should
have done.** If the default is what makes the API usable, the parameter is
probably in the wrong position.

## Trade-off

**A default** shortens the common call, makes a bare type name legal, and lets a
type parameter be added without breaking existing users. It costs discoverability
— the reader of `Result<User>` cannot see what `E` is without opening the
declaration — and it can mask an inference that should have been made to work.

**No default** forces every use site to be explicit, which is honest and verbose.
For a two-parameter type used everywhere, that verbosity is a real cost; for a
type used three times, it is not.

Add a default when the fallback is genuinely the overwhelmingly common case.
Do not add one to silence an error.

## Gotchas

**Symptom:** `TS2314: Generic type 'X' requires 1 type argument(s)`
**Cause:** Using a type constructor bare.
**Fix:** Pass the argument, or give the parameter a default if a sensible one
exists.

**Symptom:** `TS2706: Required type parameters may not follow optional type
parameters`
**Cause:** A defaulted parameter is declared before a non-defaulted one.
**Fix:** Reorder — defaults last.

**Symptom:** `TS2716: Type parameter 'T' has a circular default`
**Cause:** The default refers to itself or to a later parameter.
**Fix:** Defaults may only refer to parameters declared before them.

**Symptom:** A function's default type never seems to apply
**Cause:** Inference found something. Explicit argument beats inference beats
default.
**Fix:** Nothing — this is the intended order. The default is for the
no-argument call.

**Symptom:** A generic returns `any` at every call site
**Cause:** `<T = any>` combined with a parameter that has no inference site.
**Fix:** Remove the `= any`; fix the signature so `T` is inferable, or return
`unknown` and validate.

**Symptom:** `TS2707: … requires between 1 and 3 type arguments`
**Cause:** Too few or too many arguments for a partly defaulted parameter list.
**Fix:** Read the range in the message — it tells you exactly which are
optional.

## Interview questions

**★ When does a default type parameter actually apply?**
Only when nothing else supplies the type. The order is explicit type argument,
then inference, then the default — so on a function it usually applies only to a
call with no arguments to infer from. On a *type* it fills in an omitted
argument, which is what makes the bare name legal instead of `TS2314`.

**★ What is wrong with `function getJson<T = any>(url: string): Promise<T>`?**
Two things compounding. `T` appears only in the return type, so there is no
inference site — and `= any` means that failure produces a silent `any` rather
than an `unknown` that would force the caller to check. `= any` on a type
parameter is almost always wrong; `= unknown` at minimum, and better to fix the
signature.

**★ How do defaults interact with constraints?**
They compose as `<T extends Bound = Default>`, and the default is checked against
the bound. They are different mechanisms though: a constrained parameter with no
inference site falls back to its *constraint*, which resembles a default in that
one case but is a consequence rather than a declaration.

**Why must defaulted type parameters come last?**
Because type arguments are positional, so once one may be omitted everything
after it must be too — `TS2706`. Once some are optional, the arity error becomes
a range (`TS2707`: "requires between 1 and 3 type arguments").

**Why do library types accumulate defaults?**
Because adding a type parameter is a breaking change for every consumer, while
adding a *defaulted* one is not. An over-parameterised-looking signature is often
history rather than design.

---

← Prev: [07 · The `typeof` type operator](./07-typeof-type-operator.md) · Next → [09 · Generic classes](./09-generic-classes.md)
