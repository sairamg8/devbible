---
title: "Part 2 — Types at scale"
sidebar_label: "2 · Types at scale"
sidebar_position: 2
---

> **Phases 4–6 · 46 topics · 7 Master**
> Classes and the declaration system, types that compute other types, and the
> part nobody warns you about: making the compiler and the runtime agree on
> what a module is.

Low on Master by design. This is the part you *understand* and then look up —
except for module resolution and `import type`, which you will hit on your first
day in any real codebase.

---

## Phase 4 — Classes, objects and declaration merging

*14 topics.* TypeScript's class syntax is mostly JavaScript's, so this phase is
short on the class and long on the two things that are genuinely TypeScript:
**declaration merging** and **module augmentation** — the mechanism behind every
`req.user` you have ever seen typed.

| Topic | Tier |
|---|---|
| **Module augmentation — `declare module`** — adding properties to somebody else's types; how `req.user`, custom `globalThis` keys and library plugins are typed | <span className="db-tier t-master">Master</span> |
| **Access modifiers** — `public`/`private`/`protected` are **compile-time only**; `#private` is real at runtime; when the difference matters | <span className="db-tier t-understand">Understand</span> |
| **Parameter properties** — `constructor(private readonly repo: Repo)`, and the fact that they **emit code**, so Node's strip-only mode rejects them | <span className="db-tier t-understand">Understand</span> |
| **`implements` vs `extends`** — a contract check that adds no inference, versus real inheritance; why `implements` alone will not infer your member types | <span className="db-tier t-understand">Understand</span> |
| **Interface declaration merging** — two declarations of one interface combine; the feature `type` deliberately lacks, and the accidents it causes | <span className="db-tier t-understand">Understand</span> |
| **Global augmentation** — `declare global`, typing `globalThis`, and why it only works inside a module | <span className="db-tier t-understand">Understand</span> |
| **Branded / nominal types** — `type UserId = string & { readonly __brand: unique symbol }`, stopping a `PostId` being passed where a `UserId` belongs | <span className="db-tier t-understand">Understand</span> |
| **`readonly` members and definite assignment `!:`** — the two ways to promise the compiler a field will exist, and what each actually guarantees | <span className="db-tier t-understand">Understand</span> |
| **Typing getters and setters** — divergent getter/setter types, and validation on write | <span className="db-tier t-know">Know</span> |
| **`this` types and polymorphic `this`** — fluent builders that keep the subclass type through a chain | <span className="db-tier t-know">Know</span> |
| **Abstract classes and abstract construct signatures** — typing "a class, not an instance", and `new (…args) => T` | <span className="db-tier t-know">Know</span> |
| **Static members, static blocks and the static side of a class** — why the instance type and the constructor type are two different types | <span className="db-tier t-know">Know</span> |
| **Decorators (stage 3)** — the current standard form, what the type signatures mean, and the older `experimentalDecorators` you will still meet in NestJS/TypeORM | <span className="db-tier t-know">Know</span> |
| Mixins — the constructor-returning-class pattern, and its type cost | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you can add a typed property to `Express.Request` from
scratch, and explain why it must live in a file the compiler actually includes.

---

📖 **Explanation written:** [Phase 4 — Classes, objects and declaration merging](../pages/phase-4-classes-declarations/README.md)

## Phase 5 — Type-level programming

*16 topics.* Types that take types as input. The useful 20 % — mapped types,
conditional types, the built-in utilities — is what libraries and your own
helpers are made of. The rest is a skill with a strict discipline attached:
**a clever type that produces an unreadable error message is a net loss.**

📖 **Explanation written:** [Phase 5 — Type-level programming](../pages/phase-5-type-level/README.md)

| Topic | Tier |
|---|---|
| **Mapped types** — `{ [K in keyof T]: … }`, adding and removing `?` and `readonly` with `+`/`-`, and building your own `Partial` | <span className="db-tier t-master">Master</span> |
| **Conditional types** — `T extends U ? X : Y`, the assignability question it actually asks, and nesting them readably | <span className="db-tier t-master">Master</span> |
| **The built-in utility types** — `Partial`, `Required`, `Pick`, `Omit`, `Record`, `Exclude`, `Extract`, `NonNullable`; which are mapped types and which are conditional, so you can write the missing one | <span className="db-tier t-master">Master</span> |
| **Key remapping — `as` in a mapped type** — renaming keys, prefixing (`on${Capitalize<K>}`), and filtering keys out by mapping to `never` | <span className="db-tier t-understand">Understand</span> |
| **Distributive conditional types** — why a conditional over a union applies member by member, and the `[T] extends [U]` trick to stop it | <span className="db-tier t-understand">Understand</span> |
| **Extracting with `infer`** — `ReturnType`, `Parameters`, `Awaited`, `InstanceType`, and writing your own extractor | <span className="db-tier t-understand">Understand</span> |
| **Template literal types** — `` `${Method} ${Path}` ``, `Capitalize`/`Uppercase`, and typed event names or route strings | <span className="db-tier t-understand">Understand</span> |
| **Knowing when to stop** — the readability test: if the error message a caller sees is worse than the bug the type prevents, delete the type | <span className="db-tier t-understand">Understand</span> |
| **Type-level performance** — instantiation depth, `error TS2589: Type instantiation is excessively deep and possibly infinite`, and what makes a codebase's checker slow | <span className="db-tier t-understand">Understand</span> |
| **Deriving one function's type from another** — reusing `Parameters<typeof f>` for wrappers, decorators and adapters | <span className="db-tier t-understand">Understand</span> |
| **Recursive types** — walking a nested object at the type level, and the recursion limits you hit | <span className="db-tier t-know">Know</span> |
| **`DeepPartial` / `DeepReadonly`** — how they are built, and why they wreck error messages and IDE performance in big shapes | <span className="db-tier t-know">Know</span> |
| **Tuple manipulation** — head/tail, length, variadic tuple types, and typing `bind`/`curry` | <span className="db-tier t-know">Know</span> |
| **`NoInfer<T>`** — blocking a bad inference site so a caller gets the error where the mistake is | <span className="db-tier t-know">Know</span> |
| Union → intersection, and other identities worth recognising in library code | <span className="db-tier t-know">Know</span> |
| Higher-kinded types — what TypeScript cannot express, and the interface-map workaround libraries use | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you can write `Pick`, `Omit` and `ReturnType` from an
empty file, and explain what error a caller gets when each is used wrongly.

