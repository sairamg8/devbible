---
title: "What process.env actually is"
sidebar_label: "01 · What it actually is"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **Node.js API docs** (*Process → `process.env`*
> — the string-coercion note, `delete`, Windows case-insensitivity and the
> Worker-thread copy are quoted from it; *Command-line API* — `--env-file`,
> added v20.6.0 and non-experimental in v24.10.0 / v22.21.0, and
> `--env-file-if-exists`, added v22.9.0) and the **DefinitelyTyped** sources for
> `@types/node`, from which `ProcessEnv` and `Dict<T>` are quoted verbatim.
> **No sandbox, no console block** — the small snippets below that show values
> are **from the Node documentation's own examples**, not from a run of mine.

Every configuration bug in a server starts here, so it is worth being precise
about what this object *is* before arguing about how to type it.

## The declaration, in full

`@types/node` types it in two short pieces:

```ts
// process.d.ts
env: ProcessEnv;

interface ProcessEnv extends Dict<string> {}
```

```ts
// globals.d.ts
interface Dict<T> {
    [key: string]: T | undefined;
}
```

That is the whole thing. Unpack it and one fact falls out that decides the rest
of the topic:

> **`process.env.ANYTHING` is `string | undefined`, and the `| undefined` is
> written into the declaration.**

📌 This is worth separating from a flag people assume is responsible.
[`noUncheckedIndexedAccess`](../01-tsconfig-for-a-node-service/04-the-annotated-configs.md)
adds `| undefined` to index-signature reads that do not already have it —
`process.env` already has it, by hand, in `Dict<T>`. So `process.env` is the one
index access that behaves correctly **whether or not you enable the flag**. If
you have ever wondered why this object is annoying in a codebase where nothing
else is, that is why: it is the only place the library authors told the truth
up front.

The corollary matters more: **the type is already correct.** Every technique in
[chunk 02](./02-augmenting-processenv.md) and
[chunk 03](./03-why-parsing-wins.md) is about what to do *with* a correct type
that is inconvenient — not about fixing a wrong one.

## Five runtime behaviours that break the mental model

The type says "a dictionary of optional strings". The runtime is stranger than
that, in ways that matter on a server.

### 1. Assigning a non-string coerces it — and that is deprecated

From the Node docs:

> Assigning a property on `process.env` will implicitly convert the value to a
> string. **This behavior is deprecated.** Future versions of Node.js may throw
> an error when the value is not a string, number, or boolean.

Their own example:

```js
import { env } from 'node:process';

env.test = null;
console.log(env.test);       // => 'null'
env.test = undefined;
console.log(env.test);       // => 'undefined'
```

🔴 **Read the second one twice.** Setting a variable to `undefined` does not
unset it — it sets it to the four-character string `'undefined'`, which is
**truthy**. A guard like `if (process.env.FEATURE_X)` passes. This is the single
nastiest behaviour on the page, and the type system cannot see it at all,
because `ProcessEnv`'s index signature accepts `string | undefined` on write as
well as read.

To actually remove a variable, `delete` it:

```js
env.TEST = 1;
delete env.TEST;
console.log(env.TEST);       // => undefined
```

### 2. Windows is case-insensitive

> On Windows operating systems, environment variables are case-insensitive.

```js
env.TEST = 1;
console.log(env.test);       // => 1
```

TypeScript models `ProcessEnv` with a case-*sensitive* index signature on every
platform, so an augmentation declaring `DATABASE_URL` says nothing about
`database_url` — which on Windows is the same variable. A rare bug, but an
impossible one to find if you do not know this.

### 3. Worker threads get a *copy*

> Unless explicitly specified when creating a `Worker` instance, each `Worker`
> thread has its own copy of `process.env` […] Changes to `process.env` will not
> be visible across `Worker` threads, and only the main thread can make changes
> that are visible to the operating system or to native add-ons.

And a platform wrinkle on top: *"On Windows, a copy of `process.env` on a
`Worker` instance operates in a case-sensitive manner unlike the main thread."*

The practical consequence: **mutating `process.env` is not a way to share
configuration.** Anything that reads config lazily, in a worker, after a startup
mutation, reads the pre-mutation value.

### 4. Modifications do not escape the process

> It is possible to modify this object, but such modifications will not be
> reflected outside the Node.js process.

Obvious in isolation, regularly forgotten when a test suite sets
`process.env.NODE_ENV` and then spawns a child process expecting it to inherit
the change from a different mechanism.

### 5. The empty string is present and falsy

`FOO=` in a `.env` file, or `FOO="" node server.js`, gives `''` — **not**
`undefined`. The variable *is set*. So:

```ts
const url = process.env.DATABASE_URL ?? 'postgres://localhost/dev';  // '' wins
const url = process.env.DATABASE_URL || 'postgres://localhost/dev';  // fallback wins
```

