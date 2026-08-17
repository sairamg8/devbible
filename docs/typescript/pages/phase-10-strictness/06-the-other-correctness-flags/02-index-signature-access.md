---
title: "noPropertyAccessFromIndexSignature"
sidebar_label: "02 · Index-signature access"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 from the **compiler's own option table** in the **TypeScript
> 5.9.3** build — `noPropertyAccessFromIndexSignature` carries
> `defaultValueDescription: false`, **no `strictFlag`**, and 🔴 uniquely in this
> group **`showInSimplifiedHelpView: false`** — with the description *"Enforces
> using indexed accessors for keys declared using an indexed type"*. `TS4111`
> and its exact `{0}` text come from the numbered diagnostic table.
> **No sandbox, no console block.**

The only flag in this group that changes **syntax** rather than types. It
forbids nothing you could not already do; it makes you write it differently, and
the difference is the point.

> **`config.apiUrl` and `config['apiUrl']` compile to the same thing and mean
> different things to a reader.** One says "this property is declared"; the other
> says "this key is looked up and might not be there". This flag makes the code
> say which.

## What it changes

```ts
interface Env { [key: string]: string | undefined }
declare const env: Env;

env.API_URL;        // TS4111 with the flag; fine without
env['API_URL'];     // fine either way
```

`TS4111` — *"Property `'{0}'` comes from an index signature, so it must be
accessed with `['{0}']`."* The message contains the fix, which is unusual and
makes this the easiest error in the phase to resolve.

**Declared properties are untouched:**

```ts
interface Config {
  port: number;                          // declared
  [key: string]: string | number | undefined;   // indexed
}
declare const c: Config;

c.port;             // fine — declared, not indexed
c.timeout;          // TS4111 — reached through the index signature
```

📌 **That contrast is the whole feature.** In a type that has both declared
properties and an index signature, the dot tells you which kind you are touching.
Without the flag, both look identical and a typo in a declared property name
silently falls through to the index signature and returns `undefined`.

## The bug underneath

```ts
interface Config {
  apiUrl: string;
  [key: string]: string | undefined;
}

const url = config.apiUrI;   // capital i, not lowercase L
```

Without the flag: no error. The typo is not a declared property, so it resolves
through the index signature to `string | undefined`, and the failure appears
later as a `fetch` to `undefined`. With the flag, `config.apiUrI` is `TS4111`
and the dot-access on `config.apiUrl` is fine — so **the typo is the only one of
the two that errors.**

🔴 **That is the actual argument for this flag, and it is easy to state badly.**
It is not "brackets are safer". It is that an index signature makes *every*
misspelling legal, and this flag restores the distinction between "a name I
declared" and "a string I looked up".

## The two flags that pair with it

This flag governs **syntax**; [`noUncheckedIndexedAccess`](../02-nouncheckedindexedaccess.md)
governs the **type**. They cover the same construct from opposite sides:

| | Without the flag | With it |
|---|---|---|
| `noPropertyAccessFromIndexSignature` | `env.KEY` allowed | must write `env['KEY']` |
| `noUncheckedIndexedAccess` | `env['KEY']` is `string` | `env['KEY']` is `string \| undefined` |

**Enabled together, `env['KEY']` is both visibly a lookup and correctly typed as
possibly-missing** — which is the honest description of what it is. Enabled
separately, each does half the job. If you are turning on one, the case for the
other is already made.

## `process.env`, the canonical case

`process.env` is typed with an index signature, so it is the object almost
everyone meets this flag on. It is also a case where **the right answer is not
to use either syntax in application code** — you parse the environment once at
startup into a typed object, and the rest of the codebase touches that.

[Phase 7 · Typing `process.env`](../../phase-7-server/03-typing-process-env/README.md)
makes that argument in full, including why augmenting `ProcessEnv` is the weaker
option and why parsing wins. This page owns the general syntax rule; that topic
owns the applied case.

📌 **Read those two together and the flag stops feeling like a style rule.** It is
pressure toward parsing: if every environment read has to be spelled
`process.env['DATABASE_URL']` and typed `string | undefined`, the cost of doing
it a hundred times becomes obvious, and doing it once at startup becomes the
obvious answer.

## 🔴 The compiler itself de-emphasises this one

Of every option in this group, only `noPropertyAccessFromIndexSignature` carries
**`showInSimplifiedHelpView: false`** in its record. The simplified help view is
what `tsc --help` shows without `--all`, so this flag is deliberately kept out of
the default listing.

