---
title: "Phase 3 — Generics"
sidebar_label: "Phase 3 · Generics"
sidebar_position: 3
---

> Verified: 2026-08 against the **TypeScript handbook** (*Generics*, *Type
> Manipulation → Generics / Keyof / Typeof / Indexed Access / Conditional
> Types*) and the release notes for the features that have a version
> (`const` type parameters, 5.0; variance annotations, 4.7). Error codes and
> their exact message text are read out of the **compiler's own diagnostic
> table** rather than recalled — ⚠️ the install inspected is TypeScript
> **6.0.3**, not the 7.0.2 this corpus targets, and each page says so.
> **No sandbox, no console blocks**: every claim here is documentation-validated,
> and a plausible-looking `tsc` transcript written from memory is not evidence.

**14 topics · 31 files · complete.** [Phase 2](../phase-2-narrowing/README.md) was about recovering a
specific type from a wide one. This phase is the opposite motion: **writing code
for a type you have not been told yet**, and getting it back out intact at the
other end.

The bar is not "can you read `Array<T>`". It is whether you can write a function
whose **return type depends on its arguments**, and say exactly which argument
each inference came from. Almost everything in Part 3 of this syllabus — typed
request handlers, `useReducer`, an inferred schema, a repository — is a
constrained generic wearing a domain name.

The mental model worth carrying: **a type parameter is a variable in the type
language, and inference is the compiler solving for it.** Every confusing
generic is either a solve that had no information to work from, or one that
found the wrong equation.

| # | Page | Tier | What it settles |
|---|---|---|---|
| 01 | [Generic functions and inference](./01-generic-functions-and-inference/README.md) *(2 chunks)* | <span className="db-tier t-master">Master</span> | The parameter is usually *inferred*, not passed — and what it is inferred *from* |
| 02 | [Constraints — `T extends …`](./02-constraints/README.md) *(2 chunks)* | <span className="db-tier t-master">Master</span> | Why an unconstrained `T` gives you nothing to work with |
| 03 | [Generic interfaces and type aliases](./03-generic-interfaces-and-aliases/README.md) *(2 chunks)* | <span className="db-tier t-master">Master</span> | `ApiResult<T>`, `Repository<T>` — parameterising your own structures |
| 04 | [`keyof`](./04-keyof/README.md) *(2 chunks)* | <span className="db-tier t-master">Master</span> | The union of an object type's keys, and the entry point to every advanced type |
| 05 | [The `getProp` pattern](./05-getprop-pattern/README.md) *(2 chunks)* | <span className="db-tier t-master">Master</span> | `<T, K extends keyof T>(obj: T, key: K) => T[K]` — the shape behind every typed accessor |
| 06 | [Indexed access types — `T[K]`](./06-indexed-access-types.md) | <span className="db-tier t-understand">Understand</span> | Reading a property's type out of a type, including `T[number]` |
| 07 | [The `typeof` type operator](./07-typeof-type-operator.md) | <span className="db-tier t-understand">Understand</span> | Lifting a runtime value into the type world |
| 08 | [Default type parameters](./08-default-type-parameters.md) | <span className="db-tier t-understand">Understand</span> | `<T = string>`, and how defaults interact with inference |
| 09 | [Generic classes](./09-generic-classes.md) | <span className="db-tier t-understand">Understand</span> | Parameterised state, the static-member restriction |
| 10 | [Inference sites and contextual typing](./10-inference-sites-and-contextual-typing.md) | <span className="db-tier t-understand">Understand</span> | Why inference works from arguments and not from the return position |
| 11 | [`infer` in conditional types](./11-infer-in-conditional-types.md) | <span className="db-tier t-understand">Understand</span> | Pulling a type back out — elements, resolved promises, return types |
| 12 | [`const` type parameters](./12-const-type-parameters/README.md) *(3 chunks)* | <span className="db-tier t-understand">Understand</span> | `<const T>`, so callers get literal types without `as const` everywhere |
| 13 | [When *not* to write a generic](./13-when-not-to-write-a-generic/README.md) *(3 chunks)* | <span className="db-tier t-understand">Understand</span> | A type parameter used once is a disguised `any` |
| 14 | [Variance](./14-variance.md) | <span className="db-tier t-know">Know</span> | Co/contra/bivariance, `strictFunctionTypes`, and the `in`/`out` annotations |

✅ **Phase complete** — 14 topics, **28 files**, none over the 300-line cap.
Seven topics are chunk directories, seven are single files. ⚠️ **Topics 12 and 13
were re-opened and expanded after first being written as single files** of 289
and 293 lines — not because they broke the cap, but because they had been
*planned to it*. The phase's single files were clustering in a 43-line band just
under 300, which is the tell that a line target is shaping content rather than
the topic deciding its own length. Both are now 4 files, covering material the
flat versions had no room for.

**Evidence policy for this phase.** No sandbox and **no console blocks**: every
claim is validated against the handbook, the release notes for anything with a
version (`const` type parameters 5.0, `infer … extends` 4.8, variance annotations
4.7, `NoInfer` 5.4), and — where an exact error string or a library type is
quoted — the **compiler's own diagnostic table and `lib.es5.d.ts`**, read rather
than recalled. ⚠️ The install inspected is TypeScript **6.0.3**, not the 7.0.2
this corpus targets, and each page that quotes it says so.

## Phase gate

Move on when you can write a typed `pick(obj, keys)` **from an empty file**, with
the return type computed from the arguments — and say exactly which argument each
inference came from.

If you find yourself adding `<T>` and then immediately writing `as T` inside the
function, stop — that is the signal (topic 13) that the type parameter is not
earning its place.

## Where this connects

- **← [Phase 1 (The type vocabulary)](../phase-1-type-vocabulary/README.md)** —
  unions, literal types and `as const` are the raw material generics manipulate.
  Widening rules decide what a call site actually infers.
- **← [Phase 2 (Narrowing)](../phase-2-narrowing/README.md)** — a constrained
  type parameter narrows the same way a union does, and
  [`satisfies`](../phase-2-narrowing/10-satisfies/README.md) is what keeps the
  keys that `keyof typeof` then reads.
- **→ Phase 5 (Type-level programming)** — mapped and conditional types are
  `keyof`, indexed access and `infer` composed into machinery.
- **→ Phase 9 (Types at the boundary)** — `z.infer<typeof schema>` is `typeof`
  plus a conditional type with `infer` in it, and nothing else.
- **→ Part 3 generally** — every typed handler, hook and query result in the
  stack phases is one of these five Master patterns with a domain name on it.

---

← [Phase 2 — Narrowing](../phase-2-narrowing/README.md) · Next → [01 · Generic functions and inference](./01-generic-functions-and-inference/README.md)
