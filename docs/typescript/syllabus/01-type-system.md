---
title: "Part 1 — The type system"
sidebar_label: "1 · The type system"
sidebar_position: 1
---

> **Phases 0–3 · 57 topics · 27 Master**
> What the compiler is, the vocabulary it thinks in, how it follows your control
> flow, and how you write code that works for a type you have not seen yet.

This is the part you cannot skim. Everything later — augmenting `Express.Request`,
inferring a zod schema, typing a `useReducer` — is these four phases applied.
Nothing here is React-specific, Node-specific or browser-specific.

---

## Phase 0 — How TypeScript runs

*13 topics.* Before any syntax: what the tool is, what it leaves behind, and the
three different programs that might be reading your `.ts` file. The erasure row
is the one that makes the rest of the language stop being surprising.

📖 **Explanation written:** [Phase 0 — How TypeScript runs](../pages/phase-0-how-typescript-runs/)

| Topic | Tier |
|---|---|
| **TypeScript is a static checker, not a runtime** — it type-checks, then throws the types away; there is no TypeScript at runtime, ever | <span className="db-tier t-master">Master</span> |
| **Erasure and what survives it** — annotations, interfaces and type aliases vanish; `enum`, `namespace`, parameter properties and decorators **emit code**, and that asymmetry causes real bugs | <span className="db-tier t-master">Master</span> |
| **The three ways to run TypeScript** — `tsc` emit, transpile-only tools (esbuild/swc/Babel/`tsx`), and **Node 24 running `.ts` directly with no flag**; which of the three actually type-checks (one) | <span className="db-tier t-master">Master</span> |
| **Node's strip-only mode and `erasableSyntaxOnly`** — `enum` fails at runtime with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`; the flag turns that runtime failure into a compile error | <span className="db-tier t-master">Master</span> |
| **`strict` and the flags it turns on** — one line in `tsconfig.json` that changes what the language means; never start a project without it | <span className="db-tier t-master">Master</span> |
| **`tsconfig.json` anatomy** — `target`, `module`, `moduleResolution`, `lib`, `rootDir`/`outDir`, `include`/`exclude`, `noEmit`; which fields you actually set and which are ceremony | <span className="db-tier t-understand">Understand</span> |
| **TypeScript 7 is a different compiler** — the native Go port, what it changed for you (speed, flags, the removed `ts.*` JavaScript API), and what to check before upgrading a toolchain | <span className="db-tier t-understand">Understand</span> |
| **Where types come from** — bundled `types` in a package, `@types/*` from DefinitelyTyped, `typeRoots`, and diagnosing "could not find a declaration file" | <span className="db-tier t-understand">Understand</span> |
| **The language server is not the build** — why your editor is green and CI is red: different TS version, different `tsconfig`, unsaved files, `skipLibCheck` | <span className="db-tier t-understand">Understand</span> |
| **Type checking vs transpiling** — esbuild/swc strip types without checking a single one, so `tsc --noEmit` has to run somewhere or your types are decoration | <span className="db-tier t-understand">Understand</span> |
| Project layout — `tsc --init`, source vs output trees, why `outDir` and `include` fight, and what gets published | <span className="db-tier t-understand">Understand</span> |
| Release cadence and reading release notes — 5.x → 6.0 (deprecation bridge) → 7.0 (rewrite), and how to plan an upgrade | <span className="db-tier t-know">Know</span> |
| The Playground and `// @ts-check` on plain `.js` — checking JavaScript without converting it | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can say, for a given `.ts` file, whether the thing
that runs it will also *check* it — and name what happens to an `enum` in each
of the three cases.

---

## Phase 1 — The type vocabulary

*17 topics.* Every type you will write for the next year. Dense on Master
because this is the part you use without looking anything up — ten of the
seventeen rows appear in almost every file you touch.

📖 **Explanation written:** [Phase 1 — The type vocabulary](../pages/phase-1-type-vocabulary/)

