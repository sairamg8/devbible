---
title: "The cases that earn it"
sidebar_label: "11 · The cases that earn it"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Template Literal Types* — the
> `PropEventSource` / `makeWatchedObject` example is quoted in full in
> [topic 07](../07-template-literal-types.md); *Utility Types* for the built-ins named
> here). `TS2590` is from the **compiler's own diagnostic table** (**TypeScript 5.9.3**)
> and confirmed in **7.0.2**. **No sandbox, no console block.** The selection of cases is
> **judgement** — it is an argument about when the cost is worth paying, not a list from
> documentation.

Ten chunks of "when to stop" would leave a false impression if it ended there. **This phase
exists because computed types are sometimes the only correct answer**, and a reader who
concludes "never write one" has learned the wrong lesson as thoroughly as one who writes
them everywhere.

So: the cases where the error-message cost from
[chunk 01](./01-the-error-is-the-interface.md) is worth paying, and *why* each one clears
the tests in [chunk 04](./04-the-stopping-tests.md).

## 1 · One source of truth, many derived shapes

The commonest legitimate case, and the least glamorous:

```ts
interface User { id: string; name: string; email: string; createdAt: Date }

type NewUser    = Omit<User, "id" | "createdAt">;
type UserPatch  = Partial<NewUser>;
type UserPublic = Omit<User, "email">;
```

**Why it clears the tests:** explainable in a sentence (test 1); the input is one type you
own (test 2 — derivation, not branching); the bug is real and recurring (test 3 — a field
added to `User` and forgotten in four hand-written shapes); and failures land at the call
site naming `UserPatch` (test 4).

📌 **Note what it is not:** no conditional, no recursion, no `infer`. **The overwhelming
majority of justified type-level code is a built-in utility applied once and named** — which
is why [topic 03](../03-utility-types/README.md) is a Master topic and the rest of the phase
is not.

## 2 · A wrapper whose signature must track the thing it wraps

```ts
type Wrapped<F extends (...a: never[]) => unknown> =
  (...a: Parameters<F>) => Promise<Awaited<ReturnType<F>>>;
```

The input is **the caller's own function**, which you cannot enumerate — test 2's definition
of open. Writing the signature by hand is not an option, and re-writing it every time the
wrapped function changes is exactly the drift the type prevents.

Deriving one function's type from another is **10 · Deriving one function's type from
another** *(not written yet)*, which is this case in full: decorators, adapters, retry
helpers, instrumentation.

## 3 · A key-driven API where the value type follows the key

```ts
declare function get<K extends keyof Config>(key: K): Config[K];
```

Indexed access plus a `keyof` bound: the return type genuinely depends on the argument, the
constraint reports typos at the call site, and there is no branch to order.

⚠️ **This is the case people over-build.** The lookup form above is enough for almost all of
it; a conditional chain over the same keys is
[chunk 08](./08-structure-and-tooling.md)'s control-flow mistake wearing a useful case's
clothes.

## 4 · A string the caller wrote, whose shape carries meaning

The one case where **type-level parsing wins outright**, because there is no schema to
generate from — the contract *is* the caller's argument:

```ts
type Params<S extends string> =
  S extends `${string}:${infer P}/${infer Rest}` ? P | Params<Rest> :
  S extends `${string}:${infer P}` ? P :
  never;

declare function route<S extends string>(
  path: S,
  handler: (p: Record<Params<S>, string>) => void,
): void;

route("/users/:id/posts/:postId", (p) => p.postId);   // both keys known
```

Route patterns, format strings, SQL fragments, CSS units, event names. The handbook's own
`person.on("firstNameChanged", …)` example ([topic 07](../07-template-literal-types.md)) is
this shape: a literal the caller typed, checked and destructured at the type level.

⚠️ **It is still bounded by `TS2590`** — *"Expression produces a union type that is too
complex to represent."* Match patterns with `infer`; do not enumerate the strings.

## 5 · A library boundary read by strangers

[Chunk 01](./01-the-error-is-the-interface.md)'s cost asymmetry does not reverse for
libraries — but the *benefit* scales with the same number. A type that makes a thousand
consumers' call sites correct is worth an investment no application type could justify,
including custom message types, hand-tuned constraints, and a façade layer
([chunk 10](./10-keeping-the-ones-you-keep.md)).

📌 **The honest asymmetry inside the asymmetry:** library authors get feedback on their error
messages — from issues — that application authors never get. If you are writing an
application type and telling yourself you are doing library-grade work, you are missing the
feedback loop that makes library-grade work possible.

## 6 · Exhaustiveness that must hold as the code grows

Making a mapped type cover every member of a union means a new member is a **compile error
at every site that must handle it**:

```ts
type Handlers = { [K in Event["kind"]]: (e: Extract<Event, { kind: K }>) => void };
```

Add a variant to `Event` and every `Handlers` object fails until it is updated. That is a
guard with a named incident behind it in most codebases — the switch statement that silently
did nothing for the new case — and it clears test 3 without argument. The narrowing-based
alternative is
[phase 2 · exhaustiveness](../../phase-2-narrowing/06-exhaustiveness.md); use it when the
handling is control flow and the mapped type when it is data.

## What the six have in common

Judgement, and it is the sentence to leave the topic with:

> **In every case that earns it, the type is derived from something the compiler already
> knows and the caller already wrote** — another type in your codebase, the caller's own
> function, a key of a known object, a literal they typed.

