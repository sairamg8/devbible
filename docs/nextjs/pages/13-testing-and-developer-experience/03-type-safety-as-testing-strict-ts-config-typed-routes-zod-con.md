---
title: "strict: true is a family of nine checks, and the two flags that catch the bugs your unit tests were going to catch are not in it"
sidebar_label: "3 · Strict TS config as a test suite"
sidebar_position: 5
description: "What strict actually enables, why noUncheckedIndexedAccess and exactOptionalPropertyTypes sit outside the family, the App Router code paths where each one fires, and a migration order that does not stall a team on 4,000 new errors."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the TypeScript reference — [`strict`](https://www.typescriptlang.org/tsconfig/strict.html), [`noUncheckedIndexedAccess`](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html), [`exactOptionalPropertyTypes`](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html), [Compiler Options](https://www.typescriptlang.org/docs/handbook/compiler-options.html) — and [TypeScript configuration](https://nextjs.org/docs/app/api-reference/config/typescript) (lastUpdated 2026-08-25). Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4** · TypeScript **7.0.2** · React 19.2.8 · Node.js 24.20.0.

**A type checker and a test suite are both falsification machines, and the type checker is the cheaper one: it runs on every keystroke, it needs no fixtures, and it covers every call site rather than the ones somebody remembered to write a test for. What it does not do is cover anything you did not configure it to cover. `create-next-app` gives you `"strict": true`, teams read that word and stop, and the two compiler options that would have caught the most common runtime failure in an App Router codebase — reading a key that is not there — are still off. This page is about closing that gap deliberately, and about the cost of each flag, because every one of them buys correctness with noise.**

## What `strict` actually turns on

`strict` is not a check. It is a switch over a named set of checks:

> *"The `strict` flag enables a wide range of type checking behavior that results in stronger guarantees of program correctness. Turning this on is equivalent to enabling all of the strict mode family options, which are outlined below. You can then turn off individual strict mode family checks as needed."*

The family is nine flags. Each is documented with the default `true if strict; false otherwise`:

| Flag | What it stops |
|---|---|
| `noImplicitAny` | A parameter or declaration silently becoming `any` |
| `strictNullChecks` | `null` and `undefined` being assignable to everything |
| `strictFunctionTypes` | Contravariant parameter positions being checked bivariantly |
| `strictBindCallApply` | `fn.call(x, wrong, args)` type-checking |
| `strictPropertyInitialization` | A class field declared and never assigned in the constructor |
| `strictBuiltinIteratorReturn` | Built-in iterators reporting `TReturn` as `any` |
| `noImplicitThis` | `this` being `any` inside a detached function |
| `alwaysStrict` | Emitting without `'use strict'` |
| `useUnknownInCatchVariables` | `catch (e)` giving you `any` instead of `unknown` |

The flag also moves under you between releases, which is a real upgrade cost and worth knowing before a TypeScript major:

> *"Future versions of TypeScript may introduce additional stricter checking under this flag, so upgrades of TypeScript might result in new type errors in your program. When appropriate and possible, a corresponding flag will be added to disable that behavior."*

## The flags outside the family

These are **not** enabled by `strict`, and they are the ones that pay:

- `noUncheckedIndexedAccess`
- `exactOptionalPropertyTypes`
- `verbatimModuleSyntax`
- `noImplicitOverride`
- `noFallthroughCasesInSwitch`
- `noPropertyAccessFromIndexSignature`

They sit outside because each one produces errors in correct-looking code that the vast majority of existing projects contain, in volume. That is not a reason to leave them off; it is a reason to turn them on one at a time. The first two are covered below. `verbatimModuleSyntax` and the module-boundary flags are on [3b · Module syntax and the erasure boundary](03b-module-syntax-and-where-types-stop.md).

## `noUncheckedIndexedAccess`: the flag that finds the bug your tests were going to find

The mechanism is one sentence:

> *"Turning on `noUncheckedIndexedAccess` will add `undefined` to any un-declared field in the type."*

That is: any read through an **index signature** — an array index, a `Record<K, V>` lookup, a `[key: string]: T` member — becomes `T | undefined`.

An App Router codebase is full of index signatures whether you wrote them or not. The `searchParams` prop is declared by the framework as exactly that:

> *"`searchParams: Promise<{ [key: string]: string | string[] | undefined }>`"*

Four places it fires in SprintDesk, all of them real runtime failures:

```ts
// app/(app)/teams/[teamId]/board/page.tsx
import { getBoard } from '@/lib/data/boards'

export default async function BoardPage(props: PageProps<'/teams/[teamId]/board'>) {
  const { teamId } = await props.params
  const query = await props.searchParams

  // 1 — repeated query keys become arrays. `?status=todo&status=doing`
  //     gives `['todo','doing']`, not a string. Without the flag this is
  //     typed `string | string[] | undefined` already; the flag is what
  //     stops you writing `query.status.toUpperCase()` on the union.
  const rawStatus = query.status

  const board = await getBoard(teamId)

  // 2 — Record lookup. `columns` is Record<string, Task[]>, so with the
  //     flag `columns['done']` is `Task[] | undefined`, which is the truth:
  //     a board with no done tasks has no `done` key.
  const doneTasks = board.columns['done'] ?? []

  // 3 — array index after a filter. `.filter()` cannot narrow length.
  const overdue = board.tasks.filter((t) => t.dueAt !== null)
  const firstOverdue = overdue[0] // Task | undefined, correctly

  // 4 — process.env is an index signature over string.
  const apiBase = process.env.SPRINTDESK_API_BASE // string | undefined

  return <Board tasks={doneTasks} first={firstOverdue} apiBase={apiBase} />
}
```

Case 3 is the one that ships. `overdue[0].title` compiles happily without the flag and throws `Cannot read properties of undefined` the first time a team has no overdue tasks — which is the happy path, so nobody hit it in review.

### The noise, and the four honest answers

The flag's cost is real: `for (let i = 0; i < arr.length; i++) { arr[i].x }` now errors, and it errors on code that is provably fine. Do not reach for `!`. Reach for the construct that makes the narrowing visible:

```ts
// ✗ silences the checker and keeps the risk
const first = overdue[0]!

// ✓ 1. iterate values, not indices — `t` is Task, no index signature involved
for (const t of overdue) {
  console.log(t.title)
}

// ✓ 2. destructure with a default when a fallback is genuinely correct
const [firstTask = null] = overdue

// ✓ 3. narrow once and use the narrowed binding
const candidate = overdue[0]
if (candidate) {
  await notifyAssignee(candidate)
}

// ✓ 4. make the impossible state unrepresentable at the boundary instead —
//      a function that must return one task should say so
function requireTask(tasks: Task[]): Task {
  const [task] = tasks
  if (!task) throw new Error('expected at least one task')
  return task
}
```

`Object.groupBy` and `Map.get` already return `| undefined` without the flag; `Record` and array indexing are the two that lie by default.

## `exactOptionalPropertyTypes`: `undefined`-present is not key-absent

> *"With `exactOptionalPropertyTypes` enabled, TypeScript applies stricter rules around how it handles properties on `type` or `interfaces` which have a `?` prefix."*

Without it, `assigneeId?: string` accepts three values: a string, absent, and *explicitly* `undefined`. The docs are blunt that those last two are not the same thing:

> *"`colorThemeOverride: undefined` is not the same as `colorThemeOverride` not being defined."*

> *"`"colorThemeOverride" in settings` would have different behavior with `undefined` as the key compared to not being defined."*

The error text, quoted from the TypeScript documentation, is `Type 'undefined' is not assignable to type '"dark" | "light"' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the type of the target.`

### Why this is a data-layer bug, not a pedantry

Every ORM and every JSON serialiser distinguishes the two. A partial update built by object literal is where it bites:

```ts
// lib/data/tasks.ts — WRONG under any ORM that maps keys to SET clauses
type TaskPatch = {
  title?: string
  assigneeId?: string
  dueAt?: Date
}

function buildPatch(form: { title?: string; assigneeId?: string }): TaskPatch {
  return {
    title: form.title,
    assigneeId: form.assigneeId, // present-and-undefined when unset
  }
}
```

`buildPatch({ title: 'Ship it' })` returns an object where `'assigneeId' in patch` is `true`. Drizzle's `.set()` will emit `assignee_id = NULL` — the update silently unassigns the task. `JSON.stringify` drops the key, so an API round-trip hides it; a direct database write does not. `exactOptionalPropertyTypes` rejects that assignment at the line that wrote it.

The fix is to build the object conditionally, so the key exists only when there is a value:

```ts
// lib/data/tasks.ts — correct under exactOptionalPropertyTypes
function buildPatch(form: { title?: string; assigneeId?: string }): TaskPatch {
  const patch: TaskPatch = {}
  if (form.title !== undefined) patch.title = form.title
  if (form.assigneeId !== undefined) patch.assigneeId = form.assigneeId
  return patch
}

// and when "clear the assignee" is a real operation, model it explicitly
type TaskPatchWithClears = TaskPatch & { assigneeId?: string | null }
```

That last line is the design point. If unassigning is a thing your product does, `undefined` was never the right encoding for it — `null` is, and now the type says so.

### The two interactions that surprise people

`Partial<T>` produces `?` properties, so `Partial<Task>` under this flag stops accepting `{ assigneeId: undefined }`. And spreading is *not* affected: `{ ...patch, title: maybeUndefined }` still creates a present key holding `undefined`, and the checker will now tell you so.

## The migration order that does not stall

Turning all six on at once in an existing SprintDesk-sized app produces thousands of errors and the branch dies. The order that works, one merged PR per step:

1. `noImplicitOverride` and `noFallthroughCasesInSwitch` — usually single-digit error counts.
2. `noUncheckedIndexedAccess` — largest count, most value. Fix it directory by directory; the data layer first, because that is where a wrong `undefined` becomes a wrong row.
3. `exactOptionalPropertyTypes` — smaller, concentrated in mutation code and prop-spreading components.
4. `verbatimModuleSyntax` — mechanical, and a codemod-shaped change ([3b](03b-module-syntax-and-where-types-stop.md)).

While a step is mid-flight, Next.js gives you a documented way to keep the production build green without weakening your editor. `typescript.tsconfigPath` selects a different config for `next dev`, `next build` and `next typegen`:

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typescript: {
    tsconfigPath: process.env.NODE_ENV === 'production'
      ? 'tsconfig.build.json'
      : 'tsconfig.json',
  },
}