`??` only falls back on `null | undefined`; `||` falls back on any falsy value.
Neither is universally right — an empty `LOG_PREFIX` may be intentional, an
empty `DATABASE_URL` never is.

⚠️ And the type is identical in both branches, which is the point
[phase 2 · truthiness and equality](../../phase-2-narrowing/02-truthiness-and-equality.md)
makes at length: truthiness narrowing and `!= null` narrowing produce the *same
type* here, so the compiler cannot tell you which of the two lines you wanted.
**The type is right and the logic is wrong** — the failure mode this whole phase
keeps returning to.

## Where the values come from

Node can load a `.env` file itself, which removes the most common third-party
dependency in a service:

```bash
node --env-file=.env --env-file=.development.env server.js
```

`--env-file` arrived in v20.6.0 and stopped being experimental in v24.10.0 /
v22.21.0; `--env-file-if-exists` (v22.9.0) is the variant that does not throw
when the file is absent — the one you want for a file that exists only in
development.

The documented format details, each of which someone has been bitten by:

| Feature | Behaviour |
|---|---|
| Comments | anything after `#`, including at the end of a value line |
| Quotes | a value may be wrapped in `` ` ``, `"` or `'`; the quotes are stripped |
| Multi-line | supported inside quotes (v21.7.0 / v20.12.0) |
| `export` prefix | ignored, so a file can be both `source`d and `--env-file`d |
| `NODE_OPTIONS` | parsed and applied from the file |

🔴 **The precedence rule is the one to memorise: the real environment wins over
the file.** If `PORT` is already set in the environment, `PORT=3000` in your
`.env` does nothing. Between multiple `--env-file` arguments, later files
override earlier ones.

That ordering is the opposite of what people usually assume, and it is the
correct design — a container's injected configuration should not be
overrideable by a file that got baked into the image.

## Gotchas

**Symptom:** a feature flag is on in production and nobody enabled it.
**Cause:** something assigned `process.env.FEATURE_X = undefined`, which stores
the string `'undefined'` — truthy.
**Fix:** `delete process.env.FEATURE_X`. Better, do not mutate `process.env` at
all ([chunk 03](./03-why-parsing-wins.md)).

**Symptom:** `.env` changes have no effect in a deployed container.
**Cause:** the variable is already set in the real environment, which takes
precedence over `--env-file`.
**Fix:** it is working as documented. Change the environment, or stop shipping
a `.env` into the image — having both is the actual problem.

**Symptom:** a config value read inside a worker thread is stale.
**Cause:** each `Worker` gets a copy of `process.env` taken at construction;
later mutations on the main thread are invisible to it.
**Fix:** pass configuration through `workerData` or the `env` option, not
through a mutation the worker is expected to observe.

**Symptom:** `DATABASE_URL` is set, and the app connects to localhost anyway.
**Cause:** it is set to the empty string, and the code used `||`, or it is set
to `'undefined'` from a prior assignment.
**Fix:** validate presence *and* shape once, at startup, rather than defaulting
at every read site.

**Symptom:** an augmentation for `DATABASE_URL` does not apply on a colleague's
Windows machine.
**Cause:** environment variables are case-insensitive there; `database_url` and
`DATABASE_URL` are one variable to the OS and two to TypeScript.
**Fix:** normalise at the single read point.

## Interview questions

**Why is `process.env.PORT` typed `string | undefined` even with
`noUncheckedIndexedAccess` turned off?**
Because the `| undefined` is in the declaration, not added by a flag.
`ProcessEnv extends Dict<string>`, and `Dict<T>` is
`{ [key: string]: T | undefined }`. The flag adds `| undefined` to index reads
that lack it; here `@types/node` already wrote it by hand.

**What does `process.env.X = undefined` do?**
Sets `X` to the string `'undefined'`, which is truthy — it does not unset it.
Node documents the implicit string coercion and marks it deprecated. Use
`delete process.env.X`.

**A variable is in the `.env` file and the deployed app ignores it. Bug?**
No — documented precedence. The real environment takes priority over
`--env-file`, and later `--env-file` arguments override earlier ones. Shipping
both a baked-in file and injected variables is the design error.

**Give a `process.env` failure the type system cannot catch.**
Several: the `'undefined'` string, the empty string being present-but-falsy, and
Windows case-insensitivity. All three are runtime facts about a value the
compiler only knows as `string | undefined` — and in the empty-string case the
type after a truthiness check and after a `!= null` check is identical, so the
compiler cannot even hint that you chose the wrong guard.

---

← [Topic index](./README.md) · Next → [02 · Augmenting `ProcessEnv`](./02-augmenting-processenv.md)
