---
title: "Proving it, on a server"
sidebar_label: "01 · Proving it on a server"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **Node.js API docs** (*Errors* — `error.code` as
> the stable identifier, the explicit instruction to identify errors by `code`
> rather than `message`, and the system-error properties `errno`, `syscall`,
> `path`) and the **TypeScript `lib` declarations shipped with the compiler**,
> read directly: `Error.isError` is declared in **`lib.esnext.error.d.ts`** and
> reachable only from `lib.esnext.d.ts`. `Error.isError` and
> `util.types.isNativeError` were confirmed **present at runtime on the
> installed Node 24.19.0** with a `typeof` capability probe — a one-line check,
> not a sandbox, and **no transcript of it is reproduced here**. **No console
> block on this page.**

[Phase 2 · `unknown` in `catch`](../../phase-2-narrowing/12-unknown-in-catch.md)
is the language rule, and it is written: `throw` accepts any expression, so
`catch (e)` is `unknown` under `strict`, `.catch()` still hands you `any`, and
you narrow before you touch anything. **Read that page first; this one does not
repeat it.**

What this chunk adds is the part that only bites once the code is deployed:

> **`instanceof Error` is the weakest guard in a production process**, and every
> reason it fails is a reason that only exists in real deployments — bundling,
> duplicated dependencies, worker threads, `vm` contexts, and values that
> crossed a process boundary.

## Why `instanceof` degrades in production specifically

`instanceof` walks the prototype chain and compares against **one particular
constructor object**. That works when there is exactly one `Error` and one copy
of each class. A deployed Node service routinely has neither.

| Situation | Why the check fails |
|---|---|
| Two copies of a package in `node_modules` | Its `NotFoundError` is a *different constructor object* per copy. Your `catch` imports one; the throw came from the other |
| A bundler duplicating a module | Same cause, created by the build rather than the installer — the "guard that survives bundling" problem |
| `vm` contexts | A separate realm with its own `Error` intrinsic |
| Worker threads / child processes | An error that crossed the boundary was **serialised**. What arrives is a plain object, or a structured clone, not your class |
| An error from a native addon or a C++ binding | May not be a `Error` instance at all in the sense your check means |

None of these is exotic. The first two are the normal state of a
`node_modules` tree, and the fourth is what happens the moment you use a worker
pool.

📌 The failure is also **silent and inverted**: `instanceof` returning `false`
does not throw — it routes a perfectly good error down your "unknown value"
branch, where it gets logged as a mystery and the actual message is discarded.

## The three guards, in order of robustness

### 1. `Error.isError()` — the realm-safe standard answer

This is new enough to be worth stating carefully, because it changes the advice
that was correct a year ago. The declaration, read from the compiler's own
`lib.esnext.error.d.ts`:

```ts
interface ErrorConstructor {
    /**
     * Indicates whether the argument provided is a built-in Error instance or not.
     */
    isError(error: unknown): error is Error;
}
```

It is a **brand check**, not a prototype walk — it asks whether the value is a
genuine `Error` exotic object, so it answers correctly **across realms**. It is
present at runtime on Node 24.19.0, and it is the right default guard on a
current server.

🔴 **Two configuration facts that decide whether you can use it:**

- The declaration lives in `lib.esnext.error.d.ts`, which is referenced **only**
  from `lib.esnext.d.ts`. So `lib: ["es2024"]` — the value
  [topic 01 chunk 04](../01-tsconfig-for-a-node-service/04-the-annotated-configs.md)
  recommends — **does not include it**, and `Error.isError` will not typecheck
  even though your Node has it.
- `module: nodenext` implies `target: esnext`, and an *unspecified* `lib`
  follows the target — so a config that omits `lib` gets it and a config that
  pins `lib` does not. That is the opposite of the usual direction, and it is
  exactly the [`lib` is a promise about the runtime](../01-tsconfig-for-a-node-service/03-target-lib-and-types.md)
  point: here the promise is *too conservative* rather than too optimistic.

The fix is to name the slice rather than widening everything:

```json
{ "compilerOptions": { "lib": ["es2024", "esnext.error"] } }
```

### 2. `util.types.isNativeError()` — the Node-specific equivalent

```ts
import { types } from 'node:util';

if (types.isNativeError(e)) { /* e: Error */ }
```

Also a brand check, also cross-realm, and available far further back than
`Error.isError`. It costs a `node:util` import, which makes it unsuitable for
code shared with a browser bundle — but for server-only code it is the
pragmatic choice when you cannot move `lib` to `esnext`.

### 3. Structural checks — the fallback, and its honest cost

Phase 2 gives the shape (`isErrorLike`). It is the only option that survives an
error which was **serialised** — across a worker boundary, out of a job queue,
back from a subprocess — because at that point the value genuinely is a plain
object and no brand check can say otherwise.

Its cost is precision: `{ message: 'hi' }` passes. That is usually acceptable
for a *logging* path and not acceptable for a *control-flow* path.

📌 **The rule that falls out:** brand-check when you are deciding what to log;
discriminant-check ([chunk 02](./02-making-an-error-recognisable.md)) when you are
deciding what to *do*.

