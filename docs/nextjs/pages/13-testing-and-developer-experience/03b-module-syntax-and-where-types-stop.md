---
title: "Import elision is the one place where erasing types changes what your program does at runtime, and in an App Router codebase the module graph is a boundary you can ship a secret across"
sidebar_label: "3b · Module syntax and where types stop"
sidebar_position: 102
description: "What verbatimModuleSyntax changes about emitted imports, why a type-only refactor can add or remove a runtime import, the import type discipline that keeps server modules out of client bundles, and the five places where the type system's authority ends."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the TypeScript reference — [`verbatimModuleSyntax`](https://www.typescriptlang.org/tsconfig/verbatimModuleSyntax.html), [Compiler Options](https://www.typescriptlang.org/docs/handbook/compiler-options.html) — and [TypeScript configuration](https://nextjs.org/docs/app/api-reference/config/typescript) (lastUpdated 2026-08-25). Continues [3 · Strict TS config as a test suite](03-type-safety-as-testing-strict-ts-config-typed-routes-zod-con.md). Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4** · TypeScript **7.0.2** · Node.js 24.20.0.

**Everything else TypeScript does is erased: the checker complains, you fix it, and the emitted JavaScript is the same either way. Imports are the exception. TypeScript decides, per import, whether to keep it or drop it — and it decides based on how you used the binding, which means a refactor that touches only types can add or remove a real `import` statement from the file that ships. In an App Router codebase that matters more than it used to, because the module graph *is* the server/client boundary: a module that reaches a `'use client'` file gets bundled for the browser. `verbatimModuleSyntax` removes the inference and makes the emitted import list a syntactic function of the source. That is the whole feature, and it is why this flag belongs in the same conversation as your test suite.**

## Import elision, and what replaces it

> *"By default, TypeScript does something called import elision."*

Elision means: if every binding brought in by an `import` is used only in a type position, TypeScript removes the entire `import` statement from the output. The rule under the flag is stated as a syntactic one:

> *"Any imports or exports without a `type` modifier are left around. Anything that uses the `type` modifier is dropped entirely."*

> *"With this new option, what you see is what you get."*

The documentation's own three cases:

```ts
// Erased away entirely.
import type { A } from "a";

// Rewritten to 'import { b } from "bcd";'
import { b, type c, type d } from "bcd";

// Rewritten to 'import {} from "xyz";'
import { type xyz } from "xyz";
```

The third line is the one worth staring at. `import {} from "xyz"` is a **side-effect import** — the module is still fetched and still evaluated, its top-level code still runs. Under elision that line would have vanished. Under `verbatimModuleSyntax` it survives, because you wrote an import with no `type` modifier on the statement itself. What you see is what you get, including the parts you did not mean.

## Why this is a boundary problem, not a style problem

SprintDesk's data layer imports the database client at module scope. A client component wants the `Task` shape for its props:

```tsx
'use client'

// The binding `Task` is a type. The binding `getBoard` is a value.
import { getBoard, Task } from '@/lib/data/boards'

export function TaskCard({ task }: { task: Task }) {
  return <article>{task.title}</article>
}
```

Today `getBoard` is unused, every remaining binding is type-only, and the import is elided — `@/lib/data/boards` never enters the client graph. Tomorrow someone adds a debug `console.log(getBoard.name)` in a branch, or a barrel file re-exports something, and the same line stops being elided: the data module is now a client dependency, it pulls in the database driver, and the bundler either fails loudly or — if the module happens to be import-safe — quietly ships it.

The discipline that makes this impossible is one keyword:

```tsx
'use client'

import type { Task } from '@/lib/data/boards'

export function TaskCard({ task }: { task: Task }) {
  return <article>{task.title}</article>
}
```

`import type` cannot become a runtime import by accident, because adding a value use of a type-only import is itself a compile error. The import list stops depending on the body of the file. That is a property you can enforce with a lint rule and never think about again — and `verbatimModuleSyntax` is what makes the compiler force the annotation rather than infer it.

🔴 This does **not** replace `import 'server-only'`. A bare side-effect import of `server-only` is never elided under either setting, and it fails the build when a server module reaches a client bundle for *any* reason, including a genuine value import somebody meant to write. `import type` is the convention; `server-only` is the guard. Use both.

## The re-export rule, and the error you will actually see

A single-file transpiler — SWC in Next.js, esbuild, Babel — compiles one module at a time with no cross-file type information. Given `export { Task } from './boards'`, it cannot know whether `Task` is a type to erase or a value to re-export, and both choices are wrong half the time. TypeScript resolves this by refusing the line:

> *"Re-exporting a type when **'verbatimModuleSyntax'** is enabled requires using 'export type'."*

So a barrel file has to declare its intent:

```ts
// lib/data/index.ts
export { getBoard, createTask } from './boards'
export type { Task, Board, TaskStatus } from './boards'
```

The identical diagnostic exists for `isolatedModules`; the message is generated from whichever flag is on, which is why the two feel like the same rule. The TypeScript track in this bible covers the single-file compiler model in depth under `isolatedModules` — read it if you want the checker-internals version. For a Next.js codebase the practical statement is: `verbatimModuleSyntax` is a superset, and turning it on makes barrel files honest.

One constraint the docs are explicit about: under the flag, emitting CommonJS with `require`/`module.exports` requires TypeScript's pre-ES2015 module syntax (`import fs = require('fs')`), otherwise *"you'll get an error"*. In practice that only bites in a `next.config` or a script that is genuinely CommonJS — note that `next.config.ts` module resolution *"is currently limited to CommonJS"* unless you are on Node's native TypeScript resolver, which is exactly the file where you might meet it.

## The three flags that finish the job

| Flag | What it catches | Cost |
|---|---|---|
| `noImplicitOverride` | A subclass method that no longer overrides anything because the base renamed it | Requires the `override` keyword; a mechanical, one-time edit |
| `noFallthroughCasesInSwitch` | A missing `break` in a `TaskStatus` switch — the exact shape of a board bug | Zero, unless you fall through on purpose, which you then write as an empty case |
| `noPropertyAccessFromIndexSignature` | `config.someKey` reading through an index signature as if it were declared | Forces `config['someKey']`, which is the point: undeclared reads look undeclared |

## Where the type system stops

Everything above is about the interior of the program. At the edges, TypeScript has no authority at all, because types are erased before any of these values exist. There are exactly five doors in a Next.js app, and each one hands you a value the compiler is willing to describe and unable to check:

1. **`JSON.parse`** returns `any`. Whatever you annotate it as, that is a claim, not a check.
2. **`Response.json()`** — the same, for every third-party API call you make from a Server Component or Route Handler.
3. **`searchParams`** is typed `Promise<{ [key: string]: string | string[] | undefined }>` and that type is *accurate*, which is worse than inaccurate: it is accurate and useless. `?page=abc` is a perfectly valid `string`.
4. **`FormData`** — `formData.get('title')` returns `FormDataEntryValue | null`, a union of `string` and `File`. Everything downstream of that read is your assertion.
5. **`process.env`** — an index signature over `string`, so every variable is `string | undefined` under `noUncheckedIndexedAccess` and a bare `string` without it. A hand-written `ProcessEnv` augmentation makes the type say `string` and changes nothing about whether the variable is set.

`as` is how you tell the compiler to stop asking. It is not a conversion and it emits nothing. The operator you actually want at most of these sites is `satisfies`, which checks a value against a type **without widening or replacing the value's inferred type**:

```ts
// lib/board/columns.ts
import type { TaskStatus } from '@/lib/data/boards'

export const columnLabels = {
  todo: 'To do',
  doing: 'In progress',
  done: 'Done',
} satisfies Record<TaskStatus, string>

// `columnLabels.todo` is still the literal 'To do', not `string`,
// AND adding a fourth TaskStatus now fails this file at compile time.
```

`as Record<TaskStatus, string>` would have silenced the missing-key error. `satisfies` reports it and keeps the literal types. Everywhere you are tempted to write `as` on a value you construct yourself, `satisfies` is the correct tool; `as` is only for values you receive.

For the five doors above, neither operator helps — those need a runtime parse, which is [3d · Zod at the boundaries a type cannot reach](03d-zod-contract-tests-at-the-boundaries.md). The one door Next.js closes *for* you is the route table, and that is [3c · Typed routes and generated types](03c-typed-routes-and-generated-types.md).

## Gotchas

**★ Symptom: a client bundle suddenly contains the database driver, and the diff that caused it touched no imports.** Cause: an import that was previously elided stopped being elided, because a binding from it became used in a value position somewhere in the file. Fix: `import type` for every type-only import, `verbatimModuleSyntax: true` so the compiler requires the annotation, and `import 'server-only'` at the top of every module that must never reach the browser.

**★ Symptom: a module's top-level side effect stops running after a refactor.** Cause: the module was imported for its bindings, all remaining bindings became type-only, and the whole import was elided. Fix: import it for its effect explicitly — `import './register-locales'` — which is never elided under either setting. Under `verbatimModuleSyntax` an `import { type x } from 'm'` also survives as `import {} from 'm'`, which is a footgun in the other direction: you can keep a module in the graph by accident.

**★ Symptom: `TS1205 Re-exporting a type … requires using 'export type'` appears in a barrel file that has worked for two years.** Cause: `verbatimModuleSyntax` (or `isolatedModules`) was just enabled, and single-file transpilation cannot decide whether the re-exported name is a type. Fix: split the barrel into `export { … }` for values and `export type { … }` for types, as shown above. This is mechanical and safe to do in bulk.

**★ Symptom: `next.config.ts` fails to compile under `verbatimModuleSyntax`.** Cause: the file is resolved as CommonJS by default — *"Module resolution in `next.config.ts` is currently limited to CommonJS"* — and the flag forbids emitting CommonJS from ES import syntax. Fix: use `next.config.mts` to declare it an ES module, or move to Node's native TypeScript resolver on Node v22.10.0+ as the Next.js docs describe.

**★ Symptom: `as` "fixed" a type error and the bug is still there.** Cause: `as` is an assertion. It changes the compiler's belief and emits nothing at all. Fix: for values you construct, use `satisfies`, which checks without replacing the inferred type; for values you receive, parse them.

**★ Symptom: adding a fifth `TaskStatus` compiles cleanly and the new column renders blank.** Cause: the lookup table was written with `as Record<TaskStatus, string>`, which asserts completeness rather than checking it. Fix: `satisfies Record<TaskStatus, string>` — the same object literal, now a compile error until the key is added.

**★ Symptom: a `switch` over `TaskStatus` silently handles two statuses the same way.** Cause: a missing `break`, which is legal JavaScript. Fix: `noFallthroughCasesInSwitch: true`, plus an exhaustiveness `default` that assigns the scrutinee to `never` so a new status fails the file rather than falling to a default label.

**★ Symptom: an `interface ProcessEnv` augmentation says `DATABASE_URL: string` and production crashes on a missing variable.** Cause: a declaration merge is an unverified claim about the world. Nothing checks it, at build time or at runtime. Fix: delete the augmentation and parse the environment once at startup; derive the type from the parsed result. See [3d](03d-zod-contract-tests-at-the-boundaries.md).

**★ Symptom: `TaskSchema.parse is not a function` after tidying imports.** Cause: a Zod schema is a *value*. `import type { TaskSchema }` compiles — the name exists — and erases to nothing, so the runtime call finds `undefined`. The paired type is `z.infer<typeof TaskSchema>`, which needs the value import too. Fix: import schemas as values, and put every schema that both a client and a server module needs in a leaf file with no server-only dependencies, because that value import will follow it into the client bundle.

**★ Symptom: `import Foo from './types'` errors under the flag with no obvious cause.** Cause: `Foo` is a type, and the default import has no `type` modifier, so the flag requires the statement to survive to runtime — but there is nothing there to import. Fix: `import type Foo from './types'`. The default-export case is the one people miss when converting a codebase, because the named-import form (`import { type Foo }`) is the one every example shows.

**★ Symptom: `import type` is used everywhere and the client bundle still pulls in a heavy server module.** Cause: something else in the graph imports it for a value — a shared constant, a Zod schema, an enum. Enums in particular are values, not types, and cannot be `import type`d. Fix: move shared constants and schemas into a leaf module with no server-only imports, and run `next experimental-analyze`, which shows the full import chain and traces server-to-client boundaries.

## Interview questions

**★ Why is import elision the only place erasing types changes runtime behaviour?**
Because every other TypeScript construct either has no emit (annotations, interfaces, generics) or a fixed emit (enums, decorators, class fields). Imports are the only construct whose *presence in the output* is decided by type information: TypeScript looks at whether the imported bindings were used as values anywhere in the file and drops the statement if not. So the emitted module graph — which is what a bundler traverses, what a `'use client'` boundary partitions, and what determines whether a module's top-level code runs — is a function of type-level facts. `verbatimModuleSyntax` breaks that dependency.

**★ You have `import type { Task } from '@/lib/data/boards'` in a client component. Is the data module in the client bundle?**
No. `import type` is guaranteed to be erased, and the compiler will reject any attempt to use the binding as a value, so it cannot silently become a runtime import. But that guarantee covers only this import. If a second file in the client graph imports the same module for a value — a constant, an enum, a schema — the module is in the bundle regardless. The type-level guarantee is per-import, not per-module; `server-only` is the per-module guarantee.

**★ Why does `isolatedModules` produce the same error as `verbatimModuleSyntax` for re-exports?**
Because they address the same limitation from different directions. A single-file transpiler has no cross-file type information, so `export { X } from './m'` is undecidable: erasing it breaks value re-exports, keeping it breaks type re-exports under a bundler that resolves imports eagerly. TypeScript refuses the construct rather than guessing, and generates the diagnostic text from whichever flag is enabled. `verbatimModuleSyntax` additionally governs the elision of ordinary imports, which `isolatedModules` does not.

**★ When is `as` legitimate?**
When you are narrowing a value that genuinely arrived from outside the type system and you have already checked it by other means — after a `typeof` guard the compiler cannot follow, or on the result of a parse whose validity you established at runtime. The Next.js docs give a good example: a proxy redirect destination is not a file-system route, so `'/proxy-redirect' as Route` is a deliberate statement that the route exists outside the generated table. What makes it legitimate is that the assertion is doing work no check *could* do, not that a check was inconvenient.

**★ What does `satisfies` buy over an annotation?**
An annotation widens. `const labels: Record<TaskStatus, string> = { … }` makes `labels.todo` a `string`, losing the literal, and it also accepts any object with the right shape. `satisfies` checks the literal against the type and then keeps the literal's own inferred type, so you get both completeness checking and narrow value types. For configuration objects, lookup tables and route maps — all of which you want both exhaustive and precisely typed — it is strictly better than either an annotation or an assertion.

**★ Can you `import type` an enum?**
Only for its type side. A TypeScript `enum` compiles to a real object, so `Status.Todo` is a property access on a runtime value; `import type { Status }` erases the import and the access fails at runtime. This bites hard during a bulk conversion to `import type`, because the compiler is happy — the name resolves as a type — and the failure is a `TypeError` in the browser. The durable fix in an App Router codebase is usually to stop using enums: a union of string literals plus a `satisfies`-checked lookup table gives you the same exhaustiveness with no runtime value to import, which means it costs nothing on either side of the `'use client'` boundary.

**★ Give a case where `verbatimModuleSyntax` makes a working build fail, and say whether that is good.**
A `next.config.ts` that uses ES import syntax but is resolved as CommonJS: the flag forbids emitting `require` from `import`, so the file errors. That is good, because the previous behaviour was TypeScript silently rewriting your module system — the same rewrite that makes a file behave differently depending on which bundler consumed it. The failure names a real ambiguity, and the fix (`next.config.mts`, or Node's native resolver) resolves the ambiguity rather than hiding it.

{/* FOOTER */}