| Topic | Tier |
|---|---|
| **Primitives and inference** — `string`, `number`, `boolean`, and why `let` widens to `string` while `const` narrows to `"a"` | <span className="db-tier t-master">Master</span> |
| **Literal types and `as const`** — turning a value into a type, freezing an object literal's inferred shape, and where widening silently loses you precision | <span className="db-tier t-master">Master</span> |
| **Arrays and tuples** — `T[]` vs `Array<T>` vs `[string, number]`, named tuple members, and optional/rest elements | <span className="db-tier t-master">Master</span> |
| **Object types** — optional `?`, `readonly`, nested shapes, index signatures, and what an index signature costs you | <span className="db-tier t-master">Master</span> |
| **Union types** — modelling "one of these", and why you can only touch the members common to every branch until you narrow | <span className="db-tier t-master">Master</span> |
| **`any` vs `unknown` vs `never` vs `void`** — the four that get confused; `any` disables checking, `unknown` demands it, `never` means unreachable, `void` means "ignore my return" | <span className="db-tier t-master">Master</span> |
| **`type` vs `interface`** — the real differences (declaration merging, unions, performance in errors), and a defensible default | <span className="db-tier t-master">Master</span> |
| **Function types** — parameter and return annotations, optional and default parameters, rest parameters, and typing a callback parameter | <span className="db-tier t-master">Master</span> |
| **Structural typing** — TypeScript compares shapes, not names; why an unrelated object is assignable, and why the object *literal* still errors (excess property checks) | <span className="db-tier t-master">Master</span> |
| **`null` and `undefined` under `strictNullChecks`** — optional property vs `\| undefined`, and why the two are not the same thing | <span className="db-tier t-master">Master</span> |
| **Intersection types** — `A & B` for composition, what happens when two members conflict, and why an impossible intersection is `never` | <span className="db-tier t-understand">Understand</span> |
| **Call signatures, construct signatures and overloads** — declaring a function type, `new`-able types, overload resolution order, and why the implementation signature is not callable | <span className="db-tier t-understand">Understand</span> |
| **`enum` vs union of literals vs `const` object** — the only construct that emits runtime code, numeric-enum reverse mapping, `const enum` inlining, and the migration target | <span className="db-tier t-understand">Understand</span> |
| **`readonly` arrays and tuples** — `readonly T[]`, `ReadonlyArray<T>`, `as const` tuples, and the assignability direction that surprises people | <span className="db-tier t-understand">Understand</span> |
| **Recursive type aliases** — modelling `JsonValue`, a tree, or nested config, and the depth limit you eventually hit | <span className="db-tier t-understand">Understand</span> |
| `object` vs `Object` vs `{}` — three types that look identical and accept wildly different values | <span className="db-tier t-know">Know</span> |
| `symbol` and `unique symbol` — typing symbol keys, and why `unique symbol` needs a `const` declaration | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can model an API payload with unions, optional
properties and a literal-typed status field — and explain each choice rather
than reaching for `any` at the first friction.

---

## Phase 2 — Narrowing and control flow analysis

*13 topics.* The compiler reads your `if` statements. This phase is what makes
unions usable, and it is the single most common source of "why is this still
possibly undefined?".

| Topic | Tier |
|---|---|
| **`typeof` narrowing** — the six results, what it can and cannot distinguish, and the `typeof null === 'object'` hole you inherit from JavaScript | <span className="db-tier t-master">Master</span> |
| **Truthiness and equality narrowing** — `if (x)`, `x === null`, `x != null`, and the empty-string/zero trap that removes the wrong branch | <span className="db-tier t-master">Master</span> |
| **Discriminated unions** — a literal-typed tag on every member; the single most valuable modelling pattern in the language | <span className="db-tier t-master">Master</span> |
| **Exhaustiveness with `never`** — the `assertNever` default case that turns "someone added a variant" into a compile error | <span className="db-tier t-master">Master</span> |
| **User-defined type guards** — `function isX(v: unknown): v is X`, and the fact that the compiler *trusts you* rather than checking the body | <span className="db-tier t-master">Master</span> |
| **`satisfies`** — check a value against a type without widening it; the fix for the "I want both the constraint and the literal type" problem | <span className="db-tier t-master">Master</span> |
| **Narrowing you lose without noticing** — a check that does not survive a callback, an `await`, a mutable property, or a reassigned `let` | <span className="db-tier t-master">Master</span> |
| **`as` assertions** — what they actually do (silence the checker), the two-step `as unknown as T` escape, and why every one is a claim you now own | <span className="db-tier t-understand">Understand</span> |
| **`in` operator narrowing** — discriminating by property presence when there is no tag to check | <span className="db-tier t-understand">Understand</span> |
| **`instanceof` narrowing** — how it works with classes, why it fails across realms/bundles, and custom `Symbol.hasInstance` | <span className="db-tier t-understand">Understand</span> |
| **Assertion functions** — `asserts x is T` and `asserts x`, how they differ from guards, and the explicit-annotation requirement | <span className="db-tier t-understand">Understand</span> |
| **`unknown` in `catch`** — `useUnknownInCatchVariables`, and the fact that JavaScript can throw anything, so every handler starts by proving what it caught | <span className="db-tier t-understand">Understand</span> |
| The non-null assertion `!` — when it is legitimate, and why it is usually a missing guard in disguise | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can take a union of four API response shapes and
handle every case with zero assertions, and make adding a fifth shape break the
build.