export default nextConfig
```

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noUncheckedIndexedAccess": false
  }
}
```

The Next.js documentation names this exact use case:

> *"You might need to relax checks in scenarios like monorepos, where the build also validates shared dependencies that don't match your project's standards"*

🔴 It also names the trap: *"In development, only `tsconfig.json` is watched for changes."* Edit `tsconfig.build.json` and the dev server keeps the old settings until you restart it.

**Where these checks actually run during a build** — the project-local `tsc` CLI, what it covers that the old in-process checker did not, and why `experimental.useTypeScriptCli` is an opt-*out* — is [12 · TypeScript 7 and build type checking](12-typescript-7-and-build-type-checking.md). Do not configure the flags without reading it: the CLI checker type-checks your test files too, which is the whole reason a strictness bump can suddenly fail a build that passed yesterday.

## Gotchas

**★ Symptom: `strict: true` is set and `undefined` still gets into production.** Cause: `strict` does not include `noUncheckedIndexedAccess`, and the read that produced the `undefined` went through an index signature — an array index, a `Record` lookup, `process.env`, or `searchParams`. `strictNullChecks` only checks declared optionality; it has no opinion about keys that were never declared. Fix: add `"noUncheckedIndexedAccess": true` and resolve the errors with iteration, destructuring defaults or an explicit narrow — see the four forms above.