⚠️ **What that does and does not tell you.** It is evidence about presentation —
the compiler team chose not to surface it in the short help — and it is
consistent with this being the most stylistic flag in the family. It is **not**
evidence that the flag is discouraged, and no documentation says so. Stated here
as an observation from the record, not as a recommendation derived from it.

## When it is genuinely noise

An honest list, because this is the one flag in the group with a real "no" case:

- **Types that are *only* an index signature and are known-complete**, such as a
  lookup table you built three lines earlier. Every access becomes brackets and
  nothing is clarified.
- **Codebases that have already removed index signatures** in favour of unions —
  `Record<Status, Handler>` rather than `Record<string, Handler>`. The flag has
  nothing to act on, which is a sign the underlying problem was already solved
  properly. Same observation as
  [`noUncheckedIndexedAccess`](../02-nouncheckedindexedaccess.md).
- **Heavy interop with dynamic data** where you have deliberately decided to
  work in `Record<string, unknown>`. The brackets are correct there and also
  relentless.

**The strongest version of the objection** is that this flag has no runtime
consequence at all: nothing it rejects is a bug by itself, and the typo case it
catches would also be caught by not having an index signature. That is true, and
it is why this is the one flag here you can reasonably decline while taking the
other five.

## Gotchas

**Symptom:** `TS4111` on a property you are certain is declared.
**Cause:** it is declared on a *different* type than the one the value has —
often a widened `Record<string, …>` inferred from an object literal.
**Fix:** annotate the value with the interface that declares the property, or
`as const`, so the declared properties survive.

**Symptom:** a typo in a property name returns `undefined` instead of erroring.
**Cause:** the type has an index signature, so every string is a legal key.
**Fix:** this flag makes the typo `TS4111`. Better still, remove the index
signature if the keys are actually known.

**Symptom:** every `process.env.X` in the codebase errored at once.
**Cause:** `ProcessEnv` is an index-signature type. This is the expected first
encounter with the flag.
**Fix:** parse the environment once at startup into a typed config object —
[phase 7](../../phase-7-server/03-typing-process-env/README.md) — rather than
converting a hundred reads to brackets.

**Symptom:** the brackets were added and the value is still `string`, not
`string | undefined`.
**Cause:** this flag changes syntax only. The type change is
`noUncheckedIndexedAccess`, a different flag.
**Fix:** enable both, or accept that the lookup is typed optimistically.

**Symptom:** the flag does not appear in `tsc --help`.
**Cause:** its record sets `showInSimplifiedHelpView: false`, so it is only in
`--help --all`.
**Fix:** none needed — but it is worth knowing when someone claims the option
does not exist.

**Symptom:** a generic function accessing `obj[key]` is unaffected by the flag.
**Cause:** `obj[key]` with a variable key is already bracket syntax. The flag
only rewrites dotted access with a literal name.
**Fix:** none. The generic case is `noUncheckedIndexedAccess` territory.

## Interview questions

**What does `noPropertyAccessFromIndexSignature` change, and what does it not?**
It requires bracket syntax for any property reached through an index signature —
`env['KEY']` rather than `env.KEY` — and reports `TS4111` otherwise. It changes
**no types at all**: the value's type is identical either way. Declared
properties are untouched.

**What is the actual bug it catches?**
A typo in a property name on a type that also has an index signature. Without the
flag, the misspelling is a legal index lookup returning `undefined`, and the
failure surfaces much later. With the flag, the correct name keeps working with
a dot and the typo errors, so the two are no longer indistinguishable.

**How does it relate to `noUncheckedIndexedAccess`?**
They cover the same construct from opposite sides. This one changes the syntax so
a lookup *looks* like a lookup; that one changes the type so a lookup is
correctly `T | undefined`. Enabled together, an index access is both visibly and
correctly a lookup. Enabling only one does half the job.

**Why does `process.env` trigger this everywhere, and what is the real fix?**
Because `ProcessEnv` is declared with a string index signature, so every
`process.env.X` is an index access. Converting them all to brackets is the
mechanical fix; the real fix is to parse the environment once at startup into a
typed object and have the rest of the codebase read that.

**Is there a good case for declining this flag while taking the others?**
Yes, and it is the only one in the group where that is true. It has no runtime
consequence: nothing it rejects is a bug on its own, and its typo case would also
be prevented by not having a loose index signature in the first place. On a
codebase that has already replaced `Record<string, T>` with union-keyed records,
it has almost nothing left to do.

---

← [01 · `noImplicitOverride`](./01-noimplicitoverride.md) · Next → [03 · The control-flow flags](./03-control-flow-flags.md)