---

## Phase 3 — Generics

*14 topics.* Writing code for a type you have not been told yet. The bar here
is not "can you read `Array<T>`" — it is whether you can write a function whose
return type depends on its arguments, and explain where inference comes from.

| Topic | Tier |
|---|---|
| **Generic functions and inference** — the type parameter is usually inferred, not passed; what the compiler infers it *from* | <span className="db-tier t-master">Master</span> |
| **Constraints — `T extends …`** — restricting what a type parameter can be, and why an unconstrained `T` gives you almost nothing to work with | <span className="db-tier t-master">Master</span> |
| **Generic interfaces and type aliases** — `ApiResult<T>`, `Repository<T>`, and parameterising your own data structures | <span className="db-tier t-master">Master</span> |
| **`keyof`** — the union of an object type's keys, and why it is the entry point to every advanced type | <span className="db-tier t-master">Master</span> |
| **The `getProp` pattern** — `<T, K extends keyof T>(obj: T, key: K) => T[K]`, the pattern behind every typed accessor you will write | <span className="db-tier t-master">Master</span> |
| **Indexed access types — `T[K]`** — reading a property's type out of an object type, including `T[number]` on arrays and tuples | <span className="db-tier t-understand">Understand</span> |
| **The `typeof` type operator** — lifting a runtime value into the type world, and `typeof x[number]` for deriving a union from a `const` array | <span className="db-tier t-understand">Understand</span> |
| **Default type parameters** — `<T = string>`, sensible defaults, and how they interact with inference | <span className="db-tier t-understand">Understand</span> |
| **Generic classes** — parameterising state, the static-member restriction, and where a generic class beats a generic function | <span className="db-tier t-understand">Understand</span> |
| **Inference sites and contextual typing** — why inference works from arguments but not from the return position, and the three places it commonly fails | <span className="db-tier t-understand">Understand</span> |
| **`infer` in conditional types** — pulling a type back out: element types, resolved promise types, function return types | <span className="db-tier t-understand">Understand</span> |
| **`const` type parameters** — `<const T>` so callers get literal types without writing `as const` at every call site | <span className="db-tier t-understand">Understand</span> |
| **When *not* to write a generic** — a type parameter used exactly once is a disguised `any`; the readability cost of over-parameterising | <span className="db-tier t-understand">Understand</span> |
| Variance — covariance, contravariance, method-parameter bivariance, `strictFunctionTypes`, and the explicit `in`/`out` annotations | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can write a typed `pick(obj, keys)` from an empty
file, with the return type computed from the arguments, and say exactly which
argument each inference came from.

---

## Where this connects

- **Phase 0 → Phase 6** — `module` and `moduleResolution` are named here and
  explained properly once modules are the subject.
- **Phase 1 → Phase 5** — mapped and conditional types are `keyof`,
  indexed access and unions turned into machinery.
- **Phase 2 → Phase 9** — narrowing is the *static* half of trusting data;
  runtime validation at the boundary is the other half, and neither works alone.
- **Phase 3 → Part 3** — every typed handler, hook and query result in the
  stack phases is a constrained generic.
- **Deliberately not here:** JavaScript's own semantics — closures, `this`,
  coercion, prototypes. Those are the JavaScript syllabus, and this one assumes
  them.

---

← [Overview](../README.md) · Next: [Part 2 — Types at scale](./02-types-at-scale.md) →