**★ Symptom: a Server Action that updates one field wipes another.** Cause: the patch object carries `assigneeId: undefined` as a present key, and the ORM translates a present key into a `SET` clause. Fix: `exactOptionalPropertyTypes: true` plus conditional key assignment, and model "clear this field" as `null` rather than `undefined`.

**★ Symptom: the flag was enabled, the errors were fixed with `!`, and the bug happened anyway.** Cause: `!` is an assertion, not a check — it erases at compile time and changes nothing at runtime. Fix: treat every `!` you write during a strictness migration as a TODO. If a value genuinely cannot be absent, write the function that proves it (`requireTask` above) once, and call it.

**★ Symptom: turning on `noUncheckedIndexedAccess` produces thousands of errors in test files that were previously ignored.** Cause: under Next.js 16 `next build` runs the project-local `tsc` CLI, and *"The CLI checks the complete project selected by your `tsconfig` file. This includes test files"*. Fix: either fix them, or give the build a `tsconfig.build.json` that excludes `**/*.test.ts` — but then run `tsc --noEmit` against the full `tsconfig.json` as a separate CI step, or you have moved the errors rather than removed them. See [12](12-typescript-7-and-build-type-checking.md).

**★ Symptom: `tsconfig.build.json` changes have no effect during `next dev`.** Cause: *"In development, only `tsconfig.json` is watched for changes."* Fix: restart the dev server after editing any config selected by `typescript.tsconfigPath`.

**★ Symptom: a TypeScript minor upgrade breaks a build that changed no application code.** Cause: `strict` is documented to gain checks in future versions. Fix: pin TypeScript exactly in `package.json` (not `^`), upgrade it in its own PR, and read the release notes for new strict-family behaviour before merging.

**★ Symptom: `Partial<Task>` stops accepting an object you built with spread.** Cause: `Partial<T>` makes every property `?`, and `exactOptionalPropertyTypes` then rejects `undefined` values in those positions; spread preserves present-but-undefined keys. Fix: build the object with conditional assignment, or widen the field deliberately to `string | undefined` when present-and-undefined is a state you actually mean.

**★ Symptom: `process.env.FOO` is typed `string` and is empty at runtime.** Cause: someone added a `.d.ts` augmenting `ProcessEnv` with required string keys — a hand-written lie that the checker has no way to verify. Fix: do not augment `ProcessEnv`. Parse the environment once through a schema and export the parsed object; that is a runtime check the type derives from, not a promise the type makes on its own. See [3d · Zod at the boundaries a type cannot reach](03d-zod-contract-tests-at-the-boundaries.md).