---

## Phase 6 — Modules, declarations and the build

*16 topics.* Where TypeScript stops being a type system and starts being a build
tool. This phase resolves most "it compiles but crashes at runtime" reports —
because the compiler was modelling a module system your runtime does not use.

| Topic | Tier |
|---|---|
| **`module` and `moduleResolution`** — `node16`/`nodenext` vs `bundler` vs the legacy `node10`; picking the one that matches what actually loads your code, and the failures each produces | <span className="db-tier t-master">Master</span> |
| **`import type` / `export type` and `verbatimModuleSyntax`** — why a type-only import must be erasable, and the runtime import that vanished and broke a side effect | <span className="db-tier t-master">Master</span> |
| **Path aliases — `paths`** — the trap that defines this phase: `tsc` resolves `@/lib`, **Node does not**, so it must be resolved again at runtime by a bundler, `imports` map or loader | <span className="db-tier t-master">Master</span> |
| **`lib`, `target` and the ambient environment** — DOM vs Node globals, `@types/node`, and why `structuredClone` is missing from your types but present at runtime | <span className="db-tier t-understand">Understand</span> |
| **`isolatedModules`** — the constraint every single-file transpiler needs, and the three patterns it bans | <span className="db-tier t-understand">Understand</span> |
| **File extensions** — `.ts`/`.mts`/`.cts`/`.d.ts`, `allowImportingTsExtensions`, `rewriteRelativeImportExtensions`, and writing the extension the *runtime* wants | <span className="db-tier t-understand">Understand</span> |
| **Authoring `.d.ts` files** — declaring a module's public surface by hand, and when you should | <span className="db-tier t-understand">Understand</span> |
| **Typing an untyped dependency** — `declare module 'legacy-lib'`, the shim that unblocks you today, and the upstream PR that fixes it properly | <span className="db-tier t-understand">Understand</span> |
| **`esModuleInterop` and default imports** — what `import express from 'express'` means for a CommonJS package, and the `__importDefault` helper | <span className="db-tier t-understand">Understand</span> |
| **`skipLibCheck`** — nearly everyone sets it; know exactly which errors you are agreeing not to see | <span className="db-tier t-understand">Understand</span> |
| **Publishing a typed package** — `exports`, `types`/`typesVersions`, dual ESM/CJS, and validating it with `arethetypeswrong` and `publint` | <span className="db-tier t-understand">Understand</span> |
| **Sharing types across a monorepo** — source imports vs built `.d.ts`, and the editor-vs-build divergence each causes | <span className="db-tier t-understand">Understand</span> |
| **Project references and `tsc -b`** — `composite`, build order, and when a monorepo actually needs them | <span className="db-tier t-know">Know</span> |
| **Incremental builds** — `.tsbuildinfo`, what invalidates it, and caching it in CI | <span className="db-tier t-know">Know</span> |
| **`isolatedDeclarations`** — declaration emit without full type inference, the explicit-annotation cost, and the build speed it buys | <span className="db-tier t-know">Know</span> |
| Typing non-code imports — CSS modules, JSON (`resolveJsonModule`), images, and `?raw`-style bundler suffixes | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can explain why an import that type-checks can
still throw `ERR_MODULE_NOT_FOUND` at runtime, and name the three places that
mismatch can come from.

---

## Where this connects

- **Phase 4 → Phase 7** — module augmentation is *how* `req.user` gets typed;
  Phase 7 does it in an Express app end to end.
- **Phase 5 → Phase 9** — `z.infer` is a conditional type with `infer` in it.
  Knowing that is the difference between using a schema library and debugging one.
- **Phase 6 → Node Phase 1** — TypeScript models module resolution; Node
  *performs* it. When the two disagree, Node wins, and the Node syllabus is
  where the runtime rules live.
- **Phase 6 → Phase 12** — `skipLibCheck`, `isolatedDeclarations` and project
  references are also the main levers on compile time.
- **Deliberately not here:** how ESM and CJS behave at runtime, the resolution
  algorithm, and `package.json` `exports` semantics — Node Phase 1 owns those.

---

← [Part 1 — The type system](./01-type-system.md) · Next: [Part 3 — TypeScript in the stack](./03-in-the-stack.md) →