## Match on `code`, and mean it

Node's documentation is unusually direct about this:

> The `error.message` property of errors raised by Node.js may be changed in any
> versions. Use `error.code` to identify an error instead.

So `error.code` is a **stable interface** and `error.message` is not. Every
driver, the filesystem, the network stack and Node itself follow the convention.

```ts
function isCode(e: unknown, code: string): boolean {
  return typeof e === 'object' && e !== null
    && (e as { code?: unknown }).code === code;
}

try {
  return await readConfig(path);
} catch (e) {
  if (isCode(e, 'ENOENT')) return null;   // absent file is not exceptional here
  throw e;
}
```

Note what that helper deliberately does *not* do: it never checks
`instanceof Error` first. **A `code` check is strictly more robust than an
`instanceof` check**, because `code` is a plain string property that survives
every boundary in the table above — serialisation included.

System errors carry more of the same kind of information, all documented and all
stable: `errno`, `syscall`, `path`, `address`, `port`. `syscall` and `path`
together are usually what turns "ENOENT" into an actionable log line.

⚠️ **`code` is not namespaced.** Node uses `ERR_*` and the POSIX names;
PostgreSQL's driver surfaces five-character SQLSTATE codes like `23505`;
MongoDB uses numbers. Nothing prevents two libraries from colliding, so a bare
`e.code === 'ETIMEDOUT'` is a claim about *which* subsystem timed out that the
code alone does not support. Narrow to the operation first, then read `code`.

## Never widen it back

The one thing that makes all of the above pointless:

```ts
catch (e: any) { … }                   // ✗ throws away the guarantee
catch (e) { (e as Error).message; }     // ✗ same, with more typing
```

`catch (e: any)` is explicitly permitted by the language, which is why it keeps
appearing in codebases that "turned on strict". It converts a compiler-enforced
"prove it" into a silent assertion, and it is the exact mistake
`useUnknownInCatchVariables` exists to prevent.

📌 A cheap, effective CI check: `grep -rn "catch (\w*: any)" src/`. It has a
near-zero false-positive rate.

## Gotchas

**Symptom:** a custom error class stops being recognised after a dependency bump
or a bundler change, and every one of them logs as an unknown thrown value.
**Cause:** two copies of the module defining the class, so the `instanceof` is
comparing against a different constructor object.
**Fix:** discriminate on a literal property ([chunk 02](./02-making-an-error-recognisable.md))
rather than on identity. `instanceof` is an identity check wearing a type-check
costume.

**Symptom:** errors from a worker thread all arrive as "non-Error thrown".
**Cause:** they were serialised crossing the boundary. The prototype did not
survive, so neither `instanceof` nor a brand check can succeed.
**Fix:** a structural or `code`-based check on that path, and send a
deliberately-shaped plain object rather than hoping a class survives.

**Symptom:** `Error.isError` is red in the editor but works when you run it.
**Cause:** `lib` is pinned below `esnext`, so the declaration in
`lib.esnext.error.d.ts` is not loaded. The runtime has the function; the
compiler has not been told it exists.
**Fix:** add `"esnext.error"` to `lib`. Do not reach for `as any`.

**Symptom:** error handling breaks after a Node upgrade because a message check
stopped matching.
**Cause:** matching on `e.message`, which Node documents as changeable in any
version.
**Fix:** match on `code`. This is one of the few places the documentation gives
a direct instruction.

**Symptom:** `strict` is on and `catch` blocks still access `.message` freely.
**Cause:** `catch (e: any)`, or an `as Error` immediately inside the block.
**Fix:** the grep above, and `toError` / `getErrorMessage` from phase 2 so
there is a sanctioned one-liner to reach for instead.

## Interview questions

**Why is `instanceof Error` a weak guard in a deployed service?**
Because it compares against one specific constructor object and walks a
prototype chain. Two copies of a package, a bundler duplicating a module, a `vm`
context, or an error that crossed a worker boundary all produce values that are
errors and are not `instanceof` *your* `Error`. The check then fails silently
and routes a real error into the "unknown value" branch.

**What replaced it, and what stops you using the replacement?**
`Error.isError()` — a brand check that is correct across realms, present on Node
24. What stops you is `lib`: it is declared in `lib.esnext.error.d.ts`, reachable
only from `lib.esnext.d.ts`, so any config that pins `lib` below `esnext` will
not typecheck it even though the runtime has it. `util.types.isNativeError` is
the server-only equivalent with wider availability.

**Why match on `error.code` rather than `error.message`?**
Node documents `message` as changeable in any version and instructs you to use
`code` to identify errors. `code` is also a plain string property, so it is the
only one of the two that survives serialisation across a worker or process
boundary.

**What is wrong with `catch (e: any)`?**
It is legal, and it discards exactly the guarantee `useUnknownInCatchVariables`
provides. `unknown` forces you to prove what you caught; `any` reinstates the
pre-4.4 behaviour where `e.message` compiles and prints `undefined` for every
non-`Error` throw — in the one place in a program where you have the least
information about what you are holding.

---

← [Topic index](./README.md) · Next → [02 · Making an error recognisable](./02-making-an-error-recognisable.md)