**★ Symptom: a type error in your own `.d.ts` file never appears.** Cause: the `tsconfig.json` shape the Next.js docs themselves show carries `"skipLibCheck": true`, and that flag skips type checking of **all** declaration files — not only `node_modules`, but the ambient declarations you wrote. Fix: keep `skipLibCheck` on if third-party types are the problem (that is what it is for), but understand that hand-written `.d.ts` files are then unchecked. Put logic-bearing types in `.ts` modules and export them; reserve `.d.ts` for genuinely ambient declarations.

**★ Symptom: an error boundary does `error.digest` and the file will not compile.** Cause: `useUnknownInCatchVariables` is in the strict family, so `catch (e)` gives `unknown` — and correctly, because anything can be thrown. Fix: narrow before you read. `if (e instanceof Error && 'digest' in e)` is the honest form; a `catch (e: any)` annotation compiles and reintroduces exactly the property access that crashes when someone throws a string.

**★ Symptom: `noPropertyAccessFromIndexSignature` errors on `env.NODE_ENV` after enabling it.** Cause: the flag forces index-signature reads to use bracket syntax so that declared and undeclared properties are visually distinguishable. Fix: use `env['NODE_ENV']` for undeclared keys, and *declare* the keys you rely on. The flag's value is exactly this — it makes "I am reading something nobody declared" visible in the source.

## Interview questions

**★ Why is `strict: true` not enough, given the name?**
Because `strict` is a switch over a fixed family of nine flags, and the family was frozen around checks that could be enabled without breaking most existing codebases. `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` were deliberately left outside it because they error on enormous amounts of correct-looking existing code. So a project reading `strict: true` and stopping there has null-safety on declared fields and no null-safety at all on the reads that dominate a web app — arrays, records, query strings and environment variables.

**★ What is the difference between `strictNullChecks` and `noUncheckedIndexedAccess`?**
`strictNullChecks` governs *declared* types: it stops you assigning `null` to a `string` and makes an `x?: string` field `string | undefined` when you read it. `noUncheckedIndexedAccess` governs *undeclared* keys: it adds `undefined` to anything you reach through an index signature. They are orthogonal. With `strictNullChecks` alone, `tasks[42]` is typed `Task` regardless of the array's length, which is simply false.

**★ Give a concrete bug that `exactOptionalPropertyTypes` prevents and `strict` does not.**
A partial-update path. `{ title: 'x', assigneeId: undefined }` satisfies `{ title?: string; assigneeId?: string }` under plain `strict`, and an ORM that maps object keys to `SET` clauses will write `assignee_id = NULL`. The user renamed a task and lost its assignee. The bug survives code review because `JSON.stringify` drops undefined values, so any test that round-trips through JSON passes.

**★ Why is `!` the wrong way to satisfy `noUncheckedIndexedAccess`?**
Because the flag's entire value is that it forces you to state, in code that survives to runtime, what you believe about the presence of a value. `!` states the belief only to the compiler and emits nothing. If the belief is right, an `if` costs one branch; if it is wrong, the `if` gives you a controlled failure and the `!` gives you a `TypeError` deep inside a render. The only defensible `!` is one immediately after a check the compiler cannot see, and even then a helper that throws is more honest.

**★ When would you deliberately keep a strictness flag off?**
When it is off in a shared dependency you do not control and the build validates that dependency's sources. The Next.js docs describe exactly this monorepo case and give `tsconfigPath` as the escape: keep `tsconfig.json` strict for the editor and point the production build at a relaxed `tsconfig.build.json`. That is a scoped, documented, temporary relaxation with a named reason — which is different from turning the flag off globally because it produced errors.

**★ How does a strictness change interact with CI in Next.js 16?**
`next build` runs your project-local `tsc` CLI over the complete project the `tsconfig` selects — including test files and generated types under `.next/dev/types`. So a flag added to `tsconfig.json` can fail the build from files that the old in-process checker never looked at. It also means the type check is now genuinely the same check your editor runs, which is why running `next typegen && tsc --noEmit` in CI reproduces the build failure without a full build.

**★ Is a type check a substitute for a test?**
For the class of properties it can express, it is strictly better: it is exhaustive over call sites, it costs nothing per assertion, and it cannot go stale. For everything else it is not a test at all, because types are erased. It cannot tell you whether the value that arrived at runtime matches the type you wrote — that is a parsing problem, and it belongs to a schema at the boundary. The right mental model is a division of labour: types cover the interior of the program, parsers cover its edges, and tests cover behaviour that neither can express.

---

← [PPR, Activity and CI](02b-testing-ppr-activity-and-playwright-in-ci.md) · [Chapter 13 overview](01-explanation.md) · Next → [Module syntax and where types stop](03b-module-syntax-and-where-types-stop.md)