None of them derives from data the program has not seen
([chunk 09](./09-the-boundary-and-the-generator.md)), none re-implements a parser for a
contract that has a schema, and none is a prohibition wearing a type's clothes
([chunk 05](./05-is-a-type-the-tool.md)).

## Gotchas

**Symptom:** A justified derivation grew a conditional and stopped being explainable.
**Cause:** Case 1 drifting into branching — a derived shape now depends on the *input's*
type rather than a fixed key list.
**Fix:** Re-run test 2. Derivation from a known shape is cheap; branching on an unknown one
is the expensive thing.

**Symptom:** `Parameters<F>` on an overloaded function gave only the last signature.
**Cause:** The documented rule for the extractors —
[topic 03 · chunk 04](../03-utility-types/04-extractors.md).
**Fix:** Expected. Wrapping an overloaded function generically is a known limit, not a bug
in your type.

**Symptom:** A route-parsing type works on literals and returns `never` for variables.
**Cause:** The argument widened to `string` before matching.
**Fix:** `as const` at the source, or a `const` type parameter
([phase 3 · topic 12](../../phase-3-generics/12-const-type-parameters/README.md)).

**Symptom:** `TS2590` from a string-pattern type.
**Cause:** Enumerating instead of matching — interpolated unions cross-multiply.
**Fix:** Match with `infer`; keep interpolated unions few and small.

**Symptom:** A `keyof`-driven getter grew a conditional chain over the same keys.
**Cause:** Case 3 over-built.
**Fix:** Indexed access into a lookup table is enough
([chunk 08](./08-structure-and-tooling.md)).

**Symptom:** A mapped-type handler map is now enormous and slows the editor.
**Cause:** Case 6 applied to a union with a great many members.
**Fix:** Group the events, or split the map by domain. Exhaustiveness does not require one
object.

**Symptom:** An application type is being polished like a library type.
**Cause:** The benefit was assumed to scale with the effort.
**Fix:** Count the consumers. Six call sites in one repository do not repay
library-grade type work, and you will not get the issue reports that would tell you it was
wrong.

**Symptom:** A derived type over a validated schema is being re-derived by hand as well.
**Cause:** Two sources of truth, one of which is a "convenience" alias.
**Fix:** Import the inferred type. A parallel hand-written copy is the drift you avoided,
reintroduced.

## Interview questions

**★ Give the case where type-level programming is not optional.**
When the shape depends on something only the caller knows: their own function's parameters
and return type, a key of an object they passed, or a string literal they typed. A wrapper
typed as `(...a: Parameters<F>) => Promise<Awaited<ReturnType<F>>>` cannot be written by hand
because `F` is whatever the caller has, and re-writing it per call site is the drift the type
exists to prevent. That is test 2's "open input set" in its purest form.

**★ Why is type-level *parsing* defensible for a route pattern but not for an OpenAPI
contract?**
Because the route pattern is the caller's argument — there is no schema to generate from, so
matching it at the type level is the only way to type the handler's parameters. An OpenAPI
contract already has a machine-readable definition, so generation gives readable named types,
zero checker cost, real debuggability and automatic tracking. Same technique, opposite verdict,
decided entirely by whether a source of truth already exists.

**★ What do all the justified cases have in common?**
The type is derived from something **the compiler already knows and the caller already
wrote** — another type in the codebase, the caller's function, a key of a known object, a
literal they typed. None of them derives from data the program has not validated, none
re-implements a parser for a contract that has a schema, and none is a prohibition dressed as
a type.

**★ Most justified type-level code does not look clever. Why not?**
Because it is one built-in utility applied once and named — `Omit`, `Partial`, `Pick`,
`Parameters`. It clears every test easily: explainable in a sentence, derived from a type you
own, preventing a real and recurring bug (a field added and forgotten in four hand-written
shapes), and failing at the call site under a name. The cleverness is concentrated in a
handful of library boundaries, which is exactly where its cost is repaid.

**When does a mapped type beat exhaustive narrowing?**
When the exhaustiveness must hold over *data* rather than control flow — a handler map, a
config-per-variant table, a set of reducers. `{ [K in Event["kind"]]: … }` makes adding an
event variant a compile error at every map that must handle it. When the handling is a
`switch`, phase 2's `never` check is the simpler tool and produces a better message.

**Does the cost asymmetry reverse for library authors?**
No — the benefit scales with the same number that makes the cost large. A thousand consumers
means a thousand people reading your failures *and* a thousand call sites made correct, which
justifies custom message types and a façade layer that no application type could. What
library authors additionally have is a feedback loop: issues telling them their error message
is unusable. An application author polishing types to library standard has the costs without
that signal.

**How do you tell a justified derivation that has drifted into an unjustified one?**
The derivation starts depending on the *input's* type rather than on a fixed key list — a
conditional appears, then a nested one. `Partial<Omit<User, "id">>` is derivation;
`T extends { kind: "a" } ? … : …` is branching, and branching is what the stopping tests are
for. Re-run test 2 at that moment rather than at the type's birth.

**What is the one-sentence version of this whole topic?**
Compute a type when the input is open and the failure is locatable; write it when the input is
closed; check it when the data comes from outside — and remember that whichever you choose,
the error message is the part everyone else will read.

---

← Prev: [10 · Keeping the ones you keep](./10-keeping-the-ones-you-keep.md) ·
[Topic index](./README.md) · Next → [09 · Type-level performance](../09-type-level-performance/README.md)
